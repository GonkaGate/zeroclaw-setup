export interface CuratedModel {
  readonly key: string;
  readonly label: string;
  readonly modelId: string;
  readonly description: string;
  readonly recommended?: boolean;
}

const MODEL_CATALOG_DATA = [
  {
    key: "qwen3-235b",
    label: "Qwen3 235B",
    modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    description:
      "Original launch model for the first GonkaGate-backed ZeroClaw flow.",
  },
  {
    key: "kimi-k2.6",
    label: "Kimi K2.6",
    modelId: "moonshotai/Kimi-K2.6",
    description:
      "Recommended Moonshot AI Kimi K2.6 model for GonkaGate-backed ZeroClaw flows.",
    recommended: true,
  },
] as const satisfies readonly CuratedModel[];

export const MODEL_CATALOG: readonly CuratedModel[] = Object.freeze(
  MODEL_CATALOG_DATA.map((model) => ({ ...model })),
);

export const DEFAULT_MODEL_KEY =
  MODEL_CATALOG.find((model) => model.recommended)?.key ?? MODEL_CATALOG[0].key;

export function resolveModelByKey(modelKey: string | undefined): CuratedModel {
  const resolvedKey = modelKey ?? DEFAULT_MODEL_KEY;
  const model = MODEL_CATALOG.find(
    (candidate) => candidate.key === resolvedKey,
  );

  if (!model) {
    const supportedKeys = MODEL_CATALOG.map((candidate) => candidate.key).join(
      ", ",
    );
    throw new Error(
      `Unsupported model key "${resolvedKey}". Supported keys: ${supportedKeys}.`,
    );
  }

  return model;
}

export function getSupportedModelKeys(): string[] {
  return MODEL_CATALOG.map((model) => model.key);
}

export function resolveModelById(
  modelId: string | undefined,
): CuratedModel | undefined {
  if (modelId === undefined) {
    return undefined;
  }

  return MODEL_CATALOG.find((candidate) => candidate.modelId === modelId);
}
