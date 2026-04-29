import assert from "node:assert/strict";
import test from "node:test";
import { ZEROCLAW_PROVIDER_KEY } from "../src/constants/gateway.js";
import {
  classifyEffectiveProviderEnvOverrides,
  getProviderEnvOverrides,
  getSecretProviderEnvValues,
} from "../src/install/environment-overrides.js";

test("detects provider-related environment overrides with secret-safe display values", () => {
  const overrides = getProviderEnvOverrides({
    ZEROCLAW_PROVIDER: ZEROCLAW_PROVIDER_KEY,
    MODEL_PROVIDER: "openai-codex",
    ZEROCLAW_MODEL: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    API_KEY: "gp-example-token",
  });

  assert.deepEqual(overrides, [
    {
      displayValue: ZEROCLAW_PROVIDER_KEY,
      isSecret: false,
      kind: "provider",
      name: "ZEROCLAW_PROVIDER",
      value: ZEROCLAW_PROVIDER_KEY,
    },
    {
      displayValue: "openai-codex",
      isSecret: false,
      kind: "model_provider",
      name: "MODEL_PROVIDER",
      value: "openai-codex",
    },
    {
      displayValue: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
      isSecret: false,
      kind: "model",
      name: "ZEROCLAW_MODEL",
      value: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
    },
    {
      displayValue: "[redacted]",
      isSecret: true,
      kind: "api_key",
      name: "API_KEY",
      value: "gp-example-token",
    },
  ]);
  assert.deepEqual(getSecretProviderEnvValues(overrides), ["gp-example-token"]);
});

test("ignores empty provider-related environment overrides", () => {
  const overrides = getProviderEnvOverrides({
    ZEROCLAW_PROVIDER: "   ",
    ZEROCLAW_MODEL_PROVIDER: " ",
    PROVIDER: "",
    MODEL: "\n",
  });

  assert.deepEqual(overrides, []);
});

test("classifies explicit provider and api-key env vars as effective shadowing overrides", () => {
  const overrides = getProviderEnvOverrides({
    ZEROCLAW_PROVIDER: ZEROCLAW_PROVIDER_KEY,
    ZEROCLAW_API_KEY: "gp-example-token",
  });
  const shadowing = classifyEffectiveProviderEnvOverrides(
    overrides,
    ZEROCLAW_PROVIDER_KEY,
  );

  assert.equal(shadowing.hasShadowing, true);
  assert.deepEqual(
    shadowing.effectiveOverrides.map((override) => override.name),
    ["ZEROCLAW_PROVIDER", "ZEROCLAW_API_KEY"],
  );
  assert.deepEqual(shadowing.ignoredOverrides, []);
});

test("treats legacy PROVIDER as ignored for the shipped explicit custom provider contract", () => {
  const overrides = getProviderEnvOverrides({
    PROVIDER: "openrouter",
  });
  const shadowing = classifyEffectiveProviderEnvOverrides(
    overrides,
    ZEROCLAW_PROVIDER_KEY,
  );

  assert.equal(shadowing.hasShadowing, false);
  assert.deepEqual(shadowing.effectiveOverrides, []);
  assert.deepEqual(
    shadowing.ignoredOverrides.map((override) => override.name),
    ["PROVIDER"],
  );
});
