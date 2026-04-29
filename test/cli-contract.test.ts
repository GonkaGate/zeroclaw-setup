import assert from "node:assert/strict";
import test from "node:test";
import { createProgram } from "../src/cli.js";
import { runInstallUseCase } from "../src/install/install-use-case.js";
import { createInstallHarness } from "./install/harness.js";

test("install CLI keeps the curated --model flag surface", () => {
  const help = createProgram().helpInformation();

  assert.match(help, /--model <key>/);
  assert.match(help, /Curated GonkaGate model key/);
});

test("unsupported --model values fail before prompts or zeroclaw writes", async () => {
  const harness = await createInstallHarness();
  let promptCalls = 0;

  try {
    const dependencies = harness.createDependencies({
      prompts: {
        async readSecret() {
          promptCalls += 1;
          return "gp-should-not-be-used";
        },
        async selectOption<TValue extends string>() {
          promptCalls += 1;
          return "qwen3-235b" as TValue;
        },
      },
    });

    await assert.rejects(
      () =>
        runInstallUseCase(
          {
            model: "not-a-curated-model",
          },
          dependencies,
        ),
      /Unsupported model key/u,
    );
    assert.equal(promptCalls, 0);
    assert.deepEqual(await harness.readFakeZeroClawInvocations(), []);
  } finally {
    await harness.cleanup();
  }
});
