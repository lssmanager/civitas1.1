const client = require("./client");
const { createAdapterHealth } = require("../../adapterContract");
const { codes, connectorError } = require("../../errors");
const { validateLogtoConfig, sanitizeLogtoConfig } = require("./config");
const actions = ["identity.organization.get", "identity.organization.roles.list", "identity.organization.memberships.list"];
function createLogtoAdapter(config = {}) {
  return {
    capability: "identity",
    provider: "logto",
    actions,
    async healthcheck() { return createAdapterHealth({ status: validateLogtoConfig(config) ? "HEALTHY" : "DEGRADED", last_successful_ping: validateLogtoConfig(config) ? new Date().toISOString() : null, error: validateLogtoConfig(config) ? undefined : "Logto endpoint not configured" }); },
    async execute(action, input = {}, context = {}) {
      if (!actions.includes(action)) throw connectorError(codes.ACTION_UNSUPPORTED, `Unsupported Logto action ${action}`, { action });
      if (action === "identity.organization.get") return client.getLogtoOrganizationById(input.organizationId || input.logtoOrganizationId);
      if (action === "identity.organization.roles.list") return client.listLogtoOrganizationRoles();
      if (action === "identity.organization.memberships.list" && typeof client.listLogtoOrganizationMemberships === "function") return client.listLogtoOrganizationMemberships(input.organizationId || input.logtoOrganizationId);
      return { action, provider: "logto", config: sanitizeLogtoConfig(config), deferred: true, context: { orgId: context.orgId || null } };
    },
  };
}
module.exports = { createLogtoAdapter };
