import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyZeroClawVersionSupport,
  detectZeroClaw,
  getZeroClawDoctorSummary,
  getZeroClawStatusSummary,
  parseZeroClawVersion,
  sanitizeZeroClawCommandOutput,
} from "../../src/install/zeroclaw-command.js";
import { createInstallHarness } from "./harness.js";

test("parseZeroClawVersion extracts semver from CLI output", () => {
  assert.equal(parseZeroClawVersion("zeroclaw 0.6.9"), "0.6.9");
  assert.equal(parseZeroClawVersion("zeroclaw v0.7.0-beta.2"), "0.7.0-beta.2");
  assert.equal(parseZeroClawVersion("no version here"), null);
});

test("classifyZeroClawVersionSupport allows versions at or above the minimum", () => {
  assert.equal(classifyZeroClawVersionSupport("0.6.9"), "supported");
  assert.equal(classifyZeroClawVersionSupport("0.7.0-beta.1"), "supported");
  assert.equal(classifyZeroClawVersionSupport("1.0.0"), "supported");
  assert.equal(classifyZeroClawVersionSupport("0.6.8"), "below_minimum");
});

test("detectZeroClaw reports missing command", async () => {
  const harness = await createInstallHarness();

  try {
    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "missing_command");
    assert.match(probe.error ?? "", /not found|ENOENT/i);
  } finally {
    await harness.cleanup();
  }
});

test("detectZeroClaw accepts the minimum v0.6.9 runtime", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "supported");
    assert.equal(probe.installedVersion, "0.6.9");
    assert.deepEqual(await harness.readFakeZeroClawInvocations(), [
      ["--version"],
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("detectZeroClaw flags versions below the minimum", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.8",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "below_minimum");
    assert.equal(probe.installedVersion, "0.6.8");
  } finally {
    await harness.cleanup();
  }
});

test("detectZeroClaw accepts v0.7+ including prereleases", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.7.0-beta.1",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "supported");
    assert.equal(probe.installedVersion, "0.7.0-beta.1");
  } finally {
    await harness.cleanup();
  }
});

test("detectZeroClaw reports unparseable version output", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw version: ???",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "version_unparseable");
    assert.match(probe.error ?? "", /parse/i);
  } finally {
    await harness.cleanup();
  }
});

test("getZeroClawDoctorSummary captures advisory output without throwing on non-zero exit", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        doctor: {
          exitCode: 2,
          stderr: "doctor stderr",
          stdout: "doctor stdout",
        },
      },
      output: "zeroclaw 0.6.9",
    });

    const summary = await getZeroClawDoctorSummary(
      harness.createDependencies(),
    );

    assert.equal(summary.ok, false);
    assert.equal(summary.exitCode, 2);
    assert.equal(summary.output, "doctor stdout\ndoctor stderr");
    assert.deepEqual(await harness.readFakeZeroClawInvocations(), [["doctor"]]);
  } finally {
    await harness.cleanup();
  }
});

test("getZeroClawStatusSummary throws on invalid json output", async () => {
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

    await assert.rejects(
      () => getZeroClawStatusSummary(harness.createDependencies()),
      /Unexpected token|JSON/i,
    );
  } finally {
    await harness.cleanup();
  }
});

test("sanitizeZeroClawCommandOutput redacts provider override secrets", () => {
  const sanitized = sanitizeZeroClawCommandOutput(
    "doctor saw gp-example-token in the output",
    {
      ZEROCLAW_API_KEY: "gp-example-token",
    },
  );

  assert.equal(sanitized, "doctor saw [redacted] in the output");
});
