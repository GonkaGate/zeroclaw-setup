import TOML from "@iarna/toml";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const OPAQUE_SECRET_PLACEHOLDER = "zeroclaw-native-secret-placeholder";

function readBehavior() {
  const behaviorPath = process.env.GONKAGATE_FAKE_ZEROCLAW_BEHAVIOR_FILE;

  if (!behaviorPath || !existsSync(behaviorPath)) {
    return {};
  }

  return JSON.parse(readFileSync(behaviorPath, "utf8"));
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function recordInvocation(args, stdin) {
  const invocationsFile = process.env.GONKAGATE_FAKE_ZEROCLAW_INVOCATIONS_FILE;

  if (!invocationsFile) {
    return;
  }

  appendFileSync(
    invocationsFile,
    `${JSON.stringify({ args, stdin })}\n`,
    "utf8",
  );
}

function resolveConfigPaths() {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd();
  const configDir = process.env.ZEROCLAW_CONFIG_DIR
    ? path.resolve(process.env.ZEROCLAW_CONFIG_DIR)
    : path.join(homeDir, ".zeroclaw");

  return {
    configDir,
    configPath: path.join(configDir, "config.toml"),
    workspacePath: path.join(configDir, "workspace"),
  };
}

function ensureParentDirectory(targetPath) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
}

function readConfigTable(configPath) {
  if (!existsSync(configPath)) {
    return {};
  }

  const contents = readFileSync(configPath, "utf8");
  const parsed = TOML.parse(contents);

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : {};
}

function writeConfigTable(configPath, table) {
  ensureParentDirectory(configPath);
  writeFileSync(configPath, TOML.stringify(table), "utf8");
}

function propPathToConfigKey(propPath) {
  return propPath.replace(/-/gu, "_");
}

function outputAndExit({ exitCode = 0, stderr = "", stdout = "" }) {
  if (stdout.length > 0) {
    process.stdout.write(stdout);
  }

  if (stderr.length > 0) {
    process.stderr.write(stderr);
  }

  process.exit(exitCode);
}

function findCommandFailure(args, behavior) {
  return (behavior.failCommands ?? []).find(
    (failure) => JSON.stringify(failure.args ?? []) === JSON.stringify(args),
  );
}

function handleVersion(args, behavior) {
  if (args.length !== 1 || args[0] !== "--version") {
    return false;
  }

  recordInvocation(args, "");
  outputAndExit({
    exitCode:
      behavior.version?.exitCode ??
      Number(process.env.GONKAGATE_FAKE_ZEROCLAW_EXIT_CODE ?? "0"),
    stderr:
      behavior.version?.stderr ??
      process.env.GONKAGATE_FAKE_ZEROCLAW_STDERR ??
      "",
    stdout:
      behavior.version?.output ??
      process.env.GONKAGATE_FAKE_ZEROCLAW_OUTPUT ??
      "zeroclaw 0.6.9",
  });
  return true;
}

function handleStatus(args, behavior, runtimePaths) {
  if (args.length < 1 || args[0] !== "status") {
    return false;
  }

  recordInvocation(args, "");
  const config = readConfigTable(runtimePaths.configPath);
  const defaultJson = {
    config: runtimePaths.configPath,
    gateway: {
      running: false,
    },
    model:
      typeof config.default_model === "string"
        ? config.default_model
        : undefined,
    provider:
      typeof config.default_provider === "string"
        ? config.default_provider
        : undefined,
    service: {
      status: "inactive",
    },
    workspace: runtimePaths.workspacePath,
  };

  outputAndExit({
    exitCode: behavior.status?.exitCode ?? 0,
    stderr: behavior.status?.stderr ?? "",
    stdout:
      behavior.status?.rawOutput ??
      JSON.stringify(behavior.status?.json ?? defaultJson),
  });
  return true;
}

function handleDoctor(args, behavior) {
  if (args.length < 1 || args[0] !== "doctor") {
    return false;
  }

  recordInvocation(args, "");
  outputAndExit({
    exitCode: behavior.doctor?.exitCode ?? 0,
    stderr: behavior.doctor?.stderr ?? "",
    stdout:
      behavior.doctor?.stdout ??
      "doctor ok: no actionable findings for the local ZeroClaw runtime",
  });
  return true;
}

