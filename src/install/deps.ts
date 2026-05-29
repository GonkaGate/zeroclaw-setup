import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  readFile as readFileFs,
  writeFile as writeFileFs,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { password, select } from "@inquirer/prompts";
import type { InstallProcessInfo, ZeroClawCommandResult } from "./contracts.js";

export interface InstallCommandOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdin?: string;
  readonly stdio?: "inherit" | "pipe";
}

export interface InstallFs {
  pathExists(path: string): Promise<boolean>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(
    path: string,
    data: string | Uint8Array,
    options?: {
      readonly encoding?: BufferEncoding;
      readonly mode?: number;
    },
  ): Promise<void>;
}

export interface InstallClock {
  now(): Date;
}

export interface InstallInput {
  readStdin(): Promise<string>;
}

export interface InstallHttpResponse {
  json(): Promise<unknown>;
  readonly status: number;
}

export interface InstallHttpClient {
  fetch(
    url: string,
    init: {
      readonly headers: Record<string, string>;
      readonly signal?: AbortSignal;
    },
  ): Promise<InstallHttpResponse>;
}

export interface InstallSelectChoice<TValue extends string = string> {
  readonly description?: string;
  readonly label: string;
  readonly value: TValue;
}

export interface InstallSelectOptions<TValue extends string = string> {
  readonly choices: readonly InstallSelectChoice<TValue>[];
  readonly defaultValue?: TValue;
  readonly message: string;
  readonly pageSize?: number;
}

export interface InstallPrompts {
  readSecret(message: string): Promise<string>;
  selectOption<TValue extends string>(
    options: InstallSelectOptions<TValue>,
  ): Promise<TValue>;
}

export interface InstallCommandRunner {
  run(
    command: string,
    args: readonly string[],
    options?: InstallCommandOptions,
  ): Promise<ZeroClawCommandResult>;
}

export interface InstallProcessInspector {
  listCurrentUserProcesses(): Promise<readonly InstallProcessInfo[]>;
}

export interface InstallRuntimeEnvironment {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly homeDir: string;
  readonly osRelease: string;
  readonly platform: NodeJS.Platform;
  readonly stdinIsTTY: boolean;
  readonly stdoutIsTTY: boolean;
}

export interface InstallDependencies {
  readonly clock: InstallClock;
  readonly commands: InstallCommandRunner;
  readonly fs: InstallFs;
  readonly http: InstallHttpClient;
  readonly input: InstallInput;
  readonly processes: InstallProcessInspector;
  readonly prompts: InstallPrompts;
  readonly runtime: InstallRuntimeEnvironment;
}

export interface CreateNodeInstallDependenciesOverrides {
  readonly clock?: Partial<InstallClock>;
  readonly commands?: Partial<InstallCommandRunner>;
  readonly fs?: Partial<InstallFs>;
  readonly http?: Partial<InstallHttpClient>;
  readonly input?: Partial<InstallInput>;
  readonly processes?: Partial<InstallProcessInspector>;
  readonly prompts?: Partial<InstallPrompts>;
  readonly runtime?: Partial<InstallRuntimeEnvironment>;
}

interface PreparedInstallCommand {
  readonly args: string[];
  readonly command: string;
  readonly shell?: boolean;
  readonly windowsHide?: boolean;
}

type PathExistsChecker = (path: string) => Promise<boolean>;

const DEFAULT_WINDOWS_PATH_EXTENSIONS = Object.freeze([
  ".COM",
  ".EXE",
  ".BAT",
  ".CMD",
] as const);

const WINDOWS_SHELL_SCRIPT_EXTENSIONS = new Set([".BAT", ".CMD"]);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readFile(
  path: string,
  encoding: BufferEncoding,
): Promise<string> {
  return await readFileFs(path, encoding);
}

async function writeFile(
  path: string,
  data: string | Uint8Array,
  options?: {
    readonly encoding?: BufferEncoding;
    readonly mode?: number;
  },
): Promise<void> {
  await writeFileFs(path, data, options);
}

function compareEnvironmentKeys(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function normalizeEnvironmentForPlatform(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  if (platform !== "win32") {
    return env;
  }

  const normalizedEnv: NodeJS.ProcessEnv = {};
  const seenKeys = new Set<string>();
  const sortedKeys = Object.keys(env).sort(compareEnvironmentKeys);

  for (const key of sortedKeys) {
    const normalizedKey = key.toUpperCase();

    if (seenKeys.has(normalizedKey)) {
      continue;
    }

    seenKeys.add(normalizedKey);
    normalizedEnv[key] = env[key];
  }

  return normalizedEnv;
}

function getEnvironmentValue(
  env: NodeJS.ProcessEnv,
  key: string,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform !== "win32") {
    return env[key];
  }

  const normalizedKey = key.toLowerCase();
  const sortedKeys = Object.keys(env).sort(compareEnvironmentKeys);

  for (const candidateKey of sortedKeys) {
    if (candidateKey.toLowerCase() === normalizedKey) {
      return env[candidateKey];
    }
  }

  return undefined;
}

