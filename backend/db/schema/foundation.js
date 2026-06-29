const FOUNDATION_TABLES = Object.freeze([
  "local_users",
  "operational_tenants",
  "audit_logs",
  "operational_operations",
  "operational_operation_steps",
  "registry_capabilities",
  "registry_adapters",
  "registry_connectors",
  "registry_connector_bindings",
]);

const FOUNDATION_SCHEMA_ORDER = Object.freeze({
  local_users: 1,
  operational_tenants: 2,
  audit_logs: 3,
  operational_operations: 4,
  operational_operation_steps: 5,
  registry_capabilities: 6,
  registry_adapters: 7,
  registry_connectors: 8,
  registry_connector_bindings: 9,
});

const FOUNDATION_CAPABILITIES = Object.freeze([
  "crm",
  "marketing",
  "lms",
  "community",
  "payments",
  "notifications",
  "support",
  "analytics",
]);

module.exports = {
  FOUNDATION_CAPABILITIES,
  FOUNDATION_SCHEMA_ORDER,
  FOUNDATION_TABLES,
};
