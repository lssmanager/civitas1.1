const { getDb, schema } = require("../lib/db");

async function ensureCapability({ key, description = null, contract = {} }) {
  const db = getDb();
  const [row] = await db.insert(schema.capabilities).values({ key, description, contract }).onConflictDoUpdate({ target: schema.capabilities.key, set: { description, contract, updatedAt: new Date() } }).returning();
  return row;
}
async function registerRegistryAdapter({ capabilityKey, adapterKey, moduleRef = null, status = "available", operationalConfigSchema = {}, metadata = {} }) {
  const capability = await ensureCapability({ key: capabilityKey });
  const [row] = await getDb().insert(schema.adapters).values({ capabilityId: capability.id, key: adapterKey, moduleRef, status, operationalConfigSchema, metadata }).onConflictDoUpdate({ target: [schema.adapters.capabilityId, schema.adapters.key], set: { moduleRef, status, operationalConfigSchema, metadata, updatedAt: new Date() } }).returning();
  return row;
}
async function registerConnector({ capabilityKey, adapterKey, connectorKey, config = {}, secretsRef = null, status = "configured" }) {
  const adapter = await registerRegistryAdapter({ capabilityKey, adapterKey });
  const [row] = await getDb().insert(schema.connectors).values({ adapterId: adapter.id, key: connectorKey, config, secretsRef, status }).onConflictDoUpdate({ target: [schema.connectors.adapterId, schema.connectors.key], set: { config, secretsRef, status, updatedAt: new Date() } }).returning();
  return row;
}
async function bindConnector({ connectorId, scopeType = "tenant", logtoOrganizationId = null, routingConfig = {}, status = "active" }) {
  const [row] = await getDb().insert(schema.connectorBindings).values({ connectorId, scopeType, logtoOrganizationId, routingConfig, status, isActive: status === "active" }).returning();
  return row;
}
async function loadConnectorRow({ orgId, logtoOrganizationId = orgId, capability }) {
  const db = getDb();
  const rows = await db.select({ capability: schema.capabilities.key, adapter: schema.adapters.key, connector: schema.connectors.key, status: schema.connectorBindings.status, config: schema.connectors.config, bindingId: schema.connectorBindings.id, connectorId: schema.connectors.id }).from(schema.connectorBindings).innerJoin(schema.connectors, eq(schema.connectorBindings.connectorId, schema.connectors.id)).innerJoin(schema.adapters, eq(schema.connectors.adapterId, schema.adapters.id)).innerJoin(schema.capabilities, eq(schema.adapters.capabilityId, schema.capabilities.id)).where(and(eq(schema.capabilities.key, capability), eq(schema.connectorBindings.logtoOrganizationId, logtoOrganizationId), eq(schema.connectorBindings.isActive, true))).limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, status: row.status === "active" ? "connected" : row.status };
}
async function listRegistry() {
  return getDb().select({ capability: schema.capabilities.key, adapter: schema.adapters.key, connector: schema.connectors.key, status: schema.connectors.status }).from(schema.capabilities).leftJoin(schema.adapters, eq(schema.adapters.capabilityId, schema.capabilities.id)).leftJoin(schema.connectors, eq(schema.connectors.adapterId, schema.adapters.id));
}
module.exports = { bindConnector, ensureCapability, listRegistry, loadConnectorRow, registerConnector, registerRegistryAdapter };
