import assert from "node:assert/strict";
import test from "node:test";
import { createProgram } from "../src/cli.js";
import { runInstallUseCase } from "../src/install/install-use-case.js";
import { createInstallHarness } from "./install/harness.js";

test("install CLI keeps the live --model flag surface", () => {
  const help = createProgram().helpInformation();

  assert.match(help, /--model <id>/);
  assert.match(help, /live \/v1\/models catalog/);
});

test("unsupported --model values fail only after live catalog validation", async () => {
  const harness = await createInstallHarness();
  let secretPromptCalls = 0;
  let modelPromptCalls = 0;

  try {
    await harness.installFakeZeroClawOnPath();

    const dependencies = harness.createDependencies({
      prompts: {
        async readSecret() {
          secretPromptCalls += 1;
          return "gp-live-catalog-secret";
        },
        async selectOption<TValue extends string>() {
          modelPromptCalls += 1;
          return "live/test-default-model" as TValue;
        },
      },
    });

    const result = await runInstallUseCase(
      {
        model: "live/missing-model",
      },
      dependencies,
    );

    assert.equal(result.status, "blocked");
    assert.match(result.reason, /Selected model "live\/missing-model"/);
    assert.equal(secretPromptCalls, 1);
    assert.equal(modelPromptCalls, 0);
    assert.deepEqual(await harness.readFakeZeroClawInvocations(), [
      ["--version"],
      ["status", "--json"],
    ]);
  } finally {
    await harness.cleanup();
  }
});
