import type {
  InstallProcessInfo,
  NativeRuntimeSignal,
  RuntimeProcessMatch,
  RuntimeQuiesceInspection,
} from "./contracts.js";
import type { InstallDependencies } from "./deps.js";
import { getZeroClawStatusSummary } from "./zeroclaw-command.js";

const ACTIVE_SERVICE_STATUS_PATTERN = /\b(active|running)\b/u;
const QUIESCED_SERVICE_STATUS_PATTERN = /\b(inactive|stopped|dead|failed)\b/u;

function isCandidateRuntimeProcess(processInfo: InstallProcessInfo): boolean {
  const commandLine = processInfo.commandLine.toLowerCase();

  if (!commandLine.includes("zeroclaw")) {
    return false;
  }

  if (
    commandLine.includes(" props ") ||
    commandLine.includes(" status ") ||
    commandLine.includes(" doctor ") ||
    commandLine.includes(" onboard ")
  ) {
    return false;
  }

  return (
    commandLine.includes(" daemon") ||
    commandLine.includes(" gateway") ||
    commandLine.includes(" service start") ||
    commandLine.includes(" service restart")
  );
}

async function inspectNativeRuntimeSignal(
  dependencies: InstallDependencies,
): Promise<NativeRuntimeSignal> {
  try {
    const summary = await getZeroClawStatusSummary(dependencies);

    if (summary.gatewayRunning === true) {
      return {
        rawOutput: summary.rawOutput,
        reason: "zeroclaw status reports a running gateway.",
        status: "active",
        summary,
      };
    }

    if (
      typeof summary.serviceStatus === "string" &&
      ACTIVE_SERVICE_STATUS_PATTERN.test(summary.serviceStatus)
    ) {
      return {
        rawOutput: summary.rawOutput,
        reason: `zeroclaw status reports service status "${summary.serviceStatus}".`,
        status: "active",
        summary,
      };
    }

    if (
      summary.servicePid !== undefined &&
      Number.isFinite(summary.servicePid) &&
      summary.servicePid > 0
    ) {
      return {
        rawOutput: summary.rawOutput,
        reason: `zeroclaw status reports a live service PID (${summary.servicePid}).`,
        status: "active",
        summary,
      };
    }

    if (
      summary.gatewayRunning === false &&
      (summary.serviceStatus === undefined ||
        QUIESCED_SERVICE_STATUS_PATTERN.test(summary.serviceStatus))
    ) {
      return {
        rawOutput: summary.rawOutput,
        reason: "zeroclaw status reports no running gateway or service.",
        status: "quiesced",
        summary,
      };
    }

    return {
      rawOutput: summary.rawOutput,
      reason:
        "zeroclaw status completed, but the runtime activity fields were too ambiguous to trust for safe mutation.",
      status: "ambiguous",
      summary,
    };
  } catch (cause) {
    return {
      reason: `zeroclaw status --json could not establish runtime state: ${cause instanceof Error ? cause.message : String(cause)}`,
      status: "ambiguous",
    };
  }
}

export async function inspectRuntimeQuiesce(
  dependencies: InstallDependencies,
): Promise<RuntimeQuiesceInspection> {
  const nativeSignal = await inspectNativeRuntimeSignal(dependencies);

  if (nativeSignal.status === "active") {
    return {
      nativeSignal,
      processMatches: [],
      reason: nativeSignal.reason,
      status: "active",
    };
  }

  let processes: readonly InstallProcessInfo[];

  try {
    processes = await dependencies.processes.listCurrentUserProcesses();
  } catch (cause) {
    return {
      nativeSignal,
      processMatches: [],
      reason: `Local runtime process inspection was ambiguous: ${cause instanceof Error ? cause.message : String(cause)}`,
      status: "ambiguous",
    };
  }

  const processMatches: RuntimeProcessMatch[] = processes
    .filter(isCandidateRuntimeProcess)
    .map((processInfo) => ({
      commandLine: processInfo.commandLine,
      pid: processInfo.pid,
    }));

  if (processMatches.length > 0) {
    return {
      nativeSignal,
      processMatches,
      reason:
        "Local process inspection found candidate ZeroClaw runtime processes for the current user.",
      status: "active",
    };
  }

  if (nativeSignal.status === "ambiguous") {
    return {
      nativeSignal,
      processMatches,
      reason: nativeSignal.reason,
      status: "ambiguous",
    };
  }

  return {
    nativeSignal,
    processMatches,
    reason:
      "zeroclaw status and local process inspection both indicate a quiesced runtime.",
    status: "quiesced",
  };
}
