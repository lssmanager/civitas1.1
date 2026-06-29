class LogtoConnectorError extends Error { constructor(message, details = {}) { super(message); this.name = "LogtoConnectorError"; this.details = details; } }
module.exports = { LogtoConnectorError };