function getWindowsPathExtensions(env: NodeJS.ProcessEnv): readonly string[] {
  const rawPathExtensions = getEnvironmentValue(env, "PATHEXT", "win32");

  if (rawPathExtensions === undefined || rawPathExtensions.length === 0) {
    return DEFAULT_WINDOWS_PATH_EXTENSIONS;
  }

  const parsedExtensions = rawPathExtensions
    .split(";")
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0)
    .map((extension) =>
      extension.startsWith(".")
        ? extension.toUpperCase()
        : `.${extension.toUpperCase()}`,
    );

  return parsedExtensions.length > 0
    ? parsedExtensions
    : DEFAULT_WINDOWS_PATH_EXTENSIONS;
}

function stripWrappingQuotes(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

function createWindowsCommandCandidates(
  command: string,
  pathExtensions: readonly string[],
): string[] {
  if (path.win32.extname(command).length > 0) {
    return [command];
  }

  return [
    command,
    ...pathExtensions.map((extension) => `${command}${extension}`),
  ];
}

async function resolveWindowsCommandPath(
  command: string,
  env: NodeJS.ProcessEnv,
  pathExistsChecker: PathExistsChecker = pathExists,
): Promise<string | undefined> {
  const normalizedEnv = normalizeEnvironmentForPlatform(env, "win32");
  const commandCandidates = createWindowsCommandCandidates(
    command,
    getWindowsPathExtensions(normalizedEnv),
  );
  const hasPathQualifier =
    command.includes("\\") ||
    command.includes("/") ||
    path.win32.isAbsolute(command);

  if (hasPathQualifier) {
    for (const candidate of commandCandidates) {
      if (await pathExistsChecker(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  const rawPath = getEnvironmentValue(normalizedEnv, "PATH", "win32") ?? "";

  for (const rawDirectory of rawPath.split(path.win32.delimiter)) {
    const directory = stripWrappingQuotes(rawDirectory.trim());

    if (directory.length === 0) {
      continue;
    }

    for (const candidate of commandCandidates) {
      const fullPath = path.win32.join(directory, candidate);

      if (await pathExistsChecker(fullPath)) {
        return fullPath;
      }
    }
  }

  return undefined;
}

function createCommandNotFoundError(command: string): NodeJS.ErrnoException {
  const error = new Error(`spawn ${command} ENOENT`) as NodeJS.ErrnoException;

  error.code = "ENOENT";
  error.errno = -2;
  error.path = command;
  error.syscall = "spawn";

  return error;
}

async function prepareInstallCommand(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  pathExistsChecker: PathExistsChecker = pathExists,
): Promise<PreparedInstallCommand> {
  if (platform !== "win32") {
    return {
      args: [...args],
      command,
    };
  }

  const normalizedEnv = normalizeEnvironmentForPlatform(env, platform);
  const resolvedCommandPath = await resolveWindowsCommandPath(
    command,
    normalizedEnv,
    pathExistsChecker,
  );

  if (resolvedCommandPath === undefined) {
    throw createCommandNotFoundError(command);
  }

  const extension = path.win32.extname(resolvedCommandPath).toUpperCase();

  if (!WINDOWS_SHELL_SCRIPT_EXTENSIONS.has(extension)) {
    return {
      args: [...args],
      command: resolvedCommandPath,
      windowsHide: true,
    };
  }

  return {
    args: ["/d", "/s", "/c", resolvedCommandPath, ...args],
    command:
      getEnvironmentValue(normalizedEnv, "ComSpec", platform) ?? "cmd.exe",
    windowsHide: true,
  };
}

async function runCommand(
  command: string,
  args: readonly string[],
  options: InstallCommandOptions = {},
): Promise<ZeroClawCommandResult> {
  const runtimeEnv = normalizeEnvironmentForPlatform(
    options.env ?? process.env,
    process.platform,
  );
  const preparedCommand = await prepareInstallCommand(
    command,
    args,
    runtimeEnv,
    process.platform,
  );
  const stdioMode = options.stdio ?? "pipe";

  return await new Promise<ZeroClawCommandResult>((resolve, reject) => {
    const child = spawn(preparedCommand.command, preparedCommand.args, {
      cwd: options.cwd,
      env: runtimeEnv,
      shell: preparedCommand.shell,
      stdio: stdioMode,
      windowsHide: preparedCommand.windowsHide,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    if (stdioMode === "pipe") {
      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdoutChunks.push(
          typeof chunk === "string" ? Buffer.from(chunk) : chunk,
        );
      });

      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderrChunks.push(
          typeof chunk === "string" ? Buffer.from(chunk) : chunk,
        );
      });

      if (options.stdin !== undefined) {
        child.stdin?.end(options.stdin);
      } else {
        child.stdin?.end();
      }
    }

    child.on("error", reject);

    child.on("close", (exitCode, signal) => {
      const stderr =
        stdioMode === "pipe"
          ? Buffer.concat(stderrChunks).toString("utf8")
          : "";
      const stdout =
        stdioMode === "pipe"
          ? Buffer.concat(stdoutChunks).toString("utf8")
          : "";
      const combinedOutput = `${stdout}\n${stderr}`;

      if (
        preparedCommand.shell === true &&
        exitCode !== 0 &&
        /is not recognized as an internal or external command/u.test(
          combinedOutput,
        )
      ) {
        reject(createCommandNotFoundError(command));
        return;
      }

      resolve({
        exitCode: exitCode ?? 1,
        signal,
        stderr,
        stdout,
      });
    });
  });
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");

  let contents = "";

  for await (const chunk of process.stdin) {
    contents += chunk;
  }

  return contents;
}

async function fetchHttp(
  url: string,
  init: {
    readonly headers: Record<string, string>;
    readonly signal?: AbortSignal;
  },
): Promise<InstallHttpResponse> {
  return await fetch(url, init);
}

async function readSecret(message: string): Promise<string> {
  return await password({
    mask: "*",
    message,
  });
}

async function selectOption<TValue extends string>(
  options: InstallSelectOptions<TValue>,
): Promise<TValue> {
  return await select<TValue>({
    choices: options.choices.map((choice) => ({
      description: choice.description,
      name: choice.label,
      value: choice.value,
    })),
    default: options.defaultValue,
    message: options.message,
    pageSize: options.pageSize,
  });
}

async function listCurrentUserProcesses(): Promise<
  readonly InstallProcessInfo[]
> {
  if (process.platform === "win32") {
    const execution = await runCommand(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
      ],
      { stdio: "pipe" },
    );

    if (execution.exitCode !== 0) {
      throw new Error(
        execution.stderr || execution.stdout || "powershell failed",
      );
    }

    const parsed = JSON.parse(
      execution.stdout.trim().length > 0 ? execution.stdout : "[]",
    ) as
      | { readonly CommandLine?: string | null; readonly ProcessId?: number }[]
      | { readonly CommandLine?: string | null; readonly ProcessId?: number };

    const records = Array.isArray(parsed) ? parsed : [parsed];

    return records.flatMap((record) => {
      if (
        typeof record.ProcessId !== "number" ||
        typeof record.CommandLine !== "string" ||
        record.CommandLine.trim().length === 0
      ) {
        return [];
      }

      return [
        {
          commandLine: record.CommandLine,
          pid: record.ProcessId,
        },
      ];
    });
  }

  const execution = await runCommand("ps", ["-xo", "pid=,command="], {
    stdio: "pipe",
  });

  if (execution.exitCode !== 0) {
    throw new Error(execution.stderr || execution.stdout || "ps failed");
  }

  return execution.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/u);

      if (!match) {
        return [];
      }

      return [
        {
          commandLine: match[2],
          pid: Number(match[1]),
        },
      ];
    });
}

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
  const candidate =
    env.HOME ??
    env.USERPROFILE ??
    (env.HOMEDRIVE && env.HOMEPATH
      ? `${env.HOMEDRIVE}${env.HOMEPATH}`
      : undefined);

  return candidate && candidate.length > 0 ? candidate : os.homedir();
}

