import { ZEROCLAW_PROVIDER_KEY } from "../constants/gateway.js";
import { resolveModelById } from "../constants/models.js";
import type {
  ConfigMutationPreflight,
  SavedConfigInspection,
  VerifyDoctorAdvisory,
  VerifyResult,
  VerifyRuntimeStatus,
  VerifySavedContract,
  VerifySavedContractCheck,
} from "./contracts.js";
import {
  inspectSavedZeroClawConfig,
  resolveActiveZeroClawConfig,
} from "./config-resolution.js";
import { preflightMutationReadiness } from "./config-preflight.js";
import {
  createNodeInstallDependencies,
  type InstallDependencies,
} from "./deps.js";
import {
  classifyEffectiveProviderEnvOverrides,
  getProviderEnvOverrides,
} from "./environment-overrides.js";
import { MANAGED_CONFIG_FIELDS } from "./managed-contract.js";
import {
  detectZeroClaw,
  getZeroClawDoctorSummary,
  getZeroClawStatusSummary,
  renderZeroClawSupportSummary,
  sanitizeZeroClawCommandOutput,
} from "./zeroclaw-command.js";

export interface VerifyOptions {
  readonly env?: NodeJS.ProcessEnv;
}

function createUnsupportedVersionPreflight(): ConfigMutationPreflight {
  return {
    outcome: "unsupported_version",
    reason:
      "ZeroClaw is missing, unparseable, or older than the supported minimum runtime.",
    unknownTopLevelKeys: [],
  };
}

function renderPreflightOutcome(preflight: ConfigMutationPreflight): string {
  switch (preflight.outcome) {
    case "eligible_first_run":
      return "eligible first-run shape";
    case "eligible_existing_config":
      return "eligible audited existing-config shape";
    case "unsupported_version":
      return "blocked by unsupported ZeroClaw runtime";
    case "config_unreadable":
      return "blocked by unreadable resolved config";
    case "unsupported_shape_unknown_top_level_keys":
      return "blocked by unaudited top-level keys";
    default:
      return preflight.outcome;
  }
}

function renderConfigInspection(inspection: SavedConfigInspection): string[] {
  const lines = [
    `Resolved config path: ${inspection.configPath}`,
    `Resolved workspace path: ${inspection.workspacePath}`,
    `Resolution source: ${inspection.source}`,
  ];

  switch (inspection.status) {
    case "missing":
      return [...lines, "Saved config at resolved path: missing"];
    case "unreadable":
      return [
        ...lines,
        "Saved config at resolved path: unreadable",
        `Read-only inspection error: ${inspection.error}`,
      ];
    case "inspected":
      return [
        ...lines,
        "Saved config at resolved path: present",
        `Saved default_provider: ${inspection.defaultProvider ?? "<unset>"}${inspection.defaultProviderSource ? ` (${inspection.defaultProviderSource})` : ""}`,
        `Saved default_model: ${inspection.defaultModel ?? "<unset>"}${inspection.defaultModelSource ? ` (${inspection.defaultModelSource})` : ""}`,
        `Saved api_key: ${inspection.apiKeyState}`,
        `Top-level keys: ${inspection.topLevelKeys.length > 0 ? inspection.topLevelKeys.join(", ") : "<none>"}`,
      ];
    default:
      return lines;
  }
}

function createSavedContractCheck(
  name: VerifySavedContractCheck["name"],
  ok: boolean,
  detail: string,
): VerifySavedContractCheck {
  return {
    detail,
    name,
    ok,
  };
}

