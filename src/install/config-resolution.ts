import TOML from "@iarna/toml";
import path from "node:path";
import type {
  ConfigResolutionSource,
  InspectedSavedConfig,
  ResolvedZeroClawConfigPaths,
  SavedConfigInspection,
  SavedSecretState,
} from "./contracts.js";
import type { InstallDependencies } from "./deps.js";

const ACTIVE_WORKSPACE_STATE_FILE = "active_workspace.toml";

function getPathApi(
  platform: NodeJS.Platform,
): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix;
}

function expandTildePath(
  pathValue: string,
  homeDir: string,
  platform: NodeJS.Platform,
): string {
  if (!pathValue.startsWith("~")) {
    return pathValue;
  }

  const pathApi = getPathApi(platform);
  const suffix = pathValue.slice(1);
  return pathApi.join(homeDir, suffix.replace(/^[/\\]+/u, ""));
}

function defaultConfigDir(dependencies: InstallDependencies): string {
  const pathApi = getPathApi(dependencies.runtime.platform);
  return pathApi.join(dependencies.runtime.homeDir, ".zeroclaw");
}

function defaultWorkspacePath(dependencies: InstallDependencies): string {
  const pathApi = getPathApi(dependencies.runtime.platform);
  return pathApi.join(defaultConfigDir(dependencies), "workspace");
}

export function resolveConfigDirForWorkspace(
  workspacePath: string,
  platform: NodeJS.Platform,
): {
  readonly configDir: string;
  readonly legacyConfigPath: string;
  readonly workspaceConfigPath: string;
  readonly workspacePath: string;
} {
  const pathApi = getPathApi(platform);
  const normalizedWorkspacePath = pathApi.resolve(workspacePath);
  const legacyConfigDir = pathApi.join(
    pathApi.dirname(normalizedWorkspacePath),
    ".zeroclaw",
  );

  return {
    configDir: normalizedWorkspacePath,
    legacyConfigPath: pathApi.join(legacyConfigDir, "config.toml"),
    workspaceConfigPath: pathApi.join(normalizedWorkspacePath, "config.toml"),
    workspacePath: normalizedWorkspacePath,
  };
}

async function resolveWorkspaceOverride(
  workspacePath: string,
  dependencies: InstallDependencies,
): Promise<ResolvedZeroClawConfigPaths> {
  const pathApi = getPathApi(dependencies.runtime.platform);
  const expandedWorkspacePath = expandTildePath(
    workspacePath,
    dependencies.runtime.homeDir,
    dependencies.runtime.platform,
  );
  const candidates = resolveConfigDirForWorkspace(
    expandedWorkspacePath,
    dependencies.runtime.platform,
  );

  if (await dependencies.fs.pathExists(candidates.workspaceConfigPath)) {
    return {
      configDir: candidates.configDir,
      configPath: candidates.workspaceConfigPath,
      source: "ZEROCLAW_WORKSPACE",
      workspacePath: pathApi.join(candidates.workspacePath, "workspace"),
    };
  }

  if (await dependencies.fs.pathExists(candidates.legacyConfigPath)) {
    return {
      configDir: pathApi.dirname(candidates.legacyConfigPath),
      configPath: candidates.legacyConfigPath,
      source: "ZEROCLAW_WORKSPACE",
      workspacePath: candidates.workspacePath,
    };
  }

  if (pathApi.basename(candidates.workspacePath) === "workspace") {
    const configDir = pathApi.join(
      pathApi.dirname(candidates.workspacePath),
      ".zeroclaw",
    );
    return {
      configDir,
      configPath: pathApi.join(configDir, "config.toml"),
      source: "ZEROCLAW_WORKSPACE",
      workspacePath: candidates.workspacePath,
    };
  }

  return {
    configDir: candidates.configDir,
    configPath: candidates.workspaceConfigPath,
    source: "ZEROCLAW_WORKSPACE",
    workspacePath: pathApi.join(candidates.workspacePath, "workspace"),
  };
}

async function resolvePersistedWorkspaceMarker(
  dependencies: InstallDependencies,
): Promise<ResolvedZeroClawConfigPaths | undefined> {
  const pathApi = getPathApi(dependencies.runtime.platform);
  const configDir = defaultConfigDir(dependencies);
  const statePath = pathApi.join(configDir, ACTIVE_WORKSPACE_STATE_FILE);

  if (!(await dependencies.fs.pathExists(statePath))) {
    return undefined;
  }

  let contents: string;

  try {
    contents = await dependencies.fs.readFile(statePath, "utf8");
  } catch {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = TOML.parse(contents);
  } catch {
    return undefined;
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).config_dir !== "string"
  ) {
    return undefined;
  }

  const markerState = parsed as Record<string, unknown>;
  const rawConfigDir = (markerState.config_dir as string).trim();

  if (rawConfigDir.length === 0) {
    return undefined;
  }

  const expandedConfigDir = expandTildePath(
    rawConfigDir,
    dependencies.runtime.homeDir,
    dependencies.runtime.platform,
  );
  const resolvedConfigDir = pathApi.isAbsolute(expandedConfigDir)
    ? expandedConfigDir
    : pathApi.join(configDir, expandedConfigDir);

  return {
    configDir: resolvedConfigDir,
    configPath: pathApi.join(resolvedConfigDir, "config.toml"),
    source: "active_workspace.toml",
    workspacePath: pathApi.join(resolvedConfigDir, "workspace"),
  };
}

