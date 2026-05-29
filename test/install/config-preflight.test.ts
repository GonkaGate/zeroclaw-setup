import assert from "node:assert/strict";
import test from "node:test";
import { preflightMutationReadiness } from "../../src/install/config-preflight.js";
import { runInstallUseCase } from "../../src/install/install-use-case.js";
import {
  inspectSavedZeroClawConfig,
  resolveActiveZeroClawConfig,
} from "../../src/install/config-resolution.js";
import { detectZeroClaw } from "../../src/install/zeroclaw-command.js";
import { createInstallHarness } from "./harness.js";

test("preflight marks missing resolved configs as eligible_first_run on audited v0.6.9", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    const dependencies = harness.createDependencies();
    const probe = await detectZeroClaw(dependencies);
    const inspection = await inspectSavedZeroClawConfig(
      dependencies,
      await resolveActiveZeroClawConfig(dependencies),
    );
    const preflight = preflightMutationReadiness(probe, inspection);

    assert.equal(preflight.outcome, "eligible_first_run");
  } finally {
    await harness.cleanup();
  }
});

test("preflight accepts known audited top-level shapes", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      [
        'default_provider = "custom:https://api.gonkagate.com/v1"',
        'default_model = "qwen/qwen3-235b-a22b-instruct-2507-fp8"',
        "",
        "[memory]",
        'backend = "markdown"',
      ].join("\n"),
    );

    const dependencies = harness.createDependencies();
    const probe = await detectZeroClaw(dependencies);
    const inspection = await inspectSavedZeroClawConfig(
      dependencies,
      await resolveActiveZeroClawConfig(dependencies),
    );
    const preflight = preflightMutationReadiness(probe, inspection);

    assert.equal(preflight.outcome, "eligible_existing_config");
  } finally {
    await harness.cleanup();
  }
});

test("preflight accepts audited top-level aliases", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      [
        'model_provider = "custom:https://api.gonkagate.com/v1"',
        'model = "qwen/qwen3-235b-a22b-instruct-2507-fp8"',
        "",
        "[mcpServers.example]",
        'command = "npx"',
      ].join("\n"),
    );

    const dependencies = harness.createDependencies();
    const probe = await detectZeroClaw(dependencies);
    const inspection = await inspectSavedZeroClawConfig(
      dependencies,
      await resolveActiveZeroClawConfig(dependencies),
    );
    const preflight = preflightMutationReadiness(probe, inspection);

    assert.equal(preflight.outcome, "eligible_existing_config");
  } finally {
    await harness.cleanup();
  }
});

test("preflight refuses configs with unknown top-level keys", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      [
        'default_provider = "custom:https://api.gonkagate.com/v1"',
        'mystery_key = "boom"',
      ].join("\n"),
    );

    const dependencies = harness.createDependencies();
    const probe = await detectZeroClaw(dependencies);
    const inspection = await inspectSavedZeroClawConfig(
      dependencies,
      await resolveActiveZeroClawConfig(dependencies),
    );
    const preflight = preflightMutationReadiness(probe, inspection);

    assert.equal(preflight.outcome, "unsupported_shape_unknown_top_level_keys");
    assert.deepEqual(preflight.unknownTopLevelKeys, ["mystery_key"]);
  } finally {
    await harness.cleanup();
  }
});

test("install short-circuits before secret intake on unsupported config shapes", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      [
        'default_provider = "custom:https://api.gonkagate.com/v1"',
        'mystery_key = "boom"',
      ].join("\n"),
    );

    const result = await runInstallUseCase({}, harness.createDependencies());

    assert.equal(result.status, "blocked");
    assert.equal(result.path, "none");
    assert.equal(
      result.preflight.outcome,
      "unsupported_shape_unknown_top_level_keys",
    );
  } finally {
    await harness.cleanup();
  }
});

test("install short-circuits before secret intake on unsupported ZeroClaw versions", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.7.0-beta.1",
    });

    const result = await runInstallUseCase({}, harness.createDependencies());

    assert.equal(result.status, "blocked");
    assert.equal(result.path, "none");
    assert.equal(result.preflight.outcome, "unsupported_version");
  } finally {
    await harness.cleanup();
  }
});
