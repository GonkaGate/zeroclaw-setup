import {
  DEFAULT_MODEL_KEY,
  MODEL_CATALOG,
  resolveModelByKey,
  type CuratedModel,
} from "../constants/models.js";
import type { InstallDependencies } from "./deps.js";

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
  initialModelKey?: string,
): Promise<CuratedModel> {
  if (!canPromptInteractively(dependencies)) {
    throw new Error(
      "Interactive install requires a TTY. Re-run in a terminal or pass --model.",
    );
  }

  const modelKey = await dependencies.prompts.selectOption({
    choices: MODEL_CATALOG.map((model) => ({
      description: model.description,
      label: model.recommended ? `${model.label} (recommended)` : model.label,
      value: model.key,
    })),
    defaultValue: initialModelKey ?? DEFAULT_MODEL_KEY,
    message: "Choose a curated GonkaGate model",
  });

  return resolveModelByKey(modelKey);
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
