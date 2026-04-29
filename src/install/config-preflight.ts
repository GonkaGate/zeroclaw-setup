import type {
  ConfigMutationPreflight,
  SavedConfigInspection,
  ZeroClawCommandProbe,
} from "./contracts.js";

const AUDITED_ZEROCLAW_V069_CANONICAL_TOP_LEVEL_KEYS = Object.freeze([
  "api_key",
  "api_url",
  "api_path",
  "default_provider",
  "default_model",
  "model_providers",
  "default_temperature",
  "provider_timeout_secs",
  "provider_max_tokens",
  "extra_headers",
  "observability",
  "autonomy",
  "trust",
  "security",
  "backup",
  "data_retention",
  "cloud_ops",
  "conversational_ai",
  "security_ops",
  "runtime",
  "reliability",
  "scheduler",
  "agent",
  "pacing",
  "skills",
  "pipeline",
  "model_routes",
  "embedding_routes",
  "query_classification",
  "heartbeat",
  "cron",
  "channels_config",
  "memory",
  "storage",
  "tunnel",
  "gateway",
  "composio",
  "microsoft365",
  "secrets",
  "browser",
  "browser_delegate",
  "http_request",
  "multimodal",
  "media_pipeline",
  "web_fetch",
  "link_enricher",
  "text_browser",
  "web_search",
  "project_intel",
  "google_workspace",
  "proxy",
  "identity",
  "cost",
  "peripherals",
  "delegate",
  "agents",
  "swarms",
  "hooks",
  "hardware",
  "transcription",
  "tts",
  "mcp",
  "nodes",
  "workspace",
  "notion",
  "jira",
  "node_transport",
  "knowledge",
  "linkedin",
  "image_gen",
  "plugins",
  "locale",
  "verifiable_intent",
  "claude_code",
  "claude_code_runner",
  "codex_cli",
  "gemini_cli",
  "opencode_cli",
  "sop",
  "shell_tool",
] as const);

const AUDITED_ZEROCLAW_V069_TOP_LEVEL_ALIASES = Object.freeze([
  "model_provider",
  "model",
  "mcpServers",
] as const);

export const AUDITED_ZEROCLAW_V069_TOP_LEVEL_KEYS = Object.freeze(
  new Set<string>([
    ...AUDITED_ZEROCLAW_V069_CANONICAL_TOP_LEVEL_KEYS,
    ...AUDITED_ZEROCLAW_V069_TOP_LEVEL_ALIASES,
  ]),
);

function formatUnknownKeyReason(
  unknownTopLevelKeys: readonly string[],
): string {
  return `Refusing future mutation readiness because the resolved config contains unaudited top-level keys: ${unknownTopLevelKeys.join(", ")}.`;
}

export function preflightMutationReadiness(
  commandProbe: ZeroClawCommandProbe,
  inspection: SavedConfigInspection,
): ConfigMutationPreflight {
  if (commandProbe.support !== "supported_v0_6_9") {
    return {
      outcome: "unsupported_version",
      reason:
        "Read-only foundations only support audited ZeroClaw v0.6.9; later mutation work remains gated for every other runtime.",
      unknownTopLevelKeys: [],
    };
  }

  switch (inspection.status) {
    case "missing":
      return {
        outcome: "eligible_first_run",
        reason:
          "No saved config exists at the resolved path, so first-run mutation proof can proceed later on the audited v0.6.9 runtime.",
        unknownTopLevelKeys: [],
      };
    case "unreadable":
      return {
        outcome: "config_unreadable",
        reason: `Resolved config exists but could not be inspected safely: ${inspection.error}`,
        unknownTopLevelKeys: [],
      };
    case "inspected": {
      const unknownTopLevelKeys = inspection.topLevelKeys.filter(
        (key) => !AUDITED_ZEROCLAW_V069_TOP_LEVEL_KEYS.has(key),
      );

      if (unknownTopLevelKeys.length > 0) {
        return {
          outcome: "unsupported_shape_unknown_top_level_keys",
          reason: formatUnknownKeyReason(unknownTopLevelKeys),
          unknownTopLevelKeys,
        };
      }

      return {
        outcome: "eligible_existing_config",
        reason:
          "Resolved config shape stays within the audited ZeroClaw v0.6.9 top-level contract for later provider-only mutation work.",
        unknownTopLevelKeys: [],
      };
    }
    default:
      return {
        outcome: "config_unreadable",
        reason: "Saved config inspection returned an unsupported state.",
        unknownTopLevelKeys: [],
      };
  }
}
