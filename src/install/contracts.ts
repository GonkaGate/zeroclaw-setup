import type { CuratedModel } from "../constants/models.js";

export type EnvironmentOverrideKind =
  | "api_key"
  | "model"
  | "model_provider"
  | "provider";

export interface EnvironmentOverride {
  readonly displayValue: string;
  readonly isSecret: boolean;
  readonly kind: EnvironmentOverrideKind;
  readonly name: string;
  readonly value: string;
}

export interface ManagedConfigField {
  readonly configKey: string;
  readonly propPath: string;
  readonly description: string;
}

export interface ZeroClawCommandResult {
  readonly exitCode: number;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: string;
  readonly stdout: string;
}

export type ZeroClawVersionSupport =
  | "missing_command"
  | "supported_v0_6_9"
  | "unaudited_v0_6_x"
  | "unsupported_v0_7_plus"
  | "unsupported_other"
  | "version_unparseable";

export interface ZeroClawCommandProbe {
  readonly command: string;
  readonly execution?: ZeroClawCommandResult;
  readonly error?: string;
  readonly installedVersion?: string;
  readonly rawVersionOutput?: string;
  readonly support: ZeroClawVersionSupport;
}

export type ConfigResolutionSource =
  | "ZEROCLAW_CONFIG_DIR"
  | "ZEROCLAW_WORKSPACE"
  | "active_workspace.toml"
  | "default";

export interface ResolvedZeroClawConfigPaths {
  readonly configDir: string;
  readonly configPath: string;
  readonly source: ConfigResolutionSource;
  readonly workspacePath: string;
}

export type ManagedFieldSource =
  | "default_provider"
  | "model_provider"
  | "default_model"
  | "model";

export type SavedSecretState = "set" | "unset";

interface SavedConfigInspectionBase extends ResolvedZeroClawConfigPaths {
  readonly configExists: boolean;
}

export interface MissingSavedConfigInspection extends SavedConfigInspectionBase {
  readonly configExists: false;
  readonly status: "missing";
}

export interface UnreadableSavedConfigInspection extends SavedConfigInspectionBase {
  readonly configExists: true;
  readonly error: string;
  readonly status: "unreadable";
}

export interface InspectedSavedConfig extends SavedConfigInspectionBase {
  readonly apiKeyState: SavedSecretState;
  readonly configExists: true;
  readonly defaultModel: string | undefined;
  readonly defaultModelSource:
    | Extract<ManagedFieldSource, "default_model" | "model">
    | undefined;
  readonly defaultProvider: string | undefined;
  readonly defaultProviderSource:
    | Extract<ManagedFieldSource, "default_provider" | "model_provider">
    | undefined;
  readonly status: "inspected";
  readonly topLevelKeys: readonly string[];
}

export type SavedConfigInspection =
  | MissingSavedConfigInspection
  | UnreadableSavedConfigInspection
  | InspectedSavedConfig;

export type ConfigPreflightOutcome =
  | "eligible_first_run"
  | "eligible_existing_config"
  | "unsupported_version"
  | "config_unreadable"
  | "unsupported_shape_unknown_top_level_keys";

export interface ConfigMutationPreflight {
  readonly outcome: ConfigPreflightOutcome;
  readonly reason: string;
  readonly unknownTopLevelKeys: readonly string[];
}

export interface InstallProcessInfo {
  readonly commandLine: string;
  readonly pid: number;
}

export type InstallPath = "existing_config" | "first_run" | "none";

export type InstallStatus = "blocked" | "failed" | "scaffold" | "success";

export type SecretTransportMode = "native_prompt" | "stdin";

export interface FirstRunCandidateReport {
  readonly commandTuple: readonly string[];
  readonly outcome: "failed" | "proven";
  readonly reason: string;
  readonly secretTransport: SecretTransportMode;
}

export interface FirstRunProofSummary {
  readonly candidateReports: readonly FirstRunCandidateReport[];
  readonly commandTuple?: readonly string[];
  readonly reason: string;
  readonly state: "proven" | "scaffolded";
  readonly supportedTransport?: SecretTransportMode;
}

export interface ZeroClawStatusSummary {
  readonly configPath?: string;
  readonly gatewayRunning?: boolean;
  readonly model?: string;
  readonly provider?: string;
  readonly rawOutput: string;
  readonly servicePid?: number;
  readonly serviceStatus?: string;
  readonly workspacePath?: string;
}

export interface NativeRuntimeSignal {
  readonly rawOutput?: string;
  readonly reason: string;
  readonly status: "active" | "ambiguous" | "quiesced";
  readonly summary?: ZeroClawStatusSummary;
}

export interface RuntimeProcessMatch {
  readonly commandLine: string;
  readonly pid: number;
}

export interface RuntimeQuiesceInspection {
  readonly nativeSignal: NativeRuntimeSignal;
  readonly processMatches: readonly RuntimeProcessMatch[];
  readonly reason: string;
  readonly status: "active" | "ambiguous" | "quiesced";
}

