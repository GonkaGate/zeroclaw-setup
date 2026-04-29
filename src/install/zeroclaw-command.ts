import { compare, valid } from "semver";
import type {
  SecretTransportMode,
  ZeroClawCommandProbe,
  ZeroClawDoctorSummary,
  ZeroClawStatusSummary,
  ZeroClawVersionSupport,
} from "./contracts.js";
import type { InstallDependencies } from "./deps.js";
import {
  getProviderEnvOverrides,
  getSecretProviderEnvValues,
} from "./environment-overrides.js";

const ZEROCLAW_VERSION_PATTERN = /\bv?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/u;
const AUDITED_STABLE_VERSION = "0.6.9";

interface ZeroClawCommandExecutionOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly stdin?: string;
  readonly stdio?: "inherit" | "pipe";
}

export interface ZeroClawSecretWriteRequest {
  readonly mode: SecretTransportMode;
  readonly path: string;
  readonly secret?: string;
}

export interface ZeroClawOnboardQuickRequest {
  readonly modelId: string;
  readonly provider: string;
}

export function parseZeroClawVersion(output: string): string | null {
  const versionMatch = output.match(ZEROCLAW_VERSION_PATTERN);

  if (versionMatch === null) {
    return null;
  }

  return valid(versionMatch[1]);
}

export function classifyZeroClawVersionSupport(
  installedVersion: string,
): ZeroClawVersionSupport {
  const normalizedInstalledVersion = valid(installedVersion);
  const normalizedAuditedVersion = valid(AUDITED_STABLE_VERSION);

  if (normalizedInstalledVersion === null) {
    throw new Error(`Invalid ZeroClaw version: ${installedVersion}`);
  }

  if (normalizedAuditedVersion === null) {
    throw new Error(
      `Invalid audited ZeroClaw version: ${AUDITED_STABLE_VERSION}`,
    );
  }

  if (normalizedInstalledVersion === normalizedAuditedVersion) {
    return "supported_v0_6_9";
  }

  if (normalizedInstalledVersion.startsWith("0.6.")) {
    return "unaudited_v0_6_x";
  }

  if (compare(normalizedInstalledVersion, "0.7.0-0") >= 0) {
    return "unsupported_v0_7_plus";
  }

  return "unsupported_other";
}

export async function runZeroClawCommand(
  dependencies: InstallDependencies,
  args: readonly string[],
  options: ZeroClawCommandExecutionOptions = {},
  command = "zeroclaw",
) {
  return await dependencies.commands.run(command, args, {
    cwd: dependencies.runtime.cwd,
    env: options.env ?? dependencies.runtime.env,
    stdin: options.stdin,
    stdio: options.stdio,
  });
}

export async function detectZeroClaw(
  dependencies: InstallDependencies,
  command = "zeroclaw",
): Promise<ZeroClawCommandProbe> {
  let execution;

  try {
    execution = await runZeroClawCommand(
      dependencies,
      ["--version"],
      {},
      command,
    );
  } catch (cause: unknown) {
    return {
      command,
      error: cause instanceof Error ? cause.message : String(cause),
      support: "missing_command",
    };
  }

  const rawVersionOutput = `${execution.stdout}\n${execution.stderr}`.trim();
  const installedVersion = parseZeroClawVersion(rawVersionOutput);

  if (execution.exitCode !== 0 || installedVersion === null) {
    return {
      command,
      error:
        execution.exitCode !== 0
          ? rawVersionOutput ||
            `Command exited with status ${execution.exitCode}.`
          : "Could not parse the installed ZeroClaw version.",
      execution,
      rawVersionOutput,
      support: "version_unparseable",
    };
  }

  return {
    command,
    execution,
    installedVersion,
    rawVersionOutput,
    support: classifyZeroClawVersionSupport(installedVersion),
  };
}

export function sanitizeZeroClawCommandOutput(
  output: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secretValues = getSecretProviderEnvValues(getProviderEnvOverrides(env));
  let sanitized = output;

  for (const secretValue of secretValues) {
    if (!secretValue) {
      continue;
    }

    sanitized = sanitized.split(secretValue).join("[redacted]");
  }

  return sanitized;
}

function requireSuccessfulZeroClawCommand(
  output: Awaited<ReturnType<typeof runZeroClawCommand>>,
  description: string,
): string {
  if (output.exitCode !== 0) {
    throw new Error(
      `${description} failed: ${output.stderr || output.stdout || `exit ${output.exitCode}`}`,
    );
  }

  return output.stdout.trim();
}

