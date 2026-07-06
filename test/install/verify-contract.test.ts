import assert from "node:assert/strict";
import test from "node:test";
import { ZEROCLAW_PROVIDER_KEY } from "../../src/constants/gateway.js";
import { runVerifyUseCase } from "../../src/install/verify-use-case.js";
import { createInstallHarness } from "./harness.js";

const TEST_SAVED_MODEL_ID = "live/saved-model";

function createManagedConfig(apiKey = "gp-saved-secret"): string {
  return [
    `default_provider = "${ZEROCLAW_PROVIDER_KEY}"`,
    `default_model = "${TEST_SAVED_MODEL_ID}"`,
    `api_key = "${apiKey}"`,
  ].join("\n");
}

test("verify returns pass when saved config and runtime evidence agree", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig(),
    );

    const result = await runVerifyUseCase({}, harness.createDependencies());

    assert.equal(result.status, "pass");
    assert.equal(result.savedContract.ok, true);
    assert.equal(result.shadowing.hasShadowing, false);
    assert.equal(result.runtimeStatus.ok, true);
    assert.equal(result.doctorAdvisory.attempted, true);
  } finally {
    await harness.cleanup();
  }
});

test("verify returns warn-shadowed when effective env overrides shadow an otherwise valid saved config", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        status: {
          json: {
            config: harness.createPath("home/.zeroclaw/config.toml"),
            gateway: { running: false },
            model: "overridden/model",
            provider: ZEROCLAW_PROVIDER_KEY,
            service: { status: "inactive" },
            workspace: harness.createPath("home/.zeroclaw/workspace"),
          },
        },
      },
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig(),
    );

    const result = await runVerifyUseCase(
      {},
      harness.createDependencies({
        runtime: {
          env: {
            ZEROCLAW_MODEL: "overridden/model",
          },
        },
      }),
    );

    assert.equal(result.status, "warn-shadowed");
    assert.equal(result.savedContract.ok, true);
    assert.equal(result.shadowing.hasShadowing, true);
    assert.equal(result.runtimeStatus.ok, true);
    assert.equal(result.runtimeStatus.shadowExplainedMismatch, true);
  } finally {
    await harness.cleanup();
  }
});

test("verify fails when the saved api_key is unset", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig("   "),
    );

    const result = await runVerifyUseCase({}, harness.createDependencies());

    assert.equal(result.status, "fail");
    assert.equal(result.savedContract.ok, false);
    assert.match(result.savedContract.reason, /api_key/i);
  } finally {
    await harness.cleanup();
  }
});

test("verify fails when zeroclaw status resolves a different config path", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        status: {
          json: {
            config: harness.createPath("wrong/config.toml"),
            gateway: { running: false },
            model: TEST_SAVED_MODEL_ID,
            provider: ZEROCLAW_PROVIDER_KEY,
            service: { status: "inactive" },
            workspace: harness.createPath("wrong/workspace"),
          },
        },
      },
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig(),
    );

    const result = await runVerifyUseCase({}, harness.createDependencies());

    assert.equal(result.status, "fail");
    assert.equal(result.runtimeStatus.ok, false);
    assert.match(result.runtimeStatus.reason, /config path/i);
  } finally {
    await harness.cleanup();
  }
});
