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

test("classifyZeroClawVersionSupport gates audited and unaudited versions", () => {
  assert.equal(classifyZeroClawVersionSupport("0.6.9"), "supported_v0_6_9");
  assert.equal(classifyZeroClawVersionSupport("0.6.8"), "unaudited_v0_6_x");
  assert.equal(
    classifyZeroClawVersionSupport("0.7.0-beta.1"),
    "unsupported_v0_7_plus",
  );
  assert.equal(classifyZeroClawVersionSupport("0.5.9"), "unsupported_other");
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

test("detectZeroClaw accepts the audited v0.6.9 runtime", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.9",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "supported_v0_6_9");
    assert.equal(probe.installedVersion, "0.6.9");
    assert.deepEqual(await harness.readFakeZeroClawInvocations(), [
      ["--version"],
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("detectZeroClaw flags unaudited v0.6.x variants", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.6.8",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "unaudited_v0_6_x");
    assert.equal(probe.installedVersion, "0.6.8");
  } finally {
    await harness.cleanup();
  }
});

test("detectZeroClaw rejects v0.7+ including prereleases", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      output: "zeroclaw 0.7.0-beta.1",
    });

    const probe = await detectZeroClaw(harness.createDependencies());

    assert.equal(probe.support, "unsupported_v0_7_plus");
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