function evaluateSavedContract(
  configInspection: SavedConfigInspection | undefined,
  preflight: ConfigMutationPreflight,
  support: VerifyResult["commandProbe"]["support"],
): VerifySavedContract {
  const normalizedProvider =
    configInspection?.status === "inspected"
      ? configInspection.defaultProvider
      : undefined;
  const normalizedModel =
    configInspection?.status === "inspected"
      ? configInspection.defaultModel
      : undefined;
  const apiKeyState =
    configInspection?.status === "inspected"
      ? configInspection.apiKeyState
      : undefined;

  const supportOk = support === "supported";
  const preflightOk =
    preflight.outcome === "eligible_existing_config" ||
    preflight.outcome === "eligible_first_run";

  const providerOk = normalizedProvider === ZEROCLAW_PROVIDER_KEY;
  const modelOk = resolveModelById(normalizedModel) !== undefined;
  const apiKeyOk = apiKeyState === "set";

  const checks = Object.freeze([
    createSavedContractCheck(
      "support",
      supportOk,
      supportOk
        ? "Supported ZeroClaw runtime is installed."
        : "Verify requires ZeroClaw to be available, parseable, and not older than the supported minimum runtime.",
    ),
    createSavedContractCheck(
      "preflight",
      preflightOk,
      preflightOk
        ? "Resolved config shape stays inside the audited v0.6.9 boundary."
        : preflight.reason,
    ),
    createSavedContractCheck(
      "default_provider",
      providerOk,
      providerOk
        ? `Saved provider matches ${ZEROCLAW_PROVIDER_KEY}.`
        : `Saved provider must be ${ZEROCLAW_PROVIDER_KEY}; received ${normalizedProvider ?? "<unset>"}.`,
    ),
    createSavedContractCheck(
      "default_model",
      modelOk,
      modelOk
        ? `Saved model is curated: ${normalizedModel}.`
        : `Saved model must be one of the curated GonkaGate entries; received ${normalizedModel ?? "<unset>"}.`,
    ),
    createSavedContractCheck(
      "api_key",
      apiKeyOk,
      apiKeyOk
        ? "Saved api_key is set."
        : `Saved api_key must be set; received ${apiKeyState ?? "unknown"}.`,
    ),
  ]);
  const failedCheck = checks.find((check) => !check.ok);

  return {
    apiKeyState,
    checks,
    model: normalizedModel,
    ok: failedCheck === undefined,
    provider: normalizedProvider,
    reason:
      failedCheck === undefined
        ? "Saved GonkaGate contract matches the audited ZeroClaw v0.6.9 requirements."
        : failedCheck.detail,
  };
}

function createRuntimeFailure(
  reason: string,
  overridesPresent: boolean,
  error?: string,
): VerifyRuntimeStatus {
  return {
    attempted: true,
    error,
    ok: false,
    reason: overridesPresent
      ? `${reason} Environment shadowing does not waive runtime command or path mismatches.`
      : reason,
  };
}

function createRuntimeSkipped(reason: string): VerifyRuntimeStatus {
  return {
    attempted: false,
    ok: false,
    reason,
  };
}

async function inspectRuntimeStatus(
  dependencies: InstallDependencies,
  configInspection: SavedConfigInspection | undefined,
  savedContract: VerifySavedContract,
  hasShadowing: boolean,
): Promise<VerifyRuntimeStatus> {
  if (configInspection === undefined) {
    return createRuntimeSkipped(
      "Runtime status could not be checked because the resolved config was not available.",
    );
  }

  try {
    const summary = await getZeroClawStatusSummary(dependencies);
    const configPathMatches =
      summary.configPath === configInspection.configPath;
    const workspacePathMatches =
      summary.workspacePath === configInspection.workspacePath;
    const providerMatches =
      savedContract.provider === undefined
        ? undefined
        : summary.provider === savedContract.provider;
    const modelMatches =
      savedContract.model === undefined
        ? undefined
        : summary.model === savedContract.model;
    const providerMismatch = providerMatches === false;
    const modelMismatch = modelMatches === false;
    const shadowExplainedMismatch =
      hasShadowing && (providerMismatch || modelMismatch);

    if (!configPathMatches) {
      return createRuntimeFailure(
        `zeroclaw status resolved config path ${summary.configPath ?? "<unset>"} instead of ${configInspection.configPath}.`,
        hasShadowing,
      );
    }

    if (!workspacePathMatches) {
      return createRuntimeFailure(
        `zeroclaw status resolved workspace path ${summary.workspacePath ?? "<unset>"} instead of ${configInspection.workspacePath}.`,
        hasShadowing,
      );
    }

    if ((providerMismatch || modelMismatch) && !shadowExplainedMismatch) {
      const mismatches = [
        providerMismatch
          ? `provider ${summary.provider ?? "<unset>"} != ${savedContract.provider ?? "<unset>"}`
          : undefined,
        modelMismatch
          ? `model ${summary.model ?? "<unset>"} != ${savedContract.model ?? "<unset>"}`
          : undefined,
      ].filter((value): value is string => value !== undefined);

      return {
        attempted: true,
        configPathMatches,
        modelMatches,
        ok: false,
        providerMatches,
        reason: `zeroclaw status does not match the saved GonkaGate contract: ${mismatches.join("; ")}.`,
        shadowExplainedMismatch: false,
        summary,
        workspacePathMatches,
      };
    }

    return {
      attempted: true,
      configPathMatches,
      modelMatches,
      ok: true,
      providerMatches,
      reason: shadowExplainedMismatch
        ? "zeroclaw status completed successfully, and the provider/model drift is explained by active environment shadowing."
        : "zeroclaw status matches the resolved saved GonkaGate contract.",
      shadowExplainedMismatch,
      summary,
      workspacePathMatches,
    };
  } catch (cause: unknown) {
    const rawError = cause instanceof Error ? cause.message : String(cause);
    const sanitizedError = sanitizeZeroClawCommandOutput(
      rawError,
      dependencies.runtime.env,
    );

    return createRuntimeFailure(
      `zeroclaw status could not be verified: ${sanitizedError}`,
      hasShadowing,
      sanitizedError,
    );
  }
}

