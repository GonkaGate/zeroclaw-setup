import { ZEROCLAW_PROVIDER_KEY } from "../constants/gateway.js";
import type {
  NativeWriteResult,
  SavedConfigInspection,
  SecretTransportMode,
} from "./contracts.js";
import type { InstallDependencies } from "./deps.js";
import {
  inspectSavedZeroClawConfig,
  resolveActiveZeroClawConfig,
} from "./config-resolution.js";
import {
  runZeroClawOnboardQuick,
  setZeroClawSecretProperty,
} from "./zeroclaw-command.js";

export interface FirstRunInstallRequest {
  readonly modelId: string;
  readonly secret?: string;
  readonly secretTransport: SecretTransportMode;
}

function confirmFirstRunContract(
  inspection: SavedConfigInspection,
  modelId: string,
): string | undefined {
  if (inspection.status !== "inspected") {
    return `Expected an inspected saved config after first-run setup, received ${inspection.status}.`;
  }

  if (inspection.defaultProvider !== ZEROCLAW_PROVIDER_KEY) {
    return `Expected saved default_provider ${ZEROCLAW_PROVIDER_KEY}, received ${inspection.defaultProvider ?? "<unset>"}.`;
  }

  if (inspection.defaultModel !== modelId) {
    return `Expected saved default_model ${modelId}, received ${inspection.defaultModel ?? "<unset>"}.`;
  }

  if (inspection.apiKeyState !== "set") {
    return "Expected saved api_key evidence to be set after the native secret write.";
  }

  return undefined;
}

export async function runFirstRunInstall(
  dependencies: InstallDependencies,
  request: FirstRunInstallRequest,
): Promise<NativeWriteResult> {
  try {
    await runZeroClawOnboardQuick(dependencies, {
      modelId: request.modelId,
      provider: ZEROCLAW_PROVIDER_KEY,
    });
  } catch (cause) {
    return {
      failedStage: "quick-onboard",
      reason: cause instanceof Error ? cause.message : String(cause),
      restoreStatus: "not_attempted",
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }

  try {
    await setZeroClawSecretProperty(dependencies, {
      mode: request.secretTransport,
      path: "api-key",
      secret: request.secret,
    });
  } catch (cause) {
    return {
      failedStage: "api-key",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "The non-secret first-run setup completed, but the hidden api-key write did not. Re-run the installer in a terminal or run `zeroclaw props set api-key` manually.",
      restoreStatus: "not_attempted",
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }

  try {
    const resolvedConfig = await resolveActiveZeroClawConfig(dependencies);
    const inspection = await inspectSavedZeroClawConfig(
      dependencies,
      resolvedConfig,
    );
    const contractError = confirmFirstRunContract(inspection, request.modelId);

    if (contractError !== undefined) {
      return {
        failedStage: "confirm",
        reason: contractError,
        remediation:
          "First-run setup wrote config, but the saved GonkaGate contract could not be confirmed. Run `npx zeroclaw-setup verify` or inspect the saved config manually.",
        restoreStatus: "not_attempted",
        secretTransport: request.secretTransport,
        status: "failed",
      };
    }

    return {
      confirmedInspection: inspection,
      restoreStatus: "restore_unneeded",
      secretTransport: request.secretTransport,
      status: "success",
    };
  } catch (cause) {
    return {
      failedStage: "confirm",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "First-run setup completed, but the saved config could not be re-inspected safely afterward.",
      restoreStatus: "not_attempted",
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }
}
