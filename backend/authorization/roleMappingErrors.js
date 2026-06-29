class RoleMappingError extends Error { constructor(code, message, details = {}) { super(message); this.name = "RoleMappingError"; this.code = code; this.details = details; } }
const ROLE_MAPPING_NOT_CONFIGURED = "ROLE_MAPPING_NOT_CONFIGURED";
module.exports = { ROLE_MAPPING_NOT_CONFIGURED, RoleMappingError };
