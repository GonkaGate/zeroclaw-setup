import assert from "node:assert/strict";
import test from "node:test";
import { ZEROCLAW_PROVIDER_KEY } from "../../src/constants/gateway.js";
import {
  renderVerifyResult,
  runVerifyUseCase,
} from "../../src/install/verify-use-case.js";
import { createInstallHarness } from "./harness.js";

const CURATED_MODEL_ID = "qwen/qwen3-235b-a22b-instruct-2507-fp8";

function createManagedConfig(apiKey = "gp-saved-secret"): string {
  return [
    `default_provider = "${ZEROCLAW_PROVIDER_KEY}"`,
    `default_model = "${CURATED_MODEL_ID}"`,
    `api_key = "${apiKey}"`,
  ].join("\n");
}

test("renderVerifyResult prints a pass verdict with runtime and doctor sections", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig(),
    );

    const rendered = renderVerifyResult(
      await runVerifyUseCase({}, harness.createDependencies()),
    );

    assert.match(rendered, /Verify verdict: pass/);
    assert.match(rendered, /Runtime summary from zeroclaw status:/);
    assert.match(rendered, /Doctor advisory:/);
    assert.match(rendered, /Saved GonkaGate contract:/);
  } finally {
    await harness.cleanup();
  }
});

test("renderVerifyResult prints the exact warn-shadowed message and redacts secret env values", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        doctor: {
          stdout: "doctor noticed gp-env-secret in the environment",
        },
      },
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig(),
    );

    const rendered = renderVerifyResult(
      await runVerifyUseCase(
        {},
        harness.createDependencies({
          runtime: {
            env: {
              ZEROCLAW_API_KEY: "gp-env-secret",
            },
          },
        }),
      ),
    );

    assert.match(rendered, /Verify verdict: warn-shadowed/);
    assert.match(rendered, /saved config is correct but inactive/);
    assert.match(rendered, /ZEROCLAW_API_KEY: \[redacted\]/);
    assert.doesNotMatch(rendered, /gp-env-secret/);
  } finally {
    await harness.cleanup();
  }
});

test("renderVerifyResult shows runtime failure detail when zeroclaw status cannot be parsed", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        status: {
          rawOutput: "not-json",
        },
      },
      output: "zeroclaw 0.6.9",
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createManagedConfig(),
    );

    const rendered = renderVerifyResult(
      await runVerifyUseCase({}, harness.createDependencies()),
    );

    assert.match(rendered, /Verify verdict: fail/);
    assert.match(rendered, /zeroclaw status could not be verified/i);
  } finally {
    await harness.cleanup();
  }
});
