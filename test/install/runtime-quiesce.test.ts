import assert from "node:assert/strict";
import test from "node:test";
import { inspectRuntimeQuiesce } from "../../src/install/runtime-quiesce.js";
import { createInstallHarness } from "./harness.js";

test("inspectRuntimeQuiesce returns ambiguous when zeroclaw status cannot prove a quiesced runtime", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        status: {
          json: {
            gateway: { running: false },
            service: { status: "starting" },
          },
        },
      },
    });

    const inspection = await inspectRuntimeQuiesce(
      harness.createDependencies(),
    );

    assert.equal(inspection.status, "ambiguous");
    assert.equal(inspection.nativeSignal.status, "ambiguous");
    assert.equal(inspection.processMatches.length, 0);
    assert.match(inspection.reason, /ambiguous|too ambiguous/i);
  } finally {
    await harness.cleanup();
  }
});

test("inspectRuntimeQuiesce returns active when local process inspection finds a candidate runtime process", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath();

    const inspection = await inspectRuntimeQuiesce(
      harness.createDependencies({
        processes: {
          async listCurrentUserProcesses() {
            return [
              {
                commandLine: "/usr/local/bin/zeroclaw daemon --foreground",
                pid: 4242,
              },
            ];
          },
        },
      }),
    );

    assert.equal(inspection.status, "active");
    assert.equal(inspection.nativeSignal.status, "quiesced");
    assert.deepEqual(inspection.processMatches, [
      {
        commandLine: "/usr/local/bin/zeroclaw daemon --foreground",
        pid: 4242,
      },
    ]);
    assert.match(inspection.reason, /candidate ZeroClaw runtime processes/i);
  } finally {
    await harness.cleanup();
  }
});
