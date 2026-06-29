const systemEcho = require("./actionDefinitions/system.echo");
const failRetryable = require("./actionDefinitions/system.fail_retryable");
const failNonRetryable = require("./actionDefinitions/system.fail_non_retryable");
const connectorHealthcheck = require("./actionDefinitions/connector.healthcheck");
const roleMappingResolve = require("./actionDefinitions/role_mapping.resolve");
const definitions = new Map([systemEcho, failRetryable, failNonRetryable, connectorHealthcheck, roleMappingResolve].map((definition) => [definition.type, definition]));
function getActionDefinition(type) { const definition = definitions.get(type); if (!definition) { const error = new Error(`Unknown action definition ${type}`); error.code = "ACTION_DEFINITION_NOT_FOUND"; throw error; } return definition; }
function listActionDefinitions() { return [...definitions.values()].map(({ type, capability, queue, maxAttempts }) => ({ type, capability, queue, maxAttempts })); }
module.exports = { getActionDefinition, listActionDefinitions };
