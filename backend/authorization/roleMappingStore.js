async function loadMappingsFromDb({ db, schema, logtoOrganizationId, orgId, capability, connectorKey, canonicalRoleId, canonicalRoleName }) {
  if (!db || !schema?.capabilityRoleMappings) return [];
  const { and, eq, isNull, or } = require("drizzle-orm");
  return db.select().from(schema.capabilityRoleMappings).where(and(eq(schema.capabilityRoleMappings.isActive, true), eq(schema.capabilityRoleMappings.capability, capability), or(eq(schema.capabilityRoleMappings.logtoOrganizationId, logtoOrganizationId || orgId || ""), isNull(schema.capabilityRoleMappings.logtoOrganizationId)), or(eq(schema.capabilityRoleMappings.connectorKey, connectorKey || ""), isNull(schema.capabilityRoleMappings.connectorKey)), or(eq(schema.capabilityRoleMappings.canonicalRoleId, canonicalRoleId || ""), eq(schema.capabilityRoleMappings.canonicalRoleName, canonicalRoleName))));
}
function createMemoryRoleMappingStore(seed = []) {
  const rows = [...seed];
  return { async listMappings(filter = {}) { return rows.filter((row) => (row.isActive !== false) && (!filter.capability || row.capability === filter.capability) && (!filter.canonicalRoleName || row.canonicalRoleName === filter.canonicalRoleName) && (!filter.canonicalRoleId || row.canonicalRoleId === filter.canonicalRoleId || row.canonicalRoleId == null) && (row.logtoOrganizationId == null || row.logtoOrganizationId === filter.logtoOrganizationId || row.orgId === filter.orgId) && (row.connectorKey == null || row.connectorKey === filter.connectorKey)); }, async insert(row) { rows.push({ ...row, isActive: row.isActive !== false }); return row; } };
}
module.exports = { createMemoryRoleMappingStore, loadMappingsFromDb };
