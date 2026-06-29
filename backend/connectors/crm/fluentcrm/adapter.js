const { createAdapterHealth } = require("../../adapterContract");
const { codes, connectorError } = require("../../errors");
const { buildAuthHeader, getFluentCrmDiagnostic, normalizeBaseUrl } = require("./client");
const { buildFluentCrmCompanyPayload } = require("./mappers");
const actions = ["crm.company.find", "crm.company.upsert", "crm.company.verify", "crm.contact.upsert", "crm.tags.ensure", "crm.lists.ensure"];
function validateConfig(config = {}) { return Boolean(normalizeBaseUrl(config.baseUrl) && buildAuthHeader(config)); }
function createFluentCrmAdapter(config = {}) {
  if (!validateConfig(config)) throw connectorError(codes.CONFIG_INVALID, "FluentCRM config requires baseUrl and apiKey or username/password");
  return {
    capability: "crm",
    provider: "fluentcrm",
    actions,
    async healthcheck() { const diag = await getFluentCrmDiagnostic(config); return createAdapterHealth({ status: diag.configured ? "HEALTHY" : "UNHEALTHY", last_successful_ping: diag.configured ? new Date().toISOString() : null, error: diag.configured ? undefined : "FluentCRM config invalid" }); },
    async execute(action, input = {}, context = {}) {
      if (!actions.includes(action)) throw connectorError(codes.ACTION_UNSUPPORTED, `Unsupported FluentCRM action ${action}`, { action });
      if (action === "crm.company.upsert") return { deferred: true, provider: "fluentcrm", action, payload: buildFluentCrmCompanyPayload(input), context: { orgId: context.orgId || null } };
      return { deferred: true, provider: "fluentcrm", action, input };
    },
  };
}
module.exports = { createFluentCrmAdapter, validateConfig };