async function inspectDoctorAdvisory(
  dependencies: InstallDependencies,
  isSupportedRuntime: boolean,
): Promise<VerifyDoctorAdvisory> {
  if (!isSupportedRuntime) {
    return {
      attempted: false,
      ok: false,
      reason:
        "zeroclaw doctor was not attempted because the runtime is missing, unparseable, or older than the supported minimum.",
    };
  }

  try {
    const summary = await getZeroClawDoctorSummary(dependencies);

    return {
      attempted: true,
      exitCode: summary.exitCode,
      ok: summary.ok,
      output: summary.output || undefined,
      reason: summary.ok
        ? "zeroclaw doctor completed successfully and remains advisory-only."
        : "zeroclaw doctor reported advisory findings and does not change the verify verdict on its own.",
    };
  } catch (cause: unknown) {
    const rawError = cause instanceof Error ? cause.message : String(cause);
    const sanitizedError = sanitizeZeroClawCommandOutput(
      rawError,
      dependencies.runtime.env,
    );

    return {
      attempted: true,
      ok: false,
      output: sanitizedError,
      reason:
        "zeroclaw doctor could not be collected; advisory output is unavailable.",
    };
  }
}

function determineVerifyStatus(
  savedContract: VerifySavedContract,
  runtimeStatus: VerifyRuntimeStatus,
  hasShadowing: boolean,
): VerifyResult["status"] {
  if (!savedContract.ok) {
    return "fail";
  }

  if (!runtimeStatus.ok) {
    return "fail";
  }

  if (hasShadowing) {
    return "warn-shadowed";
  }

  return "pass";
}

function renderSavedContractChecks(
  savedContract: VerifySavedContract,
): string[] {
  return savedContract.checks.map(
    (check) => `- ${check.name}: ${check.ok ? "ok" : "fail"} — ${check.detail}`,
  );
}

function renderRuntimeSummary(runtimeStatus: VerifyRuntimeStatus): string[] {
  const lines = [
    `Runtime status: ${runtimeStatus.ok ? "ok" : "failed"}`,
    `Runtime detail: ${runtimeStatus.reason}`,
  ];

  if (runtimeStatus.summary !== undefined) {
    lines.push(
      `Runtime config path: ${runtimeStatus.summary.configPath ?? "<unset>"}`,
      `Runtime workspace path: ${runtimeStatus.summary.workspacePath ?? "<unset>"}`,
      `Runtime provider: ${runtimeStatus.summary.provider ?? "<unset>"}`,
      `Runtime model: ${runtimeStatus.summary.model ?? "<unset>"}`,
      `Gateway running: ${runtimeStatus.summary.gatewayRunning === undefined ? "<unknown>" : runtimeStatus.summary.gatewayRunning ? "yes" : "no"}`,
      `Service status: ${runtimeStatus.summary.serviceStatus ?? "<unset>"}`,
      `Service PID: ${runtimeStatus.summary.servicePid ?? "<unset>"}`,
      `Resolved config path matches: ${runtimeStatus.configPathMatches === undefined ? "<unknown>" : runtimeStatus.configPathMatches ? "yes" : "no"}`,
      `Resolved workspace path matches: ${runtimeStatus.workspacePathMatches === undefined ? "<unknown>" : runtimeStatus.workspacePathMatches ? "yes" : "no"}`,
      `Runtime provider matches saved config: ${runtimeStatus.providerMatches === undefined ? "<unknown>" : runtimeStatus.providerMatches ? "yes" : "no"}`,
      `Runtime model matches saved config: ${runtimeStatus.modelMatches === undefined ? "<unknown>" : runtimeStatus.modelMatches ? "yes" : "no"}`,
    );
  }

  return lines;
}

function renderDoctorAdvisory(doctorAdvisory: VerifyDoctorAdvisory): string[] {
  const lines = [
    `Doctor advisory attempted: ${doctorAdvisory.attempted ? "yes" : "no"}`,
    `Doctor advisory detail: ${doctorAdvisory.reason}`,
  ];

  if (doctorAdvisory.attempted) {
    lines.push(
      `Doctor advisory exit code: ${doctorAdvisory.exitCode ?? "<unknown>"}`,
    );
  }

  if (doctorAdvisory.output !== undefined) {
    lines.push(
      "Doctor advisory output:",
      ...doctorAdvisory.output
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => `  ${line}`),
    );
  }

  return lines;
}

