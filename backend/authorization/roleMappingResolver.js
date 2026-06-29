const { ROLE_MAPPING_NOT_CONFIGURED, RoleMappingError } = require("./roleMappingErrors");
const { isSupportedCapability } = require("../connectors/capabilityCatalog");

function scoreMapping(row, input) {
  let score = 0;
  if (row.logtoOrganizationId && row.logtoOrganizationId === (input.logtoOrganizationId || input.orgId)) score += 100;
  if (row.orgId && row.orgId === input.orgId) score += 100;
  if (row.connectorKey && row.connectorKey === input.connectorKey) score += 20;
  if (row.capability === input.capability) score += 10;
  if (row.canonicalRoleId && row.canonicalRoleId === input.canonicalRoleId) score += 5;
  if (row.canonicalRoleName && row.canonicalRoleName === input.canonicalRoleName) score += 4;
  if (!row.logtoOrganizationId && !row.orgId) score += 1;
  return score;
}
function sourceFor(row, input) {
  if ((row.logtoOrganizationId && row.logtoOrganizationId === (input.logtoOrganizationId || input.orgId)) || (row.orgId && row.orgId === input.orgId)) return row.connectorKey ? "connector_override" : "org_override";
  if (row.capability === input.capability) return "capability_default";
  return "global_default";
}
async function resolveRoleMapping(input = {}, { store } = {}) {
  const { orgId, capability, connectorKey = null, canonicalRoleId = null, canonicalRoleName, logtoOrganizationId = orgId, membershipContext = {} } = input;
  if (!isSupportedCapability(capability)) throw new RoleMappingError("ROLE_MAPPING_CAPABILITY_UNSUPPORTED", `Unsupported capability ${capability}`, { capability });
  const rows = store?.listMappings ? await store.listMappings({ orgId, logtoOrganizationId, capability, connectorKey, canonicalRoleId, canonicalRoleName }) : [];
  const candidates = rows.filter((row) => row.capability === capability && (row.canonicalRoleId === canonicalRoleId || row.canonicalRoleName === canonicalRoleName));
  const selected = candidates.sort((a, b) => scoreMapping(b, input) - scoreMapping(a, input))[0];
  if (!selected) throw new RoleMappingError(ROLE_MAPPING_NOT_CONFIGURED, `No role mapping configured for ${capability}/${canonicalRoleName}`, { orgId, capability, connectorKey, canonicalRoleId, canonicalRoleName });
  return {
    orgId,
    capability,
    connectorKey,
    canonical: { roleId: canonicalRoleId || selected.canonicalRoleId || null, roleName: canonicalRoleName || selected.canonicalRoleName, source: "logto" },
    membership: { source: "logto", organizationId: logtoOrganizationId, membershipId: membershipContext.membershipId || null, status: membershipContext.status || null, metadata: membershipContext.metadata || {} },
    downstream: { roleKey: selected.downstreamRoleKey || selected.downstream_role_key || selected.downstreamRoleName, roleName: selected.downstreamRoleName || selected.downstream_role_name, roleSlug: selected.downstreamRoleSlug || selected.downstream_role_slug || null, permissions: selected.downstreamPermissions || selected.downstream_permissions || [], entitlementKeys: selected.downstreamEntitlements || selected.downstream_entitlements || [], metadata: selected.metadata || {} },
    mappingSource: sourceFor(selected, input),
    freshness: { source: selected.freshnessSource || "cached", generatedAt: new Date().toISOString() },
  };
}
module.exports = { resolveRoleMapping, scoreMapping };
