const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ConnectorNotConfiguredError,
  getConnector,
  listRegisteredAdapters,
} = require("../connectors/registry");
const { MockLMSAdapter, registerMockAdapters } = require("../connectors/adapters/mock");

registerMockAdapters();

test("registry loads the adapter configured by capability", async () => {
  const lms = await getConnector("org-uuid", "lms", {
    loadConnectorRow: async ({ orgId, capability }) => ({
      org_id: orgId,
      capability,
      adapter: "mock",
      status: "connected",
      config: { latencyMs: 7 },
    }),
  });

  assert.ok(lms instanceof MockLMSAdapter);
  const health = await lms.ping();
  assert.equal(health.status, "HEALTHY");
  assert.equal(health.latency_ms, 7);
  assert.ok(listRegisteredAdapters().some((item) => item.capability === "lms" && item.adapter === "mock"));
});

test("registry throws a typed error when capability is not configured", async () => {
  await assert.rejects(
    () => getConnector("org-uuid", "crm", { loadConnectorRow: async () => null }),
    ConnectorNotConfiguredError,
  );
});
