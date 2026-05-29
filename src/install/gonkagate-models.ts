import { setTimeout as delay } from "node:timers/promises";
import { GONKAGATE_BASE_URL } from "../constants/gateway.js";
import { MODEL_CATALOG, type CuratedModel } from "../constants/models.js";
import type { InstallHttpClient, InstallHttpResponse } from "./deps.js";

export const GONKAGATE_MODELS_ENDPOINT = `${GONKAGATE_BASE_URL.replace(/\/$/, "")}/models`;

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_TIMEOUT_MS = 10_000;

export type GonkaGateModelsFailureKind =
  | "authentication_failed"
  | "catalog_unavailable"
  | "invalid_response"
  | "missing_selected_model"
  | "missing_supported_models"
  | "no_supported_models"
  | "request_failed";

export interface FetchGonkaGateModelsOptions {
  readonly fetchImpl?: InstallHttpClient["fetch"];
  readonly maxAttempts?: number;
  readonly retryDelayMs?: number;
  readonly timeoutMs?: number;
}

export interface GonkaGateModelCatalogEntry {
  readonly id: string;
}

export interface CuratedGonkaGateModelCatalog {
  readonly curatedModels: readonly CuratedModel[];
  readonly endpoint: string;
  readonly liveModelCount: number;
}

interface GonkaGateModelCatalog {
  readonly models: readonly GonkaGateModelCatalogEntry[];
}

export class GonkaGateModelsError<
  Kind extends GonkaGateModelsFailureKind = GonkaGateModelsFailureKind,
> extends Error {
  readonly actual?: string;
  readonly expected?: string;
  readonly kind: Kind;
  readonly status?: number;

  constructor(
    options: {
      readonly actual?: string;
      readonly expected?: string;
      readonly kind: Kind;
      readonly message: string;
      readonly status?: number;
    } & ErrorOptions,
  ) {
    super(options.message, options);
    this.name = new.target.name;
    this.actual = options.actual;
    this.expected = options.expected;
    this.kind = options.kind;
    this.status = options.status;
  }
}

export async function fetchCuratedGonkaGateModelCatalog(
  apiKey: string,
  options: FetchGonkaGateModelsOptions = {},
): Promise<CuratedGonkaGateModelCatalog> {
  const catalog = await fetchGonkaGateModelCatalog(apiKey, options);
  const curatedModels = createCuratedGonkaGateModelCatalog(catalog.models);
  const curatedModelIds = new Set(curatedModels.map((model) => model.modelId));
  const missingSupportedModels = MODEL_CATALOG.filter(
    (model) => !curatedModelIds.has(model.modelId),
  );

  if (curatedModels.length === 0) {
    throw new GonkaGateModelsError({
      expected: MODEL_CATALOG.map((model) => model.modelId).join(", "),
      kind: "no_supported_models",
      message:
        `GonkaGate ${GONKAGATE_MODELS_ENDPOINT} did not return any curated supported models. ` +
        `Expected at least one of: ${MODEL_CATALOG.map((model) => model.modelId).join(", ")}.`,
    });
  }

  if (missingSupportedModels.length > 0) {
    throw new GonkaGateModelsError({
      actual: catalog.models.map((model) => model.id).join(", "),
      expected: MODEL_CATALOG.map((model) => model.modelId).join(", "),
      kind: "missing_supported_models",
      message:
        `GonkaGate ${GONKAGATE_MODELS_ENDPOINT} did not return every curated supported model. ` +
        `Missing: ${missingSupportedModels.map((model) => model.modelId).join(", ")}.`,
    });
  }

  return {
    curatedModels,
    endpoint: GONKAGATE_MODELS_ENDPOINT,
    liveModelCount: catalog.models.length,
  };
}

export function requireModelInGonkaGateCatalog(
  selectedModel: CuratedModel,
  catalog: CuratedGonkaGateModelCatalog,
): void {
  if (catalog.curatedModels.some((model) => model.key === selectedModel.key)) {
    return;
  }

  throw new GonkaGateModelsError({
    actual: selectedModel.modelId,
    expected: catalog.curatedModels.length
      ? catalog.curatedModels.map((model) => model.modelId).join(", ")
      : MODEL_CATALOG.map((model) => model.modelId).join(", "),
    kind: "missing_selected_model",
    message:
      `Selected curated model "${selectedModel.key}" (${selectedModel.modelId}) was not returned by ` +
      `GonkaGate ${GONKAGATE_MODELS_ENDPOINT}. Choose a currently available curated model and rerun the installer.`,
  });
}