function renderOverrides(result: VerifyResult): string[] {
  const lines = [
    result.overrides.length > 0
      ? "Environment overrides detected:"
      : "Environment overrides detected: none",
    ...result.overrides.map(
      (override) => `- ${override.name}: ${override.displayValue}`,
    ),
  ];

  if (result.shadowing.hasShadowing) {
    lines.push(
      `Effective shadowing detail: ${result.shadowing.reason}`,
      ...result.shadowing.effectiveOverrides.map(
        (override) =>
          `- active shadowing override: ${override.name} = ${override.displayValue}`,
      ),
    );
  } else {
    lines.push(`Effective shadowing detail: ${result.shadowing.reason}`);
  }

  if (result.shadowing.ignoredOverrides.length > 0) {
    lines.push(
      ...result.shadowing.ignoredOverrides.map(
        (override) =>
          `- ignored override: ${override.name} = ${override.displayValue}`,
      ),
    );
  }

  return lines;
}

export async function runVerifyUseCase(
  options: VerifyOptions = {},
  dependencies?: InstallDependencies,
): Promise<VerifyResult> {
  const installDependencies =
    dependencies ??
    createNodeInstallDependencies({
      runtime: {
        env: options.env,
      },
    });
  const commandProbe = await detectZeroClaw(installDependencies);
  const overrides = getProviderEnvOverrides(installDependencies.runtime.env);
  let configInspection: SavedConfigInspection | undefined;
  let preflight = createUnsupportedVersionPreflight();

  if (commandProbe.support === "supported") {
    const resolvedConfig =
      await resolveActiveZeroClawConfig(installDependencies);
    configInspection = await inspectSavedZeroClawConfig(
      installDependencies,
      resolvedConfig,
    );
    preflight = preflightMutationReadiness(commandProbe, configInspection);
  }

  const savedContract = evaluateSavedContract(
    configInspection,
    preflight,
    commandProbe.support,
  );
  const shadowing = classifyEffectiveProviderEnvOverrides(
    overrides,
    savedContract.provider,
  );
  const runtimeStatus = await inspectRuntimeStatus(
    installDependencies,
    configInspection,
    savedContract,
    shadowing.hasShadowing,
  );
  const doctorAdvisory = await inspectDoctorAdvisory(
    installDependencies,
    commandProbe.support === "supported",
  );

  return {
    commandProbe,
    configInspection,
    doctorAdvisory,
    managedFields: MANAGED_CONFIG_FIELDS,
    overrides,
    preflight,
    runtimeStatus,
    savedContract,
    shadowing,
    status: determineVerifyStatus(
      savedContract,
      runtimeStatus,
      shadowing.hasShadowing,
    ),
  };
}

export function renderVerifyResult(result: VerifyResult): string {
  const headline =
    result.status === "pass"
      ? "Verify verdict: pass"
      : result.status === "warn-shadowed"
        ? "Verify verdict: warn-shadowed"
        : "Verify verdict: fail";
  const verdictDetail =
    result.status === "warn-shadowed"
      ? "saved config is correct but inactive"
      : result.status === "pass"
        ? "Saved GonkaGate config and active runtime evidence agree."
        : "Saved GonkaGate config or active runtime evidence could not be verified cleanly.";
  const lines = [
    headline,
    verdictDetail,
    "",
    `ZeroClaw CLI support: ${renderZeroClawSupportSummary(result.commandProbe)}`,
    `Mutation readiness preflight: ${renderPreflightOutcome(result.preflight)}`,
    `Preflight detail: ${result.preflight.reason}`,
    "",
  ];

  if (result.configInspection !== undefined) {
    lines.push(
      "Resolved ZeroClaw config:",
      ...renderConfigInspection(result.configInspection).map(
        (line) => `- ${line}`,
      ),
      "",
    );
  }

  lines.push(
    "Saved GonkaGate contract:",
    `- overall: ${result.savedContract.ok ? "ok" : "fail"}`,
    `- detail: ${result.savedContract.reason}`,
    ...renderSavedContractChecks(result.savedContract),
    "",
    ...renderOverrides(result),
    "",
    "Runtime summary from zeroclaw status:",
    ...renderRuntimeSummary(result.runtimeStatus).map((line) => `- ${line}`),
    "",
    "Doctor advisory:",
    ...renderDoctorAdvisory(result.doctorAdvisory).map((line) => `- ${line}`),
    "",
    "Managed config contract:",
    ...result.managedFields.map(
      (field) =>
        `- ${field.configKey} (props: ${field.propPath}): ${field.description}`,
    ),
  );

  return lines.join("\n");
}
