function normalizeBaseUrl(value) { return String(value || "").replace(/\/+$/, ""); }
function buildAuthHeader(config = {}) { if (config.apiKey) return `Bearer ${config.apiKey}`; if (config.username && config.password) return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`; return null; }
function sanitizeForDiagnostics(config = {}) { return { ...config, apiKey: config.apiKey ? "[redacted]" : undefined, password: config.password ? "[redacted]" : undefined }; }
async function requestFluentCrm(_path, _options = {}, _context = {}) { throw new Error("FluentCRM live requests are adapter-owned and not implemented in Phase 0 tests"); }
async function getFluentCrmDiagnostic(config = {}) { return { configured: Boolean(normalizeBaseUrl(config.baseUrl) && buildAuthHeader(config)), baseUrl: normalizeBaseUrl(config.baseUrl), config: sanitizeForDiagnostics(config) }; }
module.exports = { buildAuthHeader, getFluentCrmDiagnostic, normalizeBaseUrl, requestFluentCrm, sanitizeForDiagnostics };
