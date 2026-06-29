const { getFluentCrmDiagnostic } = require("./client");
function classifyFluentCrmValidationError(error) { return { retryable: false, code: error?.code || "FLUENTCRM_VALIDATION_ERROR", message: error?.message || "Invalid FluentCRM payload" }; }
module.exports = { classifyFluentCrmValidationError, getFluentCrmDiagnostic };
