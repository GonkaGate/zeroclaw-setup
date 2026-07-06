import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ZEROCLAW_PROVIDER_KEY } from "../../src/constants/gateway.js";
import {
  evaluateFirstRunCandidate,
  getShippedFirstRunProof,
} from "../../src/install/first-run-proof.js";
import { runInstallUseCase } from "../../src/install/install-use-case.js";
import { createInstallHarness, TEST_LIVE_MODEL_ID } from "./harness.js";

const SELECTED_MODEL_ID = TEST_LIVE_MODEL_ID;

test("shipped first-run proof binds runtime install to the native prompt transport", () => {
  const proof = getShippedFirstRunProof();

  assert.equal(proof.state, "proven");
  assert.equal(proof.supportedTransport, "native_prompt");
  assert.match(proof.reason, /onboard --quick/i);
  assert.equal(
    proof.commandTuple?.join(" -> "),
    "zeroclaw onboard --quick --provider custom:https://api.gonkagate.com/v1 --model <model-id> -> zeroclaw props set api-key",
  );
});

test("evaluateFirstRunCandidate proves the onboard-quick plus native api-key path without argv secrets", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        secret: {
          nativePromptValue: "gp-native-proof-secret",
        },
      },
    });

    const report = await evaluateFirstRunCandidate(
      harness.createDependencies(),
      {
        modelId: SELECTED_MODEL_ID,
        transport: "native_prompt",
      },
    );

    assert.equal(report.outcome, "proven");

    const executions = await harness.readFakeZeroClawExecutions();

    assert.deepEqual(
      executions.map((execution) => execution.args),
      [
        [
          "onboard",
          "--quick",
          "--provider",
          ZEROCLAW_PROVIDER_KEY,
          "--model",
          SELECTED_MODEL_ID,
        ],
        ["props", "set", "api-key"],
      ],
    );
    assert.equal(executions[1]?.stdin ?? "", "");
    assert.equal(
      executions.some((execution) =>
        execution.args.some((argument) =>
          argument.includes("gp-native-proof-secret"),
        ),
      ),
      false,
    );
  } finally {
    await harness.cleanup();
  }
});

test("install uses the proven first-run path and still keeps the api key off argv", async () => {
  const harness = await createInstallHarness();
  let promptCalls = 0;
  let secretPromptCalls = 0;

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        secret: {
          nativePromptValue: "gp-first-run-secret",
        },
      },
    });

    const result = await runInstallUseCase(
      {},
      harness.createDependencies({
        prompts: {
          async readSecret() {
            secretPromptCalls += 1;
            return "gp-live-catalog-secret";
          },
          async selectOption<TValue extends string>() {
            promptCalls += 1;
            return SELECTED_MODEL_ID as TValue;
          },
        },
      }),
    );

    assert.equal(result.status, "success");
    assert.equal(result.path, "first_run");
    assert.equal(result.selectedModel?.id, SELECTED_MODEL_ID);
    assert.equal(promptCalls, 1);
    assert.equal(secretPromptCalls, 1);
    assert.equal(result.configInspection?.status, "inspected");

    if (result.configInspection?.status === "inspected") {
      assert.equal(result.configInspection.apiKeyState, "set");
    }

    const executions = await harness.readFakeZeroClawExecutions();
    const savedConfig = await readFile(
      harness.createPath("home/.zeroclaw/config.toml"),
      "utf8",
    );

    assert.deepEqual(
      executions.map((execution) => execution.args),
      [
        ["--version"],
        ["status", "--json"],
        [
          "onboard",
          "--quick",
          "--provider",
          ZEROCLAW_PROVIDER_KEY,
          "--model",
          SELECTED_MODEL_ID,
        ],
        ["props", "set", "api-key"],
      ],
    );
    assert.equal(executions[3]?.stdin ?? "", "");
    assert.equal(
      executions.some((execution) =>
        execution.args.some((argument) =>
          argument.includes("gp-first-run-secret"),
        ),
      ),
      false,
    );
    assert.equal(
      executions.some((execution) =>
        execution.args.some((argument) =>
          argument.includes("gp-live-catalog-secret"),
        ),
      ),
      false,
    );
    assert.match(savedConfig, /api_key = ".+"/);
    assert.doesNotMatch(savedConfig, /gp-first-run-secret/u);
  } finally {
    await harness.cleanup();
  }
});

test("first-run install blocks stdin api-key transport before any mutation commands run", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath();

    const result = await runInstallUseCase(
      {
        apiKey: "gp-stdin-secret",
        model: SELECTED_MODEL_ID,
      },
      harness.createDependencies(),
    );

    assert.equal(result.status, "blocked");
    assert.equal(result.path, "first_run");
    assert.match(result.reason, /shipped only for the proven hidden native/i);
    assert.match(
      result.remediation ?? "",
      /re-run the installer interactively/i,
    );

    const executions = await harness.readFakeZeroClawInvocations();
    assert.deepEqual(executions, [["--version"], ["status", "--json"]]);
  } finally {
    await harness.cleanup();
  }
});

test("first-run proof reports a failing tuple when the hidden api-key step fails", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        failCommands: [
          {
            args: ["props", "set", "api-key"],
            exitCode: 1,
            stderr: "native secret prompt failed",
          },
        ],
        secret: {
          nativePromptValue: "gp-proof-should-fail",
        },
      },
    });

    const report = await evaluateFirstRunCandidate(
      harness.createDependencies(),
      {
        modelId: SELECTED_MODEL_ID,
        transport: "native_prompt",
      },
    );

    assert.equal(report.outcome, "failed");
    assert.match(report.reason, /props set api-key failed|exit 1/i);
  } finally {
    await harness.cleanup();
  }
});
