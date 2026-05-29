import {
  GONKAGATE_BASE_URL,
  ZEROCLAW_PROVIDER_KEY,
} from "../constants/gateway.js";
import type {
  ConfigMutationPreflight,
  InstallResult,
  SavedConfigInspection,
} from "./contracts.js";
import { renderZeroClawSupportSummary } from "./zeroclaw-command.js";

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

function renderOutcomeHeadline(result: InstallResult): string {
  switch (result.status) {
    case "success":
      return `Install succeeded via ${result.path === "first_run" ? "the proven first-run path" : "the existing-config native write path"}.`;
    case "blocked":
      return "Install is blocked before mutation.";
    case "scaffold":
      return "Install stays scaffolded for this path.";
    case "failed":
      return "Install mutation started but did not complete cleanly.";
    default:
      return "Install status is unavailable.";
  }
}

function renderFirstRunProof(result: InstallResult): string[] {
  const proof = result.firstRunProof;
  const lines = [
    `First-run proof state: ${proof.state}`,
    `First-run proof detail: ${proof.reason}`,
  ];

  if (proof.supportedTransport !== undefined) {
    lines.push(
      `Shipped first-run secret transport: ${proof.supportedTransport}`,
    );
  }

  if (proof.commandTuple !== undefined) {
    lines.push(
      `Shipped first-run command tuple: ${proof.commandTuple.join(" -> ")}`,
    );
  }

  return lines;
}

export function renderInstallResult(result: InstallResult): string {
  const lines = [
    renderOutcomeHeadline(result),
    "",
    `ZeroClaw CLI support: ${renderZeroClawSupportSummary(result.commandProbe)}`,
    `Mutation readiness preflight: ${renderPreflightOutcome(result.preflight)}`,
    `Preflight detail: ${result.preflight.reason}`,
    `Chosen install path: ${result.path}`,
    `GonkaGate base URL: ${GONKAGATE_BASE_URL}`,
    `ZeroClaw provider key: ${ZEROCLAW_PROVIDER_KEY}`,
    ...renderFirstRunProof(result),
    "",
  ];

  if (result.selectedModel !== undefined) {
    lines.push(
      `Selected curated model: ${result.selectedModel.key} -> ${result.selectedModel.modelId}`,
      "",
    );
  }

  if (result.liveCatalog !== undefined) {
    lines.push(
      "GonkaGate live model catalog:",
      `- Endpoint: ${result.liveCatalog.endpoint}`,
      `- Live model entries returned: ${result.liveCatalog.liveModelCount}`,
      `- Curated models confirmed: ${result.liveCatalog.curatedModelIds.join(", ")}`,
      "",
    );
  }

  if (result.configInspection !== undefined) {
    lines.push(
      "Resolved ZeroClaw config:",
      ...renderConfigInspection(result.configInspection).map(
        (line) => `- ${line}`,
      ),
      "",
    );
  }

  if (result.status === "success") {
    lines.push(
      `Native secret transport: ${result.writeResult.secretTransport}`,
      "Mutation outcome: saved GonkaGate contract confirmed after native write sequence.",
      "",
    );
  }

  if (result.status === "failed") {
    lines.push(
      `Failed stage: ${result.writeResult.failedStage}`,
      `Restore status: ${result.writeResult.restoreStatus}`,
      `Native secret transport: ${result.writeResult.secretTransport}`,
      "",
    );
  }

  lines.push(
    "Managed config contract:",
    ...result.managedFields.map(
      (field) =>
        `- ${field.configKey} (props: ${field.propPath}): ${field.description}`,
    ),
    "",
    result.overrides.length > 0
      ? "Environment overrides detected:"
      : "Environment overrides detected: none",
    ...result.overrides.map(
      (override) => `- ${override.name}: ${override.displayValue}`,
    ),
  );

  if ("reason" in result) {
    lines.push("", `Outcome detail: ${result.reason}`);
  }

  if ("remediation" in result && typeof result.remediation === "string") {
    lines.push(`Remediation: ${result.remediation}`);
  }

  return lines.join("\n");
}
