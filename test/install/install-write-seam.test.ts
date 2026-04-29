import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveModelByKey } from "../../src/constants/models.js";
import { ZEROCLAW_PROVIDER_KEY } from "../../src/constants/gateway.js";
import { runInstallUseCase } from "../../src/install/install-use-case.js";
import { createInstallHarness } from "./harness.js";

const CURATED_MODEL = resolveModelByKey("qwen3-235b");

function createExistingConfigText(): string {
  return [
    'default_provider = "openrouter"',
    'default_model = "openrouter/old-model"',
    "",
    "[channels_config]",
    'default = "general"',
    "",
    "[memory]",
    'backend = "markdown"',
    "",
    "[hooks]",
    'pre_command = ["echo before-run"]',
    "",
    "[tunnel]",
    "enabled = false",
    "",
    "[workspace]",
    "trusted = true",
    "",
    "[reliability]",
    "max_retries = 3",
    "",
    "[model_routes.chat]",
    'model = "openrouter/old-model"',
    "",
    "[embedding_routes.default]",
    'model = "openai/text-embedding-3-small"',
  ].join("\n");
}

test("existing-config mutation succeeds through native props writes and preserves unrelated sections", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        secret: {
          nativePromptValue: "gp-existing-config-secret",
        },
      },
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createExistingConfigText(),
    );

    const result = await runInstallUseCase(
      {
        model: CURATED_MODEL.key,
      },
      harness.createDependencies(),
    );

    assert.equal(result.status, "success");
    assert.equal(result.path, "existing_config");
    assert.equal(result.selectedModel?.modelId, CURATED_MODEL.modelId);
    assert.equal(result.configInspection?.status, "inspected");

    if (result.configInspection?.status === "inspected") {
      assert.equal(result.configInspection.apiKeyState, "set");
    }

    const savedConfig = await readFile(
      harness.createPath("home/.zeroclaw/config.toml"),
      "utf8",
    );

    assert.match(savedConfig, /\[channels_config\]/);
    assert.match(savedConfig, /default = "general"/);
    assert.match(savedConfig, /\[memory\]/);
    assert.match(savedConfig, /backend = "markdown"/);
    assert.match(savedConfig, /\[hooks\]/);
    assert.match(savedConfig, /pre_command = \[\s*"echo before-run"\s*\]/);
    assert.match(savedConfig, /\[tunnel\]/);
    assert.match(savedConfig, /enabled = false/);
    assert.match(savedConfig, /\[workspace\]/);
    assert.match(savedConfig, /trusted = true/);
    assert.match(savedConfig, /\[reliability\]/);
    assert.match(savedConfig, /max_retries = 3/);
    assert.match(savedConfig, /\[model_routes\.chat\]/);
    assert.match(savedConfig, /model = "openrouter\/old-model"/);
    assert.match(savedConfig, /\[embedding_routes\.default\]/);
    assert.match(savedConfig, /model = "openai\/text-embedding-3-small"/);
    assert.match(
      savedConfig,
      new RegExp(
        `default_provider = "${ZEROCLAW_PROVIDER_KEY.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`,
      ),
    );
    assert.match(
      savedConfig,
      /default_model = "qwen\/qwen3-235b-a22b-instruct-2507-fp8"/,
    );
    assert.match(savedConfig, /api_key = ".+"/);
    assert.doesNotMatch(savedConfig, /gp-existing-config-secret/u);

    const executions = await harness.readFakeZeroClawExecutions();

    const argsOnly = executions.map((execution) => execution.args);

    assert.deepEqual(argsOnly.slice(0, 2), [
      ["--version"],
      ["status", "--json"],
    ]);
    assert.deepEqual(
      new Set(argsOnly.slice(2, 4).map((args) => args.join(" "))),
      new Set(["props get default-provider", "props get default-model"]),
    );
    assert.deepEqual(argsOnly.slice(4), [
      [
        "props",
        "set",
        "--no-interactive",
        "default-provider",
        ZEROCLAW_PROVIDER_KEY,
      ],
      [
        "props",
        "set",
        "--no-interactive",
        "default-model",
        CURATED_MODEL.modelId,
      ],
      ["props", "set", "api-key"],
    ]);
    assert.equal(executions[6]?.stdin ?? "", "");
    assert.equal(
      executions.some((execution) =>
        execution.args.some((argument) =>
          argument.includes("gp-existing-config-secret"),
        ),
      ),
      false,
    );
  } finally {
    await harness.cleanup();
  }
});

