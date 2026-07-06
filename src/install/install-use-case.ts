import type {
  ConfigMutationPreflight,
  GonkaGateLiveCatalogSummary,
  InstallBlockedResult,
  InstallFailedResult,
  InstallPath,
  InstallResult,
  InstallScaffoldResult,
  InstallSuccessResult,
  NativeWriteFailure,
  NativeWriteSuccess,
  SavedConfigInspection,
  SecretTransportMode,
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
import { getProviderEnvOverrides } from "./environment-overrides.js";
import { runFirstRunInstall } from "./first-run-install.js";
import { getShippedFirstRunProof } from "./first-run-proof.js";
import {
  fetchGonkaGateModelCatalog,
  type GonkaGateModelCatalog,
  type GonkaGateModelCatalogEntry,
  type GonkaGateModelsError,
  requireModelInGonkaGateCatalog,
} from "./gonkagate-models.js";
import { MANAGED_CONFIG_FIELDS } from "./managed-contract.js";
import { runExistingConfigMutation } from "./native-write.js";
import {
  canPromptInteractively,
  looksLikeGonkaGateApiKey,
  promptForInstallApiKey,
  promptForInstallModel,
} from "./prompts.js";
import { inspectRuntimeQuiesce } from "./runtime-quiesce.js";
import {
  detectZeroClaw,
  renderZeroClawSupportSummary,
} from "./zeroclaw-command.js";
import { renderInstallResult } from "./install-render.js";

export interface InstallOptions {
  readonly apiKey?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly interactive?: boolean;
  readonly model?: string;
}

interface InstallContext {
  readonly commandProbe: Awaited<ReturnType<typeof detectZeroClaw>>;
  readonly configInspection?: SavedConfigInspection;
  readonly firstRunProof: ReturnType<typeof getShippedFirstRunProof>;
  readonly installDependencies: InstallDependencies;
  readonly overrides: ReturnType<typeof getProviderEnvOverrides>;
  readonly preflight: ConfigMutationPreflight;
}

function createUnsupportedVersionPreflight(): ConfigMutationPreflight {
  return {
    outcome: "unsupported_version",
    reason:
      "ZeroClaw is missing, unparseable, or older than the supported minimum runtime.",
    unknownTopLevelKeys: [],
  };
}

function createInstallContextResultBase(
  context: InstallContext,
  path: InstallPath,
  selectedModel?: GonkaGateModelCatalogEntry,
  liveCatalog?: GonkaGateLiveCatalogSummary,
) {
  return {
    commandProbe: context.commandProbe,
    configInspection: context.configInspection,
    firstRunProof: context.firstRunProof,
    liveCatalog,
    managedFields: MANAGED_CONFIG_FIELDS,
    overrides: context.overrides,
    path,
    preflight: context.preflight,
    selectedModel,
  };
}

function createBlockedResult(
  context: InstallContext,
  path: InstallPath,
  reason: string,
  selectedModel?: GonkaGateModelCatalogEntry,
  remediation?: string,
  liveCatalog?: GonkaGateLiveCatalogSummary,
): InstallBlockedResult {
  return {
    ...createInstallContextResultBase(
      context,
      path,
      selectedModel,
      liveCatalog,
    ),
    reason,
    remediation,
    status: "blocked",
  };
}

function createScaffoldResult(
  context: InstallContext,
  path: InstallPath,
  reason: string,
  selectedModel?: GonkaGateModelCatalogEntry,
  remediation?: string,
  liveCatalog?: GonkaGateLiveCatalogSummary,
): InstallScaffoldResult {
  return {
    ...createInstallContextResultBase(
      context,
      path,
      selectedModel,
      liveCatalog,
    ),
    reason,
    remediation,
    status: "scaffold",
  };
}

function createFailedResult(
  context: InstallContext,
  path: InstallPath,
  reason: string,
  writeResult: NativeWriteFailure,
  selectedModel: GonkaGateModelCatalogEntry,
  liveCatalog: GonkaGateLiveCatalogSummary,
): InstallFailedResult {
  return {
    ...createInstallContextResultBase(
      context,
      path,
      selectedModel,
      liveCatalog,
    ),
    reason,
    remediation: writeResult.remediation,
    status: "failed",
    writeResult,
  };
}

function createSuccessResult(
  context: InstallContext,
  path: Exclude<InstallPath, "none">,
  selectedModel: GonkaGateModelCatalogEntry,
  writeResult: NativeWriteSuccess,
  liveCatalog: GonkaGateLiveCatalogSummary,
): InstallSuccessResult {
  return {
    ...createInstallContextResultBase(
      context,
      path,
      selectedModel,
      liveCatalog,
    ),
    configInspection: writeResult.confirmedInspection,
    path,
    selectedModel,
    status: "success",
    writeResult,
  };
}

async function loadInstallContext(
  options: InstallOptions,
  dependencies?: InstallDependencies,
): Promise<InstallContext> {
  const installDependencies =
    dependencies ??
    createNodeInstallDependencies({
      runtime: {
        env: options.env,
      },
    });
  const commandProbe = await detectZeroClaw(installDependencies);
  const overrides = getProviderEnvOverrides(installDependencies.runtime.env);
  const firstRunProof = getShippedFirstRunProof();
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

  return {
    commandProbe,
    configInspection,
    firstRunProof,
    installDependencies,
    overrides,
    preflight,
  };
}

async function resolveSelectedModel(
  context: InstallContext,
  options: InstallOptions,
  catalog: GonkaGateModelCatalog,
): Promise<GonkaGateModelCatalogEntry> {
  if (options.model !== undefined) {
    return requireModelInGonkaGateCatalog(options.model, catalog);
  }

  if (
    options.interactive === false ||
    !canPromptInteractively(context.installDependencies)
  ) {
    const firstLiveModel = catalog.models[0];

    if (firstLiveModel === undefined) {
      throw new Error("GonkaGate did not return any selectable models.");
    }

    return firstLiveModel;
  }

  return await promptForInstallModel(
    context.installDependencies,
    catalog.models,
  );
}

async function resolveCatalogCredentialAndSecretTransport(
  context: InstallContext,
  options: InstallOptions,
): Promise<{
  readonly apiKey: string;
  readonly mode: SecretTransportMode;
  readonly secret?: string;
}> {
  if (typeof options.apiKey === "string") {
    const apiKey = options.apiKey.trim();

    if (!looksLikeGonkaGateApiKey(apiKey)) {
      throw new Error("Expected a GonkaGate key that starts with gp-.");
    }

    return {
      apiKey,
      mode: "stdin",
      secret: apiKey,
    };
  }

  if (
    options.interactive === false ||
    !canPromptInteractively(context.installDependencies)
  ) {
    throw new Error(
      "Hidden GonkaGate API key entry requires an interactive terminal for the native `zeroclaw props set api-key` prompt.",
    );
  }

  const apiKey = await promptForInstallApiKey(context.installDependencies);

  return {
    apiKey,
    mode: "native_prompt",
  };
}

async function loadLiveCatalog(
  context: InstallContext,
  apiKey: string,
): Promise<GonkaGateModelCatalog> {
  return await fetchGonkaGateModelCatalog(apiKey, {
    fetchImpl: context.installDependencies.http.fetch,
  });
}

function summarizeLiveCatalog(
  catalog: GonkaGateModelCatalog,
): GonkaGateLiveCatalogSummary {
  return {
    endpoint: catalog.endpoint,
    liveModelCount: catalog.liveModelCount,
    modelIds: catalog.models.map((model) => model.id),
  };
}

function getUnsupportedFirstRunTransportResult(
  context: InstallContext,
  path: Extract<InstallPath, "first_run">,
  selectedModel: GonkaGateModelCatalogEntry,
  secretTransport: SecretTransportMode,
): InstallBlockedResult | undefined {
  const supportedTransport = context.firstRunProof.supportedTransport;

  if (
    context.firstRunProof.state !== "proven" ||
    supportedTransport === undefined ||
    secretTransport === supportedTransport
  ) {
    return undefined;
  }

  return createBlockedResult(
    context,
    path,
    `First-run mutation on audited ZeroClaw v0.6.9 is shipped only for the proven hidden native api-key prompt path. Received ${secretTransport} transport instead of ${supportedTransport}.`,
    selectedModel,
    "Re-run the installer interactively so ZeroClaw can collect the API key through its hidden native `zeroclaw props set api-key` prompt.",
  );
}

function chooseInstallPath(context: InstallContext): {
  readonly path: InstallPath;
  readonly result?: InstallResult;
} {
  switch (context.preflight.outcome) {
    case "eligible_existing_config":
      return { path: "existing_config" };
    case "eligible_first_run":
      if (context.firstRunProof.state === "proven") {
        return { path: "first_run" };
      }

      return {
        path: "first_run",
        result: createScaffoldResult(
          context,
          "first_run",
          context.firstRunProof.reason,
        ),
      };
    case "unsupported_version":
    case "config_unreadable":
    case "unsupported_shape_unknown_top_level_keys":
    default:
      return {
        path: "none",
        result: createBlockedResult(context, "none", context.preflight.reason),
      };
  }
}

async function runMutatingInstallPath(
  context: InstallContext,
  options: InstallOptions,
  path: Exclude<InstallPath, "none">,
): Promise<InstallResult> {
  const quiesceInspection = await inspectRuntimeQuiesce(
    context.installDependencies,
  );

  if (quiesceInspection.status !== "quiesced") {
    return createBlockedResult(
      context,
      path,
      quiesceInspection.reason,
      undefined,
      "Stop ZeroClaw runtime processes and re-run the installer. The wrapper will not mutate config while runtime state is active or ambiguous.",
    );
  }

  let secretTransport: {
    readonly apiKey: string;
    readonly mode: SecretTransportMode;
    readonly secret?: string;
  };

  try {
    secretTransport = await resolveCatalogCredentialAndSecretTransport(
      context,
      options,
    );
  } catch (cause) {
    return createBlockedResult(
      context,
      path,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  let liveCatalog: GonkaGateModelCatalog;

  try {
    liveCatalog = await loadLiveCatalog(context, secretTransport.apiKey);
  } catch (cause) {
    return createBlockedResult(
      context,
      path,
      cause instanceof Error ? cause.message : String(cause),
      undefined,
      cause instanceof Error && "kind" in cause
        ? `Resolve the GonkaGate ${(cause as GonkaGateModelsError).kind} issue and rerun the installer before any ZeroClaw config is mutated.`
        : undefined,
    );
  }

  const liveCatalogSummary = summarizeLiveCatalog(liveCatalog);
  let selectedModel: GonkaGateModelCatalogEntry;

  try {
    selectedModel = await resolveSelectedModel(context, options, liveCatalog);
  } catch (cause) {
    return createBlockedResult(
      context,
      path,
      cause instanceof Error ? cause.message : String(cause),
      undefined,
      undefined,
      liveCatalogSummary,
    );
  }

  if (path === "first_run") {
    const unsupportedTransportResult = getUnsupportedFirstRunTransportResult(
      context,
      path,
      selectedModel,
      secretTransport.mode,
    );

    if (unsupportedTransportResult !== undefined) {
      return unsupportedTransportResult;
    }
  }

  const writeResult =
    path === "existing_config"
      ? await runExistingConfigMutation(context.installDependencies, {
          modelId: selectedModel.id,
          quiesceInspection,
          secret: secretTransport.secret,
          secretTransport: secretTransport.mode,
        })
      : await runFirstRunInstall(context.installDependencies, {
          modelId: selectedModel.id,
          secret: secretTransport.secret,
          secretTransport: secretTransport.mode,
        });

  if (writeResult.status === "success") {
    return createSuccessResult(
      context,
      path,
      selectedModel,
      writeResult,
      liveCatalogSummary,
    );
  }

  return createFailedResult(
    context,
    path,
    writeResult.reason,
    writeResult,
    selectedModel,
    liveCatalogSummary,
  );
}

export async function runInstallUseCase(
  options: InstallOptions = {},
  dependencies?: InstallDependencies,
): Promise<InstallResult> {
  const context = await loadInstallContext(options, dependencies);
  const pathSelection = chooseInstallPath(context);

  if (pathSelection.result !== undefined || pathSelection.path === "none") {
    return pathSelection.result as InstallResult;
  }

  return await runMutatingInstallPath(context, options, pathSelection.path);
}

export { renderInstallResult, renderZeroClawSupportSummary };