export async function getZeroClawProperty(
  dependencies: InstallDependencies,
  path: string,
): Promise<string> {
  const execution = await runZeroClawCommand(dependencies, [
    "props",
    "get",
    path,
  ]);

  return requireSuccessfulZeroClawCommand(
    execution,
    `zeroclaw props get ${path}`,
  );
}

export async function setZeroClawPropertyNonInteractive(
  dependencies: InstallDependencies,
  path: string,
  value: string,
): Promise<void> {
  const execution = await runZeroClawCommand(dependencies, [
    "props",
    "set",
    "--no-interactive",
    path,
    value,
  ]);

  requireSuccessfulZeroClawCommand(
    execution,
    `zeroclaw props set --no-interactive ${path}`,
  );
}

export async function setZeroClawSecretProperty(
  dependencies: InstallDependencies,
  request: ZeroClawSecretWriteRequest,
): Promise<void> {
  const execution =
    request.mode === "stdin"
      ? await runZeroClawCommand(dependencies, ["props", "set", request.path], {
          stdin: `${request.secret ?? ""}\n`,
          stdio: "pipe",
        })
      : await runZeroClawCommand(dependencies, ["props", "set", request.path], {
          stdio: "inherit",
        });

  requireSuccessfulZeroClawCommand(
    execution,
    `zeroclaw props set ${request.path}`,
  );
}

export async function runZeroClawOnboardQuick(
  dependencies: InstallDependencies,
  request: ZeroClawOnboardQuickRequest,
): Promise<void> {
  const execution = await runZeroClawCommand(dependencies, [
    "onboard",
    "--quick",
    "--provider",
    request.provider,
    "--model",
    request.modelId,
  ]);

  requireSuccessfulZeroClawCommand(execution, "zeroclaw onboard --quick");
}

function parseZeroClawStatusJson(output: string): ZeroClawStatusSummary {
  const parsed = JSON.parse(output) as Record<string, unknown>;
  const gateway =
    parsed.gateway && typeof parsed.gateway === "object"
      ? (parsed.gateway as Record<string, unknown>)
      : undefined;
  const service =
    parsed.service && typeof parsed.service === "object"
      ? (parsed.service as Record<string, unknown>)
      : undefined;

  return {
    configPath: typeof parsed.config === "string" ? parsed.config : undefined,
    gatewayRunning:
      typeof gateway?.running === "boolean" ? gateway.running : undefined,
    model: typeof parsed.model === "string" ? parsed.model : undefined,
    provider: typeof parsed.provider === "string" ? parsed.provider : undefined,
    rawOutput: output,
    servicePid: typeof service?.pid === "number" ? service.pid : undefined,
    serviceStatus:
      typeof service?.status === "string" ? service.status : undefined,
    workspacePath:
      typeof parsed.workspace === "string" ? parsed.workspace : undefined,
  };
}

export async function getZeroClawStatusSummary(
  dependencies: InstallDependencies,
): Promise<ZeroClawStatusSummary> {
  const execution = await runZeroClawCommand(dependencies, [
    "status",
    "--json",
  ]);
  const output = requireSuccessfulZeroClawCommand(
    execution,
    "zeroclaw status --json",
  );

  return parseZeroClawStatusJson(
    sanitizeZeroClawCommandOutput(output, dependencies.runtime.env),
  );
}

export async function getZeroClawDoctorSummary(
  dependencies: InstallDependencies,
): Promise<ZeroClawDoctorSummary> {
  const execution = await runZeroClawCommand(dependencies, ["doctor"]);
  const output = sanitizeZeroClawCommandOutput(
    `${execution.stdout}\n${execution.stderr}`.trim(),
    dependencies.runtime.env,
  );

  return {
    exitCode: execution.exitCode,
    ok: execution.exitCode === 0,
    output,
  };
}

export function renderZeroClawSupportSummary(
  commandProbe: ZeroClawCommandProbe,
): string {
  switch (commandProbe.support) {
    case "supported_v0_6_9":
      return `supported (${commandProbe.installedVersion ?? AUDITED_STABLE_VERSION})`;
    case "missing_command":
      return `missing (${commandProbe.error ?? "unknown error"})`;
    case "version_unparseable":
      return `unparseable (${commandProbe.error ?? "unknown error"})`;
    case "unaudited_v0_6_x":
      return `unaudited ${commandProbe.installedVersion ?? "0.6.x"}`;
    case "unsupported_v0_7_plus":
      return `unsupported ${commandProbe.installedVersion ?? "v0.7+"}`;
    case "unsupported_other":
      return `unsupported ${commandProbe.installedVersion ?? "unknown version"}`;
    default:
      return "unknown";
  }
}
