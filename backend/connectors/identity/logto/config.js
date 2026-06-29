function resolveLogtoConfig(config = {}) {
  return {
    endpoint: config.endpoint || process.env.LOGTO_ENDPOINT || null,
    managementTokenEndpoint: config.managementTokenEndpoint || process.env.LOGTO_MANAGEMENT_API_TOKEN_ENDPOINT || null,
    applicationId: config.applicationId || process.env.LOGTO_MANAGEMENT_API_APPLICATION_ID || null,
    applicationSecret: config.applicationSecret || process.env.LOGTO_MANAGEMENT_API_APPLICATION_SECRET || null,
    resource: config.resource || process.env.LOGTO_MANAGEMENT_API_RESOURCE || null,
    timeoutMs: Number(config.timeoutMs || process.env.LOGTO_MANAGEMENT_TIMEOUT_MS || 8000),
  };
}
function validateLogtoConfig(config = {}) { const c = resolveLogtoConfig(config); return Boolean(c.endpoint); }
function sanitizeLogtoConfig(config = {}) { const c = resolveLogtoConfig(config); return { ...c, applicationSecret: c.applicationSecret ? "[redacted]" : null }; }
module.exports = { resolveLogtoConfig, sanitizeLogtoConfig, validateLogtoConfig };