export async function resolveActiveZeroClawConfig(
  dependencies: InstallDependencies,
): Promise<ResolvedZeroClawConfigPaths> {
  const pathApi = getPathApi(dependencies.runtime.platform);
  const env = dependencies.runtime.env;

  const configDirOverride = env.ZEROCLAW_CONFIG_DIR?.trim();
  if (configDirOverride) {
    const configDir = pathApi.resolve(
      expandTildePath(
        configDirOverride,
        dependencies.runtime.homeDir,
        dependencies.runtime.platform,
      ),
    );
    return {
      configDir,
      configPath: pathApi.join(configDir, "config.toml"),
      source: "ZEROCLAW_CONFIG_DIR",
      workspacePath: pathApi.join(configDir, "workspace"),
    };
  }

  const workspaceOverride = env.ZEROCLAW_WORKSPACE?.trim();
  if (workspaceOverride) {
    return await resolveWorkspaceOverride(workspaceOverride, dependencies);
  }

  const markerResolution = await resolvePersistedWorkspaceMarker(dependencies);
  if (markerResolution !== undefined) {
    return markerResolution;
  }

  const configDir = defaultConfigDir(dependencies);
  return {
    configDir,
    configPath: pathApi.join(configDir, "config.toml"),
    source: "default",
    workspacePath: defaultWorkspacePath(dependencies),
  };
}

function pickStringField(
  configTable: Record<string, unknown>,
  fieldNames: readonly string[],
): {
  readonly source: string | undefined;
  readonly value: string | undefined;
} {
  for (const fieldName of fieldNames) {
    const value = configTable[fieldName];
    if (typeof value === "string") {
      return {
        source: fieldName,
        value,
      };
    }
  }

  return {
    source: undefined,
    value: undefined,
  };
}

function readSavedSecretState(
  configTable: Record<string, unknown>,
): SavedSecretState {
  const rawValue = configTable.api_key;

  if (typeof rawValue !== "string") {
    return "unset";
  }

  return rawValue.trim().length > 0 ? "set" : "unset";
}

export async function inspectSavedZeroClawConfig(
  dependencies: InstallDependencies,
  resolvedConfig: ResolvedZeroClawConfigPaths,
): Promise<SavedConfigInspection> {
  if (!(await dependencies.fs.pathExists(resolvedConfig.configPath))) {
    return {
      ...resolvedConfig,
      configExists: false,
      status: "missing",
    };
  }

  let contents: string;

  try {
    contents = await dependencies.fs.readFile(
      resolvedConfig.configPath,
      "utf8",
    );
  } catch (cause) {
    return {
      ...resolvedConfig,
      configExists: true,
      error: cause instanceof Error ? cause.message : String(cause),
      status: "unreadable",
    };
  }

  let parsed: unknown;

  try {
    parsed = TOML.parse(contents);
  } catch (cause) {
    return {
      ...resolvedConfig,
      configExists: true,
      error: cause instanceof Error ? cause.message : String(cause),
      status: "unreadable",
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ...resolvedConfig,
      configExists: true,
      error: "Expected config.toml to contain a top-level TOML table.",
      status: "unreadable",
    };
  }

  const configTable = parsed as Record<string, unknown>;
  const defaultProvider = pickStringField(configTable, [
    "default_provider",
    "model_provider",
  ]);
  const defaultModel = pickStringField(configTable, ["default_model", "model"]);

  return {
    ...resolvedConfig,
    apiKeyState: readSavedSecretState(configTable),
    configExists: true,
    defaultModel: defaultModel.value,
    defaultModelSource: defaultModel.source as
      | InspectedSavedConfig["defaultModelSource"]
      | undefined,
    defaultProvider: defaultProvider.value,
    defaultProviderSource: defaultProvider.source as
      | InspectedSavedConfig["defaultProviderSource"]
      | undefined,
    status: "inspected",
    topLevelKeys: Object.freeze(Object.keys(configTable)),
  };
}

export function formatConfigResolutionSource(
  source: ConfigResolutionSource,
): string {
  switch (source) {
    case "ZEROCLAW_CONFIG_DIR":
    case "ZEROCLAW_WORKSPACE":
    case "active_workspace.toml":
      return source;
    case "default":
      return "~/.zeroclaw/config.toml";
    default:
      return source;
  }
}