export function createNodeInstallDependencies(
  overrides: CreateNodeInstallDependenciesOverrides = {},
): InstallDependencies {
  const runtimePlatform = overrides.runtime?.platform ?? process.platform;
  const runtimeEnv = normalizeEnvironmentForPlatform(
    overrides.runtime?.env ?? process.env,
    runtimePlatform,
  );

  const defaultClock: InstallClock = {
    now: () => new Date(),
  };
  const defaultInput: InstallInput = {
    readStdin,
  };
  const defaultHttp: InstallHttpClient = {
    fetch: fetchHttp,
  };
  const defaultPrompts: InstallPrompts = {
    readSecret,
    selectOption,
  };
  const defaultProcesses: InstallProcessInspector = {
    listCurrentUserProcesses,
  };
  const defaultRuntime: InstallRuntimeEnvironment = {
    cwd: overrides.runtime?.cwd ?? process.cwd(),
    env: runtimeEnv,
    homeDir: overrides.runtime?.homeDir ?? resolveHomeDir(runtimeEnv),
    osRelease: overrides.runtime?.osRelease ?? os.release(),
    platform: runtimePlatform,
    stdinIsTTY: overrides.runtime?.stdinIsTTY ?? process.stdin.isTTY === true,
    stdoutIsTTY:
      overrides.runtime?.stdoutIsTTY ?? process.stdout.isTTY === true,
  };
  const defaultCommands: InstallCommandRunner = {
    run: runCommand,
  };

  return {
    clock: {
      ...defaultClock,
      ...overrides.clock,
    },
    commands: {
      ...defaultCommands,
      ...overrides.commands,
    },
    fs: {
      pathExists: overrides.fs?.pathExists ?? pathExists,
      readFile: overrides.fs?.readFile ?? readFile,
      writeFile: overrides.fs?.writeFile ?? writeFile,
    },
    http: {
      ...defaultHttp,
      ...overrides.http,
    },
    input: {
      ...defaultInput,
      ...overrides.input,
    },
    processes: {
      ...defaultProcesses,
      ...overrides.processes,
    },
    prompts: {
      ...defaultPrompts,
      ...overrides.prompts,
    },
    runtime: {
      ...defaultRuntime,
      ...overrides.runtime,
      env: runtimeEnv,
      platform: runtimePlatform,
    },
  };
}
