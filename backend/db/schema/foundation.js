const FOUNDATION_TABLES = Object.freeze([
  "organizations",
  "users",
  "memberships",
  "seats",
  "org_connectors",
  "organization_runtime_state",
  "sync_operations",
  "sync_operation_steps",
  "sync_operation_items",
  "idempotency_records",
  "audit_logs",
]);

const FOUNDATION_SCHEMA_ORDER = Object.freeze({
  organizations: 1,
  users: 2,
  memberships: 3,
  seats: 4,
  org_connectors: 5,
  organization_runtime_state: 6,
  sync_operations: 7,
  sync_operation_steps: 8,
  sync_operation_items: 9,
  idempotency_records: 10,
  audit_logs: 11,
});

const FOUNDATION_CAPABILITIES = Object.freeze([
  "identity",
  "lms",
  "crm",
  "marketing",
  "support",
  "scheduling",
  "payments",
  "email",
  "storage",
  "analytics",
  "community",
]);

module.exports = {
  FOUNDATION_CAPABILITIES,
  FOUNDATION_SCHEMA_ORDER,
  FOUNDATION_TABLES,
};
