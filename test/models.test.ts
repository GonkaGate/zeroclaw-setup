import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MODEL_KEY,
  MODEL_CATALOG,
  resolveModelByKey,
} from "../src/constants/models.js";

test("default model exists in the catalog", () => {
  const model = resolveModelByKey(DEFAULT_MODEL_KEY);

  assert.equal(DEFAULT_MODEL_KEY, "kimi-k2.6");
  assert.equal(model.key, DEFAULT_MODEL_KEY);
  assert.equal(model.recommended, true);
});

test("model catalog keys are unique", () => {
  const keys = MODEL_CATALOG.map((model) => model.key);
  const uniqueKeys = new Set(keys);

  assert.equal(uniqueKeys.size, keys.length);
});

test("unsupported model key throws a helpful error", () => {
  assert.throws(() => resolveModelByKey("missing-model"), /Supported keys/);
});

test("curated model catalog exposes supported GonkaGate models", () => {
  assert.deepEqual(
    MODEL_CATALOG.map((model) => ({
      key: model.key,
      modelId: model.modelId,
      recommended: model.recommended ?? false,
    })),
    [
      {
        key: "qwen3-235b",
        modelId: "qwen/qwen3-235b-a22b-instruct-2507-fp8",
        recommended: false,
      },
      {
        key: "kimi-k2.6",
        modelId: "moonshotai/Kimi-K2.6",
        recommended: true,
      },
    ],
  );
});
