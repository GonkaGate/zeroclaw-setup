import { ZEROCLAW_PROVIDER_KEY } from "../constants/gateway.js";
import type { EnvironmentOverride, VerifyShadowing } from "./contracts.js";

const RUNTIME_OVERRIDE_DEFINITIONS = [
  {
    isSecret: false,
    kind: "provider",
    name: "ZEROCLAW_PROVIDER",
  },
  {
    isSecret: false,
    kind: "model_provider",
    name: "ZEROCLAW_MODEL_PROVIDER",
  },
  {
    isSecret: false,
    kind: "model_provider",
    name: "MODEL_PROVIDER",
  },
  {
    isSecret: false,
    kind: "provider",
    name: "PROVIDER",
  },
  {
    isSecret: false,
    kind: "model",
    name: "ZEROCLAW_MODEL",
  },
  {
    isSecret: false,
    kind: "model",
    name: "MODEL",
  },
  {
    isSecret: true,
    kind: "api_key",
    name: "ZEROCLAW_API_KEY",
  },
  {
    isSecret: true,
    kind: "api_key",
    name: "API_KEY",
  },
] as const;

const REDACTED_OVERRIDE_VALUE = "[redacted]";

export function getProviderEnvOverrides(
  env: NodeJS.ProcessEnv = process.env,
): EnvironmentOverride[] {
  return RUNTIME_OVERRIDE_DEFINITIONS.flatMap((definition) => {
    const value = env[definition.name];

    if (!value) {
      return [];
    }

    const normalized = value.trim();

    if (!normalized) {
      return [];
    }

    return [
      {
        displayValue: definition.isSecret
          ? REDACTED_OVERRIDE_VALUE
          : normalized,
        isSecret: definition.isSecret,
        kind: definition.kind,
        name: definition.name,
        value: normalized,
      },
    ];
  });
}

export function getSecretProviderEnvValues(
  overrides: readonly EnvironmentOverride[],
): string[] {
  return overrides
    .filter((override) => override.isSecret)
    .map((override) => override.value);
}

function isEffectiveShadowingOverride(
  override: EnvironmentOverride,
  savedProvider: string | undefined,
): boolean {
  if (override.name === "PROVIDER") {
    return savedProvider !== ZEROCLAW_PROVIDER_KEY;
  }

  return true;
}

export function classifyEffectiveProviderEnvOverrides(
  overrides: readonly EnvironmentOverride[],
  savedProvider: string | undefined,
): VerifyShadowing {
  const effectiveOverrides: EnvironmentOverride[] = [];
  const ignoredOverrides: EnvironmentOverride[] = [];

  for (const override of overrides) {
    if (isEffectiveShadowingOverride(override, savedProvider)) {
      effectiveOverrides.push(override);
      continue;
    }

    ignoredOverrides.push(override);
  }

  if (effectiveOverrides.length > 0) {
    return {
      effectiveOverrides,
      hasShadowing: true,
      ignoredOverrides,
      reason:
        "Provider-related environment overrides are taking precedence over the saved GonkaGate contract.",
    };
  }

  return {
    effectiveOverrides,
    hasShadowing: false,
    ignoredOverrides,
    reason:
      ignoredOverrides.length > 0
        ? "Detected provider-related env vars are not effective shadowing overrides for the shipped explicit custom-provider contract."
        : "No effective provider-related environment shadowing was detected.",
  };
}