async function fetchGonkaGateModelCatalog(
  apiKey: string,
  options: FetchGonkaGateModelsOptions,
): Promise<GonkaGateModelCatalog> {
  const fetchImpl = options.fetchImpl ?? fetchGonkaGateModels;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const retryDelayMs = Math.max(
    0,
    options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
  );
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let lastCatalogUnavailable:
    | GonkaGateModelsError<"catalog_unavailable">
    | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: InstallHttpResponse;

    try {
      response = await fetchImpl(GONKAGATE_MODELS_ENDPOINT, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      throw new GonkaGateModelsError({
        cause,
        kind: "request_failed",
        message: `Unable to fetch GonkaGate models from ${GONKAGATE_MODELS_ENDPOINT}: ${getErrorMessage(cause) ?? "unknown error"}.`,
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new GonkaGateModelsError({
        kind: "authentication_failed",
        message:
          `GonkaGate rejected the API key while fetching ${GONKAGATE_MODELS_ENDPOINT}. ` +
          "Check the gp-... key and rerun the installer.",
        status: response.status,
      });
    }

    if (response.status === 503) {
      lastCatalogUnavailable = new GonkaGateModelsError({
        kind: "catalog_unavailable",
        message:
          `GonkaGate model catalog is temporarily unavailable (${GONKAGATE_MODELS_ENDPOINT} returned HTTP 503). ` +
          "Rerun the installer in a moment.",
        status: response.status,
      });

      if (attempt < maxAttempts) {
        await delay(retryDelayMs);
        continue;
      }

      throw lastCatalogUnavailable;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new GonkaGateModelsError({
        kind: "request_failed",
        message: `GonkaGate ${GONKAGATE_MODELS_ENDPOINT} returned unexpected HTTP ${response.status}.`,
        status: response.status,
      });
    }

    return parseGonkaGateModelCatalog(await readJsonResponse(response));
  }

  throw (
    lastCatalogUnavailable ??
    new GonkaGateModelsError({
      kind: "request_failed",
      message: `Unable to fetch GonkaGate models from ${GONKAGATE_MODELS_ENDPOINT}.`,
    })
  );
}

async function fetchGonkaGateModels(
  url: string,
  init: {
    readonly headers: Record<string, string>;
    readonly signal?: AbortSignal;
  },
): Promise<InstallHttpResponse> {
  return await fetch(url, init);
}

async function readJsonResponse(
  response: InstallHttpResponse,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    throw new GonkaGateModelsError({
      cause,
      kind: "invalid_response",
      message: `GonkaGate ${GONKAGATE_MODELS_ENDPOINT} did not return valid JSON.`,
    });
  }
}

function parseGonkaGateModelCatalog(value: unknown): GonkaGateModelCatalog {
  const root = asPlainObject(value);

  if (!root) {
    throw invalidCatalogResponse("data", "object with a data array", value);
  }

  if (!Array.isArray(root.data)) {
    throw invalidCatalogResponse("data", "array", root.data);
  }

  return {
    models: root.data.map((entry, index) =>
      parseGonkaGateModelEntry(entry, index),
    ),
  };
}

function parseGonkaGateModelEntry(
  value: unknown,
  index: number,
): GonkaGateModelCatalogEntry {
  const raw = asPlainObject(value);
  const fieldPrefix = `data[${index}]`;

  if (!raw) {
    throw invalidCatalogResponse(fieldPrefix, "object", value);
  }

  if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
    throw invalidCatalogResponse(
      `${fieldPrefix}.id`,
      "non-empty string",
      raw.id,
    );
  }

  return {
    id: raw.id.trim(),
  };
}

function createCuratedGonkaGateModelCatalog(
  liveModels: readonly GonkaGateModelCatalogEntry[],
): CuratedModel[] {
  const liveById = new Set(liveModels.map((model) => model.id));

  return MODEL_CATALOG.filter((model) => liveById.has(model.modelId));
}

function invalidCatalogResponse(
  fieldPath: string,
  expected: string,
  actualValue: unknown,
): GonkaGateModelsError<"invalid_response"> {
  return new GonkaGateModelsError({
    actual: describeValue(actualValue),
    expected,
    kind: "invalid_response",
    message:
      `GonkaGate ${GONKAGATE_MODELS_ENDPOINT} returned an unexpected response. ` +
      `Expected "${fieldPath}" to be ${expected}, found ${describeValue(actualValue)}.`,
  });
}

function asPlainObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function describeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function getErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}