function handleProps(args, behavior, runtimePaths) {
  if (args[0] !== "props" || args.length < 2) {
    return false;
  }

  const matchedFailure = findCommandFailure(args, behavior);
  const config = readConfigTable(runtimePaths.configPath);

  if (args[1] === "get" && args.length === 3) {
    const propPath = args[2];
    const key = propPathToConfigKey(propPath);
    const value = config[key];

    if (propPath === "api-key") {
      recordInvocation(args, "");
      outputAndExit({
        stdout:
          typeof value === "string" && value.trim().length > 0
            ? `${propPath} is set (encrypted secret — value not displayed)`
            : `${propPath} is not set (encrypted secret)`,
      });
      return true;
    }

    if (typeof value !== "string") {
      recordInvocation(args, "");
      outputAndExit({
        exitCode: 1,
        stderr: `${propPath} is unset`,
      });
      return true;
    }

    recordInvocation(args, "");
    outputAndExit({ stdout: value });
    return true;
  }

  if (args[1] === "set" && args.length >= 3) {
    const noInteractive = args[2] === "--no-interactive";
    const propPath = noInteractive ? args[3] : args[2];
    const key = propPathToConfigKey(propPath);

    if (noInteractive) {
      const value = args[4];

      if (typeof value !== "string") {
        recordInvocation(args, "");
        outputAndExit({
          exitCode: 1,
          stderr: `Value required in --no-interactive mode for ${propPath}`,
        });
        return true;
      }

      recordInvocation(args, "");
      if (matchedFailure) {
        outputAndExit({
          exitCode: matchedFailure.exitCode ?? 1,
          stderr: matchedFailure.stderr ?? "",
          stdout: matchedFailure.stdout ?? "",
        });
      }

      config[key] = value;
      writeConfigTable(runtimePaths.configPath, config);
      outputAndExit({ stdout: `${propPath} updated.` });
      return true;
    }

    let value = args[3];
    let secretFromNativePrompt = false;

    if (propPath === "api-key" && typeof value !== "string") {
      if (typeof behavior.secret?.nativePromptValue === "string") {
        value = behavior.secret.nativePromptValue;
        secretFromNativePrompt = true;
      } else {
        value = readStdin().trim();
      }

      if (value.length === 0) {
        recordInvocation(args, "");
        outputAndExit({
          exitCode: 1,
          stderr: `No secret received for ${propPath}`,
        });
        return true;
      }
    }

    if (typeof value !== "string") {
      recordInvocation(args, "");
      outputAndExit({
        exitCode: 1,
        stderr: `Value required for ${propPath}`,
      });
      return true;
    }

    recordInvocation(
      args,
      args[3] === undefined && propPath === "api-key" && !secretFromNativePrompt
        ? value
        : "",
    );
    if (matchedFailure) {
      outputAndExit({
        exitCode: matchedFailure.exitCode ?? 1,
        stderr: matchedFailure.stderr ?? "",
        stdout: matchedFailure.stdout ?? "",
      });
    }

    config[key] = propPath === "api-key" ? OPAQUE_SECRET_PLACEHOLDER : value;
    writeConfigTable(runtimePaths.configPath, config);
    outputAndExit({ stdout: `${propPath} updated.` });
    return true;
  }

  if (args[1] === "init") {
    recordInvocation(args, "");
    ensureParentDirectory(runtimePaths.configPath);
    writeConfigTable(runtimePaths.configPath, config);

    if (behavior.propsInitCreatesWorkspace === true) {
      mkdirSync(runtimePaths.workspacePath, { recursive: true });
    }

    outputAndExit({
      stdout: "Initialized 0 section(s) with defaults:",
    });
    return true;
  }

  return false;
}

function handleOnboard(args, runtimePaths) {
  if (args[0] !== "onboard" || !args.includes("--quick")) {
    return false;
  }

  recordInvocation(args, "");
  const providerIndex = args.indexOf("--provider");
  const modelIndex = args.indexOf("--model");
  const provider = providerIndex >= 0 ? args[providerIndex + 1] : "openrouter";
  const model = modelIndex >= 0 ? args[modelIndex + 1] : "openrouter/default";
  const config = readConfigTable(runtimePaths.configPath);

  config.default_provider = provider;
  config.default_model = model;

  writeConfigTable(runtimePaths.configPath, config);
  mkdirSync(runtimePaths.workspacePath, { recursive: true });

  outputAndExit({
    stdout: `Quick Setup — generated config for provider ${provider}`,
  });
  return true;
}

const args = process.argv.slice(2);
const behavior = readBehavior();

if (handleVersion(args, behavior)) {
  process.exit(0);
}

const runtimePaths = resolveConfigPaths();

if (handleStatus(args, behavior, runtimePaths)) {
  process.exit(0);
}

if (handleDoctor(args, behavior)) {
  process.exit(0);
}

if (handleProps(args, behavior, runtimePaths)) {
  process.exit(0);
}

if (handleOnboard(args, runtimePaths)) {
  process.exit(0);
}

recordInvocation(args, "");
process.stderr.write(`unexpected fake zeroclaw invocation: ${args.join(" ")}`);
process.exit(64);
