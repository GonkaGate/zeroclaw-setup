import type { InstallDependencies } from "./deps.js";
import type { GonkaGateModelCatalogEntry } from "./gonkagate-models.js";

export function looksLikeGonkaGateApiKey(value: string): boolean {
  return /^gp-[A-Za-z0-9_-]{8,}$/.test(value);
}

export function canPromptInteractively(
  dependencies: Pick<InstallDependencies, "runtime">,
): boolean {
  return (
    dependencies.runtime.stdinIsTTY === true &&
    dependencies.runtime.stdoutIsTTY === true
  );
}

export async function promptForInstallModel(
  dependencies: Pick<InstallDependencies, "prompts" | "runtime">,
  models: readonly GonkaGateModelCatalogEntry[],
  initialModelId?: string,
): Promise<GonkaGateModelCatalogEntry> {
  if (!canPromptInteractively(dependencies)) {
    throw new Error(
      "Interactive install requires a TTY. Re-run in a terminal or pass --model.",
    );
  }

  const modelId = await dependencies.prompts.selectOption({
    choices: models.map((model) => ({
      description: model.name === undefined ? undefined : model.id,
      label:
        model.name === undefined ? model.id : `${model.name} (${model.id})`,
      value: model.id,
    })),
    defaultValue: initialModelId ?? models[0]?.id,
    message: "Choose a GonkaGate model",
  });

  const selectedModel = models.find((model) => model.id === modelId);

  if (selectedModel === undefined) {
    throw new Error(`Selected model "${modelId}" is not in the live catalog.`);
  }

  return selectedModel;
}

export async function promptForInstallApiKey(
  dependencies: Pick<InstallDependencies, "prompts" | "runtime">,
): Promise<string> {
  if (!canPromptInteractively(dependencies)) {
    throw new Error(
      "Interactive API key entry requires a TTY. Re-run the installer in a terminal session.",
    );
  }

  const apiKey = (
    await dependencies.prompts.readSecret("Enter your GonkaGate API key")
  ).trim();

  if (!looksLikeGonkaGateApiKey(apiKey)) {
    throw new Error("Expected a GonkaGate key that starts with gp-.");
  }

  return apiKey;
}
