import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNodeInstallDependencies,
  type CreateNodeInstallDependenciesOverrides,
  type InstallDependencies,
  type InstallSelectOptions,
} from "../../src/install/deps.js";

export interface FakeZeroClawCommandFailure {
  readonly args: readonly string[];
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly stdout?: string;
}

export interface FakeZeroClawBehavior {
  readonly doctor?: {
    readonly exitCode?: number;
    readonly stderr?: string;
    readonly stdout?: string;
  };
  readonly failCommands?: readonly FakeZeroClawCommandFailure[];
  readonly propsInitCreatesWorkspace?: boolean;
  readonly secret?: {
    readonly nativePromptValue?: string;
  };
  readonly status?: {
    readonly exitCode?: number;
    readonly json?: Record<string, unknown>;
    readonly rawOutput?: string;
    readonly stderr?: string;
  };
  readonly version?: {
    readonly exitCode?: number;
    readonly output?: string;
    readonly stderr?: string;
  };
}

interface FakeZeroClawOptions {
  readonly behavior?: FakeZeroClawBehavior;
  readonly exitCode?: number;
  readonly output?: string;
  readonly stderr?: string;
}

type HarnessDependencyOverrides = CreateNodeInstallDependenciesOverrides;

export const TEST_LIVE_MODEL_ID = "live/test-default-model";
export const TEST_EXTRA_LIVE_MODEL_ID = "live/test-extra-model";

export interface FakeZeroClawInvocation {
  readonly args: string[];
  readonly stdin: string;
}

export interface InstallHarness {
  readonly binDir: string;
  readonly homeDir: string;
  readonly rootDir: string;
  readonly workspaceDir: string;
  cleanup(): Promise<void>;
  createDependencies(
    overrides?: HarnessDependencyOverrides,
  ): InstallDependencies;
  createPath(relativePath: string): string;
  installFakeZeroClawOnPath(options?: FakeZeroClawOptions): Promise<void>;
  readFakeZeroClawExecutions(): Promise<FakeZeroClawInvocation[]>;
  readFakeZeroClawInvocations(): Promise<string[][]>;
  writeFile(relativePath: string, contents: string): Promise<string>;
}

const fakeZeroClawFixturePath = fileURLToPath(
  new URL("./fixtures/fake-zeroclaw.mjs", import.meta.url),
);

function toBehavior(options: FakeZeroClawOptions): FakeZeroClawBehavior {
  return {
    ...options.behavior,
    version: {
      exitCode: options.behavior?.version?.exitCode ?? options.exitCode ?? 0,
      output:
        options.behavior?.version?.output ?? options.output ?? "zeroclaw 0.6.9",
      stderr: options.behavior?.version?.stderr ?? options.stderr ?? "",
    },
  };
}

async function fetchSuccessfulModelCatalog() {
  return {
    status: 200,
    async json() {
      return {
        data: [
          { id: TEST_LIVE_MODEL_ID, name: "Test Default Model" },
          { id: TEST_EXTRA_LIVE_MODEL_ID },
        ],
        object: "list",
      };
    },
  };
}

export async function createInstallHarness(): Promise<InstallHarness> {
  const rootDir = await mkdtemp(join(tmpdir(), "zeroclaw-setup-"));
  const homeDir = join(rootDir, "home");
  const workspaceDir = join(rootDir, "workspace");
  const binDir = join(rootDir, "bin");
  const fakeZeroClawInvocationsPath = join(
    rootDir,
    "fake-zeroclaw-invocations",
  );
  const fakeZeroClawBehaviorPath = join(rootDir, "fake-zeroclaw-behavior.json");

  await Promise.all([
    mkdir(homeDir, { recursive: true }),
    mkdir(workspaceDir, { recursive: true }),
    mkdir(binDir, { recursive: true }),
  ]);

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDir,
    PATH: [binDir, process.env.PATH ?? ""]
      .filter((value) => value.length > 0)
      .join(delimiter),
  };
  let fakeZeroClawEnv: NodeJS.ProcessEnv = {};

  async function readFakeZeroClawExecutions(): Promise<
    FakeZeroClawInvocation[]
  > {
    try {
      const contents = await readFile(fakeZeroClawInvocationsPath, "utf8");
      return contents
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as FakeZeroClawInvocation);
    } catch {
      return [];
    }
  }

  return {
    binDir,
    async cleanup() {
      await rm(rootDir, { force: true, recursive: true });
    },
    createDependencies(overrides = {}) {
      return createNodeInstallDependencies({
        clock: overrides.clock,
        commands: overrides.commands,
        fs: overrides.fs,
        http: overrides.http ?? {
          fetch: fetchSuccessfulModelCatalog,
        },
        input: overrides.input,
        processes: overrides.processes ?? {
          async listCurrentUserProcesses() {
            return [];
          },
        },
        prompts: {
          async readSecret() {
            return "gp-live-catalog-secret";
          },
          async selectOption<TValue extends string>(
            options: InstallSelectOptions<TValue>,
          ) {
            const firstChoice = options.choices[0];

            if (firstChoice === undefined) {
              throw new Error("Expected at least one select option.");
            }

            return options.defaultValue ?? firstChoice.value;
          },
          ...overrides.prompts,
        },
        runtime: {
          cwd: overrides.runtime?.cwd ?? workspaceDir,
          env: {
            ...baseEnv,
            ...fakeZeroClawEnv,
            ...overrides.runtime?.env,
          },
          homeDir: overrides.runtime?.homeDir ?? homeDir,
          osRelease: overrides.runtime?.osRelease,
          platform: overrides.runtime?.platform,
          stdinIsTTY: overrides.runtime?.stdinIsTTY ?? true,
          stdoutIsTTY: overrides.runtime?.stdoutIsTTY ?? true,
        },
      });
    },
    createPath(relativePath) {
      return join(rootDir, relativePath);
    },
    homeDir,
    async installFakeZeroClawOnPath(options = {}) {
      if (process.platform === "win32") {
        const launcherPath = join(binDir, "zeroclaw.cmd");
        const launcherContents = `@echo off\r\n"${process.execPath}" "${fakeZeroClawFixturePath}" %*\r\n`;

        await writeFile(launcherPath, launcherContents, "utf8");
      } else {
        const launcherPath = join(binDir, "zeroclaw");
        const launcherContents = `#!${process.execPath}
import ${JSON.stringify(fakeZeroClawFixturePath)};
`;

        await writeFile(launcherPath, launcherContents, "utf8");
        await chmod(launcherPath, 0o755);
      }

      await writeFile(
        fakeZeroClawBehaviorPath,
        JSON.stringify(toBehavior(options), null, 2),
        "utf8",
      );

      fakeZeroClawEnv = {
        GONKAGATE_FAKE_ZEROCLAW_BEHAVIOR_FILE: fakeZeroClawBehaviorPath,
        GONKAGATE_FAKE_ZEROCLAW_INVOCATIONS_FILE: fakeZeroClawInvocationsPath,
      };
    },
    readFakeZeroClawExecutions,
    async readFakeZeroClawInvocations() {
      const executions = await readFakeZeroClawExecutions();
      return executions.map((execution) => execution.args);
    },
    rootDir,
    workspaceDir,
    async writeFile(relativePath, contents) {
      const filePath = join(rootDir, relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
      return filePath;
    },
  };
}
