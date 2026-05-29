import assert from "node:assert/strict";
import test from "node:test";
import {
  MODEL_CATALOG,
  resolveModelByKey,
} from "../../src/constants/models.js";
import {
  fetchCuratedGonkaGateModelCatalog,
  GONKAGATE_MODELS_ENDPOINT,
  GonkaGateModelsError,
  requireModelInGonkaGateCatalog,
} from "../../src/install/gonkagate-models.js";

function createSuccessfulCatalogBody() {
  return {
    data: [
      {
        id: "unsupported/live-model",
      },
      ...MODEL_CATALOG.map((model) => ({
        id: model.modelId,
      })),
    ],
    object: "list",
  };
}

test("fetchCuratedGonkaGateModelCatalog uses the canonical /v1/models endpoint with Bearer auth", async () => {
  let capturedUrl: string | undefined;
  let capturedAuthorization: string | undefined;

  const catalog = await fetchCuratedGonkaGateModelCatalog("gp-test-catalog", {
    async fetchImpl(url, init) {
      capturedUrl = url;
      capturedAuthorization = init.headers.Authorization;

      return {
        status: 200,
        async json() {
          return createSuccessfulCatalogBody();
        },
      };
    },
    maxAttempts: 1,
  });

  assert.equal(capturedUrl, "https://api.gonkagate.com/v1/models");
  assert.equal(capturedUrl, GONKAGATE_MODELS_ENDPOINT);
  assert.equal(capturedAuthorization, "Bearer gp-test-catalog");
  assert.deepEqual(
    catalog.curatedModels.map((model) => model.key),
    MODEL_CATALOG.map((model) => model.key),
  );
  assert.equal(catalog.liveModelCount, MODEL_CATALOG.length + 1);
});

test("fetchCuratedGonkaGateModelCatalog retries temporary catalog unavailability", async () => {
  let calls = 0;

  const catalog = await fetchCuratedGonkaGateModelCatalog("gp-test-catalog", {
    async fetchImpl() {
      calls += 1;

      if (calls === 1) {
        return {
          status: 503,
          async json() {
            return {};
          },
        };
      }

      return {
        status: 200,
        async json() {
          return createSuccessfulCatalogBody();
        },
      };
    },
    maxAttempts: 2,
    retryDelayMs: 0,
  });

  assert.equal(calls, 2);
  assert.deepEqual(
    catalog.curatedModels.map((model) => model.modelId),
    MODEL_CATALOG.map((model) => model.modelId),
  );
});

test("fetchCuratedGonkaGateModelCatalog rejects auth failures", async () => {
  await assert.rejects(
    fetchCuratedGonkaGateModelCatalog("gp-bad-catalog", {
      async fetchImpl() {
        return {
          status: 401,
          async json() {
            return {
              error: {
                code: "invalid_api_key",
              },
            };
          },
        };
      },
      maxAttempts: 1,
    }),
    (error) => {
      assert.ok(error instanceof GonkaGateModelsError);
      assert.equal(error.kind, "authentication_failed");
      assert.equal(error.status, 401);
      return true;
    },
  );
});

test("fetchCuratedGonkaGateModelCatalog rejects malformed response shapes", async () => {
  await assert.rejects(
    fetchCuratedGonkaGateModelCatalog("gp-test-catalog", {
      async fetchImpl() {
        return {
          status: 200,
          async json() {
            return {
              data: [
                {
                  id: 42,
                },
              ],
            };
          },
        };
      },
      maxAttempts: 1,
    }),
    (error) => {
      assert.ok(error instanceof GonkaGateModelsError);
      assert.equal(error.kind, "invalid_response");
      assert.match(error.message, /data\[0\]\.id/);
      return true;
    },
  );
});

test("fetchCuratedGonkaGateModelCatalog rejects catalogs missing curated models", async () => {
  await assert.rejects(
    fetchCuratedGonkaGateModelCatalog("gp-test-catalog", {
      async fetchImpl() {
        return {
          status: 200,
          async json() {
            return {
              data: [
                {
                  id: resolveModelByKey("qwen3-235b").modelId,
                },
              ],
            };
          },
        };
      },
      maxAttempts: 1,
    }),
    (error) => {
      assert.ok(error instanceof GonkaGateModelsError);
      assert.equal(error.kind, "missing_supported_models");
      assert.match(error.message, /moonshotai\/Kimi-K2\.6/);
      return true;
    },
  );
});

test("requireModelInGonkaGateCatalog keeps selection inside the curated live catalog", async () => {
  const catalog = await fetchCuratedGonkaGateModelCatalog("gp-test-catalog", {
    async fetchImpl() {
      return {
        status: 200,
        async json() {
          return createSuccessfulCatalogBody();
        },
      };
    },
    maxAttempts: 1,
  });

  assert.doesNotThrow(() =>
    requireModelInGonkaGateCatalog(resolveModelByKey("kimi-k2.6"), catalog),
  );
});
