const test = require("node:test");
const assert = require("node:assert/strict");
const { connectorRegistry, codes } = require("../connectors/registry");
const { createMemoryRoleMappingStore } = require("../authorization/roleMappingStore");
const { resolveRoleMapping } = require("../authorization/roleMappingResolver");
const { getActionJobId, selectQueueForAction } = require("../queues/actionQueue");
const { getActionDefinition } = require("../worker/actionCatalog");

const seedMappings = [
  { logtoOrganizationId: "org-x", capability: "lms", connectorKey: "mock", canonicalRoleName: "ROL_A", downstreamRoleName: "ROL_AA" },
  { logtoOrganizationId: "org-x", capability: "community", connectorKey: "mock", canonicalRoleName: "ROL_A", downstreamRoleName: "ROL_A" },
  { logtoOrganizationId: "org-x", capability: "crm", connectorKey: "mock", canonicalRoleName: "ROL_A", downstreamRoleName: "ROL.A" },
  { logtoOrganizationId: "org-y", capability: "lms", connectorKey: "mock", canonicalRoleName: "ROL_A", downstreamRoleName: "ROL_ESTUDIANTE" },
  { logtoOrganizationId: "org-y", capability: "crm", connectorKey: "mock", canonicalRoleName: "ROL_A", downstreamRoleName: "STUDENT_SEGMENT" },
  { capability: "support", canonicalRoleName: "ROL_A", downstreamRoleName: "SUPPORT_DEFAULT" },
];

test("connector registry resolves base identity/logto adapter", () => {
  const adapter = connectorRegistry.resolve({ capability: "identity", provider: "logto", config: { endpoint: "https://logto.example" } });
  assert.equal(adapter.capability, "identity");
  assert.equal(adapter.provider, "logto");
  assert.ok(Array.isArray(adapter.actions));
  assert.equal(typeof adapter.healthcheck, "function");
  assert.equal(typeof adapter.execute, "function");
});

test("connector registry throws typed unsupported capability/provider/config errors", () => {
  assert.throws(() => connectorRegistry.resolve({ capability: "erp", provider: "odoo" }), { code: codes.CAPABILITY_UNSUPPORTED });
  assert.throws(() => connectorRegistry.resolve({ capability: "crm", provider: "salesforce" }), { code: codes.PROVIDER_UNSUPPORTED });
  assert.throws(() => connectorRegistry.resolve({ capability: "crm", provider: "fluentcrm", config: {} }), { code: codes.CONFIG_INVALID });
});

test("role mapping resolves the same canonical role differently by org and capability", async () => {
  const store = createMemoryRoleMappingStore(seedMappings);
  const common = { connectorKey: "mock", canonicalRoleName: "ROL_A", membershipContext: { membershipId: "mem-1", status: "active" } };
  assert.equal((await resolveRoleMapping({ ...common, orgId: "org-x", logtoOrganizationId: "org-x", capability: "lms" }, { store })).downstream.roleName, "ROL_AA");
  assert.equal((await resolveRoleMapping({ ...common, orgId: "org-x", logtoOrganizationId: "org-x", capability: "community" }, { store })).downstream.roleName, "ROL_A");
  assert.equal((await resolveRoleMapping({ ...common, orgId: "org-x", logtoOrganizationId: "org-x", capability: "crm" }, { store })).downstream.roleName, "ROL.A");
  assert.equal((await resolveRoleMapping({ ...common, orgId: "org-y", logtoOrganizationId: "org-y", capability: "lms" }, { store })).downstream.roleName, "ROL_ESTUDIANTE");
  assert.equal((await resolveRoleMapping({ ...common, orgId: "org-y", logtoOrganizationId: "org-y", capability: "crm" }, { store })).downstream.roleName, "STUDENT_SEGMENT");
});

test("role mapping uses capability default and separates canonical/membership/downstream", async () => {
  const store = createMemoryRoleMappingStore(seedMappings);
  const result = await resolveRoleMapping({ orgId: "org-z", logtoOrganizationId: "org-z", capability: "support", canonicalRoleId: "role-a", canonicalRoleName: "ROL_A", membershipContext: { membershipId: "mem-z", status: "active" } }, { store });
  assert.equal(result.canonical.roleName, "ROL_A");
  assert.equal(result.membership.source, "logto");
  assert.equal(result.downstream.roleName, "SUPPORT_DEFAULT");
  assert.equal(result.mappingSource, "capability_default");
});

test("action definitions expose canonical queues and idempotency keys", () => {
  assert.equal(getActionJobId({ id: "op-1" }), "action-operation-op-1");
  assert.equal(selectQueueForAction("system.echo"), "priority_commands");
  assert.equal(selectQueueForAction("system.fail_retryable"), "background_events");
  const roleMapping = getActionDefinition("role_mapping.resolve");
  assert.equal(roleMapping.queue, "priority_commands");
  assert.equal(roleMapping.idempotencyKey({ orgId: "org-x", capability: "lms", canonicalRoleName: "ROL_A" }), "role_mapping.resolve:org-x:default:lms:ROL_A");
});
