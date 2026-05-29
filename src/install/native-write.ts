import { ZEROCLAW_PROVIDER_KEY } from "../constants/gateway.js";
import type {
  NativeWriteResult,
  NativeWriteSnapshot,
  RestoreStatus,
  RuntimeQuiesceInspection,
  SavedConfigInspection,
  SecretTransportMode,
} from "./contracts.js";
import type { InstallDependencies } from "./deps.js";
import {
  inspectSavedZeroClawConfig,
  resolveActiveZeroClawConfig,
} from "./config-resolution.js";
import {
  getZeroClawProperty,
  setZeroClawPropertyNonInteractive,
  setZeroClawSecretProperty,
} from "./zeroclaw-command.js";

export interface ExistingConfigMutationRequest {
  readonly modelId: string;
  readonly quiesceInspection: RuntimeQuiesceInspection;
  readonly secret?: string;
  readonly secretTransport: SecretTransportMode;
}

function confirmSavedManagedContract(
  inspection: SavedConfigInspection,
  modelId: string,
): string | undefined {
  if (inspection.status !== "inspected") {
    return `Expected an inspected saved config after mutation, received ${inspection.status}.`;
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

async function snapshotManagedFields(
  dependencies: InstallDependencies,
): Promise<NativeWriteSnapshot> {
  const [defaultProvider, defaultModel] = await Promise.all([
    getZeroClawProperty(dependencies, "default-provider"),
    getZeroClawProperty(dependencies, "default-model"),
  ]);

  return {
    defaultModel,
    defaultProvider,
  };
}

async function restoreNonSecretFields(
  dependencies: InstallDependencies,
  snapshot: NativeWriteSnapshot,
): Promise<Extract<RestoreStatus, "restore_failed" | "restored_non_secret">> {
  try {
    await setZeroClawPropertyNonInteractive(
      dependencies,
      "default-provider",
      snapshot.defaultProvider,
    );
    await setZeroClawPropertyNonInteractive(
      dependencies,
      "default-model",
      snapshot.defaultModel,
    );

    return "restored_non_secret";
  } catch {
    return "restore_failed";
  }
}

export async function runExistingConfigMutation(
  dependencies: InstallDependencies,
  request: ExistingConfigMutationRequest,
): Promise<NativeWriteResult> {
  if (request.quiesceInspection.status !== "quiesced") {
    return {
      failedStage: "quiesce",
      reason: request.quiesceInspection.reason,
      remediation:
        "Stop ZeroClaw gateway/daemon processes and re-run the installer. If you need the native fallback, run `zeroclaw onboard` and choose provider-only update mode.",
      restoreStatus: "not_attempted",
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }

  let snapshot: NativeWriteSnapshot;

  try {
    snapshot = await snapshotManagedFields(dependencies);
  } catch (cause) {
    return {
      failedStage: "snapshot",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "The current default-provider/default-model values could not be snapshotted through the native props seam, so no provider mutation was attempted.",
      restoreStatus: "not_attempted",
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }

  try {
    await setZeroClawPropertyNonInteractive(
      dependencies,
      "default-provider",
      ZEROCLAW_PROVIDER_KEY,
    );
  } catch (cause) {
    const restoreStatus = await restoreNonSecretFields(dependencies, snapshot);

    return {
      failedStage: "default-provider",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "ZeroClaw could not update default-provider through the native props seam. The native provider-only onboarding fallback remains available via `zeroclaw onboard`.",
      restoreStatus,
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }

  try {
    await setZeroClawPropertyNonInteractive(
      dependencies,
      "default-model",
      request.modelId,
    );
  } catch (cause) {
    const restoreStatus = await restoreNonSecretFields(dependencies, snapshot);

    return {
      failedStage: "default-model",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "ZeroClaw could not update default-model through the native props seam. The previous non-secret fields were restored when possible.",
      restoreStatus,
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
    const restoreStatus = await restoreNonSecretFields(dependencies, snapshot);

    return {
      failedStage: "api-key",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "The previous non-secret fields were restored when possible, but ZeroClaw does not expose the prior api-key value for automatic recovery. Re-run `zeroclaw props set api-key` or the installer to set the desired secret.",
      restoreStatus,
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
    const contractError = confirmSavedManagedContract(
      inspection,
      request.modelId,
    );

    if (contractError !== undefined) {
      const restoreStatus = await restoreNonSecretFields(
        dependencies,
        snapshot,
      );

      return {
        failedStage: "confirm",
        reason: contractError,
        remediation:
          "The previous non-secret fields were restored when possible, but the native secret seam does not expose the prior api-key value for automatic recovery.",
        restoreStatus,
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
    const restoreStatus = await restoreNonSecretFields(dependencies, snapshot);

    return {
      failedStage: "confirm",
      reason: cause instanceof Error ? cause.message : String(cause),
      remediation:
        "The saved config could not be re-inspected after the native write sequence. The previous non-secret fields were restored when possible.",
      restoreStatus,
      secretTransport: request.secretTransport,
      status: "failed",
    };
  }
}
