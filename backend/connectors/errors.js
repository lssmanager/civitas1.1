class ConnectorError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "ConnectorError"; this.code = code; this.details = details; }
}
const codes = Object.freeze({
  CAPABILITY_UNSUPPORTED: "CONNECTOR_CAPABILITY_UNSUPPORTED",
  PROVIDER_UNSUPPORTED: "CONNECTOR_PROVIDER_UNSUPPORTED",
  NOT_CONFIGURED: "CONNECTOR_NOT_CONFIGURED",
  CONFIG_INVALID: "CONNECTOR_CONFIG_INVALID",
  ACTION_UNSUPPORTED: "CONNECTOR_ACTION_UNSUPPORTED",
  HEALTHCHECK_FAILED: "CONNECTOR_HEALTHCHECK_FAILED",
});
const connectorError = (code, message, details) => new ConnectorError(code, message, details);
module.exports = { ConnectorError, codes, connectorError };