export interface GonkaGateLiveCatalogSummary {
  readonly curatedModelIds: readonly string[];
  readonly endpoint: string;
  readonly liveModelCount: number;
}

export interface ZeroClawDoctorSummary {
  readonly exitCode: number;
  readonly ok: boolean;
  readonly output: string;
}

export type NativeWriteStage =
  | "api-key"
  | "confirm"
  | "default-model"
  | "default-provider"
  | "quiesce"
  | "quick-onboard"
  | "snapshot";

export interface NativeWriteSnapshot {
  readonly defaultModel: string;
  readonly defaultProvider: string;
}

export type RestoreStatus =
  | "not_attempted"
  | "restore_failed"
  | "restored_non_secret"
  | "restore_unneeded";

export interface NativeWriteSuccess {
  readonly confirmedInspection: SavedConfigInspection;
  readonly restoreStatus: Extract<RestoreStatus, "restore_unneeded">;
  readonly secretTransport: SecretTransportMode;
  readonly status: "success";
}

export interface NativeWriteFailure {
  readonly failedStage: NativeWriteStage;
  readonly reason: string;
  readonly remediation?: string;
  readonly restoreStatus: Exclude<RestoreStatus, "restore_unneeded">;
  readonly secretTransport: SecretTransportMode;
  readonly status: "failed";
}

export type NativeWriteResult = NativeWriteFailure | NativeWriteSuccess;

interface InstallResultBase {
  readonly commandProbe: ZeroClawCommandProbe;
  readonly configInspection?: SavedConfigInspection;
  readonly firstRunProof: FirstRunProofSummary;
  readonly liveCatalog?: GonkaGateLiveCatalogSummary;
  readonly preflight: ConfigMutationPreflight;
  readonly managedFields: readonly ManagedConfigField[];
  readonly overrides: readonly EnvironmentOverride[];
  readonly path: InstallPath;
  readonly selectedModel?: CuratedModel;
  readonly status: InstallStatus;
}

export interface InstallSuccessResult extends InstallResultBase {
  readonly path: Exclude<InstallPath, "none">;
  readonly selectedModel: CuratedModel;
  readonly status: "success";
  readonly writeResult: NativeWriteSuccess;
}

export interface InstallBlockedResult extends InstallResultBase {
  readonly reason: string;
  readonly remediation?: string;
  readonly status: "blocked";
}

export interface InstallScaffoldResult extends InstallResultBase {
  readonly reason: string;
  readonly remediation?: string;
  readonly status: "scaffold";
}

export interface InstallFailedResult extends InstallResultBase {
  readonly reason: string;
  readonly remediation?: string;
  readonly status: "failed";
  readonly writeResult: NativeWriteFailure;
}

export type InstallResult =
  | InstallBlockedResult
  | InstallFailedResult
  | InstallScaffoldResult
  | InstallSuccessResult;

export type VerifyStatus = "fail" | "pass" | "warn-shadowed";

export interface VerifySavedContractCheck {
  readonly detail: string;
  readonly name:
    | "api_key"
    | "default_model"
    | "default_provider"
    | "preflight"
    | "support";
  readonly ok: boolean;
}

export interface VerifySavedContract {
  readonly apiKeyState?: SavedSecretState;
  readonly checks: readonly VerifySavedContractCheck[];
  readonly model?: string;
  readonly ok: boolean;
  readonly provider?: string;
  readonly reason: string;
}

export interface VerifyShadowing {
  readonly effectiveOverrides: readonly EnvironmentOverride[];
  readonly hasShadowing: boolean;
  readonly ignoredOverrides: readonly EnvironmentOverride[];
  readonly reason: string;
}

export interface VerifyRuntimeStatus {
  readonly attempted: boolean;
  readonly configPathMatches?: boolean;
  readonly error?: string;
  readonly modelMatches?: boolean;
  readonly ok: boolean;
  readonly providerMatches?: boolean;
  readonly reason: string;
  readonly shadowExplainedMismatch?: boolean;
  readonly summary?: ZeroClawStatusSummary;
  readonly workspacePathMatches?: boolean;
}

export interface VerifyDoctorAdvisory {
  readonly attempted: boolean;
  readonly exitCode?: number;
  readonly ok: boolean;
  readonly output?: string;
  readonly reason: string;
}

export interface VerifyResult {
  readonly configInspection?: SavedConfigInspection;
  readonly commandProbe: ZeroClawCommandProbe;
  readonly doctorAdvisory: VerifyDoctorAdvisory;
  readonly managedFields: readonly ManagedConfigField[];
  readonly overrides: readonly EnvironmentOverride[];
  readonly preflight: ConfigMutationPreflight;
  readonly runtimeStatus: VerifyRuntimeStatus;
  readonly savedContract: VerifySavedContract;
  readonly shadowing: VerifyShadowing;
  readonly status: VerifyStatus;
}
