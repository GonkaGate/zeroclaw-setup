import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchGonkaGateModelCatalog,
  GONKAGATE_MODELS_ENDPOINT,
  GonkaGateModelsError,
  requireModelInGonkaGateCatalog,
} from "../../src/install/gonkagate-models.js";

function createSuccessfulCatalogBody() {
  return {
    data: [
      {
        id: "live/unknown-a",
        name: "Unknown A",
      },
      {
        id: "live/unknown-b",
      },
      {
        id: "live/unknown-a",
        name: "Duplicate ignored",
      },
    ],
    object: "list",
  };
}

test("fetchGonkaGateModelCatalog uses the canonical /v1/models endpoint with Bearer auth", async () => {
  let capturedUrl: string | undefined;
  let capturedAuthorization: string | undefined;

  const catalog = await fetchGonkaGateModelCatalog("gp-test-catalog", {
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
  assert.deepEqual(catalog.models, [
    {
      id: "live/unknown-a",
      name: "Unknown A",
    },
    {
      id: "live/unknown-b",
    },
  ]);
  assert.equal(catalog.liveModelCount, 2);
});

test("fetchGonkaGateModelCatalog retries temporary catalog unavailability", async () => {
  let calls = 0;

  const catalog = await fetchGonkaGateModelCatalog("gp-test-catalog", {
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
    catalog.models.map((model) => model.id),
    ["live/unknown-a", "live/unknown-b"],
  );
});

test("fetchGonkaGateModelCatalog rejects auth failures", async () => {
  await assert.rejects(
    fetchGonkaGateModelCatalog("gp-bad-catalog", {
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

test("fetchGonkaGateModelCatalog rejects malformed response shapes", async () => {
  await assert.rejects(
    fetchGonkaGateModelCatalog("gp-test-catalog", {
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

test("fetchGonkaGateModelCatalog rejects empty catalogs", async () => {
  await assert.rejects(
    fetchGonkaGateModelCatalog("gp-test-catalog", {
      async fetchImpl() {
        return {
          status: 200,
          async json() {
            return {
              data: [],
            };
          },
        };
      },
      maxAttempts: 1,
    }),
    (error) => {
      assert.ok(error instanceof GonkaGateModelsError);
      assert.equal(error.kind, "empty_catalog");
      return true;
    },
  );
});

test("requireModelInGonkaGateCatalog validates explicit selections against live ids", async () => {
  const catalog = await fetchGonkaGateModelCatalog("gp-test-catalog", {
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

  assert.deepEqual(requireModelInGonkaGateCatalog("live/unknown-b", catalog), {
    id: "live/unknown-b",
  });
  assert.throws(
    () => requireModelInGonkaGateCatalog("live/removed", catalog),
    /Selected model "live\/removed"/,
  );
});