test("runtime-ambiguous existing-config installs refuse before prompting or writing", async () => {
  const harness = await createInstallHarness();
  let promptCalls = 0;

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
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createExistingConfigText(),
    );

    const result = await runInstallUseCase(
      {},
      harness.createDependencies({
        prompts: {
          async readSecret() {
            promptCalls += 1;
            return "gp-should-not-be-used";
          },
          async selectOption<TValue extends string>() {
            promptCalls += 1;
            return CURATED_MODEL.key as TValue;
          },
        },
      }),
    );

    assert.equal(result.status, "blocked");
    assert.equal(result.path, "existing_config");
    assert.match(result.reason, /ambiguous|too ambiguous/i);
    assert.equal(promptCalls, 0);

    const executions = await harness.readFakeZeroClawInvocations();
    assert.deepEqual(executions, [["--version"], ["status", "--json"]]);
  } finally {
    await harness.cleanup();
  }
});

test("runtime-active existing-config installs refuse before prompting or writing", async () => {
  const harness = await createInstallHarness();
  let promptCalls = 0;

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        status: {
          json: {
            gateway: { running: true },
            service: { status: "active", pid: 12345 },
          },
        },
      },
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createExistingConfigText(),
    );

    const result = await runInstallUseCase(
      {},
      harness.createDependencies({
        prompts: {
          async readSecret() {
            promptCalls += 1;
            return "gp-should-not-be-used";
          },
          async selectOption<TValue extends string>() {
            promptCalls += 1;
            return CURATED_MODEL.key as TValue;
          },
        },
      }),
    );

    assert.equal(result.status, "blocked");
    assert.equal(result.path, "existing_config");
    assert.match(result.reason, /running gateway|active/i);
    assert.equal(promptCalls, 0);

    const executions = await harness.readFakeZeroClawInvocations();
    assert.deepEqual(executions, [["--version"], ["status", "--json"]]);
  } finally {
    await harness.cleanup();
  }
});

test("pre-secret failure restores prior non-secret fields before returning failure", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        failCommands: [
          {
            args: [
              "props",
              "set",
              "--no-interactive",
              "default-model",
              CURATED_MODEL.modelId,
            ],
            exitCode: 1,
            stderr: "default-model write failed",
          },
        ],
        secret: {
          nativePromptValue: "gp-never-used",
        },
      },
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createExistingConfigText(),
    );

    const result = await runInstallUseCase(
      {
        model: CURATED_MODEL.key,
      },
      harness.createDependencies(),
    );

    assert.equal(result.status, "failed");
    assert.equal(result.path, "existing_config");
    assert.equal(result.writeResult.failedStage, "default-model");
    assert.equal(result.writeResult.restoreStatus, "restored_non_secret");

    const savedConfig = await readFile(
      harness.createPath("home/.zeroclaw/config.toml"),
      "utf8",
    );

    assert.match(savedConfig, /default_provider = "openrouter"/);
    assert.match(savedConfig, /default_model = "openrouter\/old-model"/);

    const executions = await harness.readFakeZeroClawInvocations();

    assert.deepEqual(executions.slice(0, 2), [
      ["--version"],
      ["status", "--json"],
    ]);
    assert.deepEqual(
      new Set(executions.slice(2, 4).map((args) => args.join(" "))),
      new Set(["props get default-provider", "props get default-model"]),
    );
    assert.deepEqual(executions.slice(4), [
      [
        "props",
        "set",
        "--no-interactive",
        "default-provider",
        ZEROCLAW_PROVIDER_KEY,
      ],
      [
        "props",
        "set",
        "--no-interactive",
        "default-model",
        CURATED_MODEL.modelId,
      ],
      ["props", "set", "--no-interactive", "default-provider", "openrouter"],
      [
        "props",
        "set",
        "--no-interactive",
        "default-model",
        "openrouter/old-model",
      ],
    ]);
  } finally {
    await harness.cleanup();
  }
});

test("post-secret failure restores prior non-secret fields and emits secret remediation guidance", async () => {
  const harness = await createInstallHarness();

  try {
    await harness.installFakeZeroClawOnPath({
      behavior: {
        failCommands: [
          {
            args: ["props", "set", "api-key"],
            exitCode: 1,
            stderr: "native secret write failed",
          },
        ],
        secret: {
          nativePromptValue: "gp-failing-secret",
        },
      },
    });
    await harness.writeFile(
      "home/.zeroclaw/config.toml",
      createExistingConfigText(),
    );

    const result = await runInstallUseCase(
      {
        model: CURATED_MODEL.key,
      },
      harness.createDependencies(),
    );

    assert.equal(result.status, "failed");
    assert.equal(result.path, "existing_config");
    assert.equal(result.writeResult.failedStage, "api-key");
    assert.equal(result.writeResult.restoreStatus, "restored_non_secret");
    assert.match(result.remediation ?? "", /prior api-key value|api-key/i);

    const savedConfig = await readFile(
      harness.createPath("home/.zeroclaw/config.toml"),
      "utf8",
    );

    assert.match(savedConfig, /default_provider = "openrouter"/);
    assert.match(savedConfig, /default_model = "openrouter\/old-model"/);
    assert.doesNotMatch(savedConfig, /gp-failing-secret/u);
  } finally {
    await harness.cleanup();
  }
});
