import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectSavedZeroClawConfig,
  resolveActiveZeroClawConfig,
} from "../../src/install/config-resolution.js";
import { createInstallHarness } from "./harness.js";

test("resolveActiveZeroClawConfig falls back to the default legacy location", async () => {
  const harness = await createInstallHarness();

  try {
    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies(),
    );

    assert.equal(resolved.source, "default");
    assert.equal(
      resolved.configPath,
      harness.createPath("home/.zeroclaw/config.toml"),
    );
    assert.equal(
      resolved.workspacePath,
      harness.createPath("home/.zeroclaw/workspace"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("ZEROCLAW_CONFIG_DIR takes precedence over all other config sources", async () => {
  const harness = await createInstallHarness();

  try {
    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies({
        runtime: {
          env: {
            ZEROCLAW_CONFIG_DIR: harness.createPath("home/profiles/alpha"),
          },
        },
      }),
    );

    assert.equal(resolved.source, "ZEROCLAW_CONFIG_DIR");
    assert.equal(
      resolved.configPath,
      harness.createPath("home/profiles/alpha/config.toml"),
    );
    assert.equal(
      resolved.workspacePath,
      harness.createPath("home/profiles/alpha/workspace"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("ZEROCLAW_WORKSPACE uses workspace-root layout when workspace config exists", async () => {
  const harness = await createInstallHarness();

  try {
    const workspacePath = harness.createPath("home/profile-a");
    await harness.writeFile(
      "home/profile-a/config.toml",
      'default_provider = "custom:https://api.gonkagate.com/v1"\n',
    );

    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies({
        runtime: {
          env: {
            ZEROCLAW_WORKSPACE: workspacePath,
          },
        },
      }),
    );

    assert.equal(resolved.source, "ZEROCLAW_WORKSPACE");
    assert.equal(
      resolved.configPath,
      harness.createPath("home/profile-a/config.toml"),
    );
    assert.equal(
      resolved.workspacePath,
      harness.createPath("home/profile-a/workspace"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("ZEROCLAW_WORKSPACE keeps the legacy layout when ~/.zeroclaw/config.toml already exists", async () => {
  const harness = await createInstallHarness();

  try {
    const workspacePath = harness.createPath("home/custom-workspace");
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      'default_model = "legacy-model"\n',
    );

    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies({
        runtime: {
          env: {
            ZEROCLAW_WORKSPACE: workspacePath,
          },
        },
      }),
    );

    assert.equal(resolved.source, "ZEROCLAW_WORKSPACE");
    assert.equal(
      resolved.configPath,
      harness.createPath("home/.zeroclaw/config.toml"),
    );
    assert.equal(resolved.workspacePath, workspacePath);
  } finally {
    await harness.cleanup();
  }
});

test("ZEROCLAW_WORKSPACE ending in workspace keeps the legacy layout even without an existing config", async () => {
  const harness = await createInstallHarness();

  try {
    const workspacePath = harness.createPath("home/workspace");
    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies({
        runtime: {
          env: {
            ZEROCLAW_WORKSPACE: workspacePath,
          },
        },
      }),
    );

    assert.equal(
      resolved.configPath,
      harness.createPath("home/.zeroclaw/config.toml"),
    );
    assert.equal(resolved.workspacePath, workspacePath);
  } finally {
    await harness.cleanup();
  }
});

test("active workspace marker resolves relative config_dir values against the default config dir", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.writeFile(
      "home/.zeroclaw/active_workspace.toml",
      'config_dir = "profiles/alpha"\n',
    );
    await harness.writeFile(
      "home/.zeroclaw/profiles/alpha/config.toml",
      'default_provider = "custom:https://api.gonkagate.com/v1"\n',
    );

    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies(),
    );

    assert.equal(resolved.source, "active_workspace.toml");
    assert.equal(
      resolved.configPath,
      harness.createPath("home/.zeroclaw/profiles/alpha/config.toml"),
    );
    assert.equal(
      resolved.workspacePath,
      harness.createPath("home/.zeroclaw/profiles/alpha/workspace"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("ZEROCLAW_WORKSPACE override wins over the persisted active workspace marker", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.writeFile(
      "home/.zeroclaw/active_workspace.toml",
      `config_dir = ${JSON.stringify(harness.createPath("home/.zeroclaw/profiles/alpha"))}\n`,
    );
    const workspacePath = harness.createPath("home/env-workspace");

    const resolved = await resolveActiveZeroClawConfig(
      harness.createDependencies({
        runtime: {
          env: {
            ZEROCLAW_WORKSPACE: workspacePath,
          },
        },
      }),
    );

    assert.equal(resolved.source, "ZEROCLAW_WORKSPACE");
    assert.equal(
      resolved.configPath,
      harness.createPath("home/env-workspace/config.toml"),
    );
  } finally {
    await harness.cleanup();
  }
});

test("inspectSavedZeroClawConfig reports api_key as set without exposing the literal secret value", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      [
        'default_provider = "custom:https://api.gonkagate.com/v1"',
        'default_model = "qwen/qwen3-235b-a22b-instruct-2507-fp8"',
        'api_key = "encrypted-value"',
      ].join("\n"),
    );

    const inspection = await inspectSavedZeroClawConfig(
      harness.createDependencies(),
      await resolveActiveZeroClawConfig(harness.createDependencies()),
    );

    assert.equal(inspection.status, "inspected");

    if (inspection.status === "inspected") {
      assert.equal(
        inspection.defaultProvider,
        "custom:https://api.gonkagate.com/v1",
      );
      assert.equal(
        inspection.defaultModel,
        "qwen/qwen3-235b-a22b-instruct-2507-fp8",
      );
      assert.equal(inspection.apiKeyState, "set");
      assert.deepEqual(inspection.topLevelKeys, [
        "default_provider",
        "default_model",
        "api_key",
      ]);
    }
  } finally {
    await harness.cleanup();
  }
});

test("inspectSavedZeroClawConfig reports api_key as unset when the saved value is blank", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      [
        'default_provider = "custom:https://api.gonkagate.com/v1"',
        'default_model = "qwen/qwen3-235b-a22b-instruct-2507-fp8"',
        'api_key = "   "',
      ].join("\n"),
    );

    const inspection = await inspectSavedZeroClawConfig(
      harness.createDependencies(),
      await resolveActiveZeroClawConfig(harness.createDependencies()),
    );

    assert.equal(inspection.status, "inspected");

    if (inspection.status === "inspected") {
      assert.equal(inspection.apiKeyState, "unset");
    }
  } finally {
    await harness.cleanup();
  }
});
