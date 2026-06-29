class FluentCrmError extends Error { constructor(message, details = {}) { super(message); this.name = "FluentCrmError"; this.details = details; } }
module.exports = { FluentCrmError };
