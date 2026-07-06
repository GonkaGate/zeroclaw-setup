import {
  GONKAGATE_BASE_URL,
  ZEROCLAW_PROVIDER_KEY,
} from "../constants/gateway.js";
import type {
  FirstRunCandidateReport,
  FirstRunProofSummary,
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

export interface EvaluateFirstRunCandidateRequest {
  readonly modelId: string;
  readonly secret?: string;
  readonly transport: SecretTransportMode;
}

const FIRST_RUN_COMMAND_TUPLE = Object.freeze([
  `zeroclaw onboard --quick --provider ${ZEROCLAW_PROVIDER_KEY} --model <model-id>`,
  "zeroclaw props set api-key",
]);

const SHIPPED_FIRST_RUN_PROOF = Object.freeze<FirstRunProofSummary>({
  candidateReports: [
    {
      commandTuple: FIRST_RUN_COMMAND_TUPLE,
      outcome: "failed",
      reason:
        "stdin-fed secret writes remain unproven for stable v0.6.9 because `zeroclaw props set api-key` uses the native masked prompt path rather than a documented stdin contract.",
      secretTransport: "stdin",
    },
    {
      commandTuple: FIRST_RUN_COMMAND_TUPLE,
      outcome: "proven",
      reason:
        "Stable v0.6.9 can initialize first-run config through `zeroclaw onboard --quick` without putting the GonkaGate API key on argv, then persist `api-key` through the native masked `zeroclaw props set api-key` seam.",
      secretTransport: "native_prompt",
    },
  ],
  commandTuple: FIRST_RUN_COMMAND_TUPLE,
  reason:
    "Shipped first-run support is limited to the `onboard --quick` plus native masked `props set api-key` sequence on audited stable v0.6.9.",
  state: "proven",
  supportedTransport: "native_prompt",
});

function createFailureReport(
  request: EvaluateFirstRunCandidateRequest,
  reason: string,
): FirstRunCandidateReport {
  return {
    commandTuple: FIRST_RUN_COMMAND_TUPLE,
    outcome: "failed",
    reason,
    secretTransport: request.transport,
  };
}

function validateFirstRunInspection(
  inspection: SavedConfigInspection,
  workspaceExists: boolean,
  modelId: string,
): string | undefined {
  if (!workspaceExists) {
    return "The candidate did not materialize the resolved ZeroClaw workspace directory.";
  }

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
    return "Expected saved api_key evidence to be set after the hidden secret write.";
  }

  return undefined;
}

export async function evaluateFirstRunCandidate(
  dependencies: InstallDependencies,
  request: EvaluateFirstRunCandidateRequest,
): Promise<FirstRunCandidateReport> {
  try {
    await runZeroClawOnboardQuick(dependencies, {
      modelId: request.modelId,
      provider: ZEROCLAW_PROVIDER_KEY,
    });
    await setZeroClawSecretProperty(dependencies, {
      mode: request.transport,
      path: "api-key",
      secret: request.secret,
    });
  } catch (cause) {
    return createFailureReport(
      request,
      cause instanceof Error ? cause.message : String(cause),
    );
  }

  const resolvedConfig = await resolveActiveZeroClawConfig(dependencies);
  const inspection = await inspectSavedZeroClawConfig(
    dependencies,
    resolvedConfig,
  );
  const workspaceExists = await dependencies.fs.pathExists(
    resolvedConfig.workspacePath,
  );
  const validationError = validateFirstRunInspection(
    inspection,
    workspaceExists,
    request.modelId,
  );

  if (validationError !== undefined) {
    return createFailureReport(request, validationError);
  }

  return {
    commandTuple: FIRST_RUN_COMMAND_TUPLE,
    outcome: "proven",
    reason: `The candidate initialized ${GONKAGATE_BASE_URL} as the saved custom-provider contract without placing the API key on argv.`,
    secretTransport: request.transport,
  };
}

export function getShippedFirstRunProof(): FirstRunProofSummary {
  return SHIPPED_FIRST_RUN_PROOF;
}
