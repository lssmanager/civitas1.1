const { relations, sql } = require("drizzle-orm");
const { pgTable, uuid, varchar, text, integer, timestamp, jsonb, boolean, uniqueIndex, index } = require("drizzle-orm/pg-core");

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const localUsers = pgTable("local_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  logtoUserId: varchar("logto_user_id", { length: 128 }).notNull().unique(),
  emailSnapshot: varchar("email_snapshot", { length: 255 }),
  displayNameSnapshot: varchar("display_name_snapshot", { length: 255 }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
}, (table) => ({ logtoUserIdx: uniqueIndex("local_users_logto_user_id_idx").on(table.logtoUserId) }));

const operationalTenants = pgTable("operational_tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  logtoOrganizationId: varchar("logto_organization_id", { length: 128 }).notNull().unique(),
  nameSnapshot: varchar("name_snapshot", { length: 255 }),
  operationalStatus: varchar("operational_status", { length: 40 }).notNull().default("active"),
  lastLogtoSyncAt: timestamp("last_logto_sync_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
}, (table) => ({ logtoOrgIdx: uniqueIndex("operational_tenants_logto_org_id_idx").on(table.logtoOrganizationId) }));

const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  logtoOrganizationId: varchar("logto_organization_id", { length: 128 }),
  actorLogtoUserId: varchar("actor_logto_user_id", { length: 128 }),
  actorType: varchar("actor_type", { length: 40 }).notNull().default("system"),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("target_type", { length: 80 }),
  targetId: varchar("target_id", { length: 160 }),
  result: varchar("result", { length: 40 }).notNull().default("success"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  ip: varchar("ip", { length: 80 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ orgIdx: index("audit_logs_logto_org_idx").on(table.logtoOrganizationId), actionIdx: index("audit_logs_action_idx").on(table.action), actorIdx: index("audit_logs_actor_idx").on(table.actorLogtoUserId) }));

const operationalOperations = pgTable("operational_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  logtoOrganizationId: varchar("logto_organization_id", { length: 128 }),
  operationType: varchar("operation_type", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull().default("operational_task"),
  entityId: varchar("entity_id", { length: 160 }),
  status: varchar("status", { length: 40 }).notNull().default("pending"),
  priority: integer("priority").notNull().default(0),
  inputJson: jsonb("input_json").notNull().default(sql`'{}'::jsonb`),
  outputJson: jsonb("output_json").notNull().default(sql`'{}'::jsonb`),
  lastErrorJson: jsonb("last_error_json"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  claimedBy: varchar("claimed_by", { length: 160 }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  queueName: varchar("queue_name", { length: 120 }),
  jobId: varchar("job_id", { length: 160 }),
  idempotencyKey: varchar("idempotency_key", { length: 200 }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({ statusIdx: index("operational_operations_status_idx").on(table.status, table.nextRetryAt), orgIdx: index("operational_operations_logto_org_idx").on(table.logtoOrganizationId), idemIdx: uniqueIndex("operational_operations_idempotency_idx").on(table.idempotencyKey) }));

const operationalOperationSteps = pgTable("operational_operation_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  operationId: uuid("operation_id").notNull().references(() => operationalOperations.id, { onDelete: "cascade" }),
  stepName: varchar("step_name", { length: 120 }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("queued"),
  queueName: varchar("queue_name", { length: 120 }),
  jobId: varchar("job_id", { length: 160 }),
  inputJson: jsonb("input_json").notNull().default(sql`'{}'::jsonb`),
  outputJson: jsonb("output_json").notNull().default(sql`'{}'::jsonb`),
  lastErrorJson: jsonb("last_error_json"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({ opIdx: index("operational_steps_operation_idx").on(table.operationId), statusIdx: index("operational_steps_status_idx").on(table.status) }));

const capabilities = pgTable("registry_capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 80 }).notNull().unique(),
  status: varchar("status", { length: 40 }).notNull().default("active"),
  description: text("description"),
  contract: jsonb("contract").notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
});

const adapters = pgTable("registry_adapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  capabilityId: uuid("capability_id").notNull().references(() => capabilities.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 100 }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("available"),
  moduleRef: varchar("module_ref", { length: 255 }),
  operationalConfigSchema: jsonb("operational_config_schema").notNull().default(sql`'{}'::jsonb`),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
}, (table) => ({ uniqueCapabilityAdapter: uniqueIndex("registry_adapters_capability_key_idx").on(table.capabilityId, table.key) }));

const connectors = pgTable("registry_connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  adapterId: uuid("adapter_id").notNull().references(() => adapters.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 120 }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("configured"),
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  secretsRef: varchar("secrets_ref", { length: 255 }),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
  lastErrorJson: jsonb("last_error_json"),
  ...timestamps,
}, (table) => ({ uniqueAdapterConnector: uniqueIndex("registry_connectors_adapter_key_idx").on(table.adapterId, table.key) }));

const connectorBindings = pgTable("registry_connector_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectorId: uuid("connector_id").notNull().references(() => connectors.id, { onDelete: "cascade" }),
  scopeType: varchar("scope_type", { length: 40 }).notNull().default("tenant"),
  logtoOrganizationId: varchar("logto_organization_id", { length: 128 }),
  status: varchar("status", { length: 40 }).notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  routingConfig: jsonb("routing_config").notNull().default(sql`'{}'::jsonb`),
  ...timestamps,
}, (table) => ({ scopeIdx: index("registry_bindings_scope_idx").on(table.scopeType, table.logtoOrganizationId), activeIdx: index("registry_bindings_active_idx").on(table.isActive, table.status) }));


const capabilityRoleMappings = pgTable("capability_role_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  logtoOrganizationId: varchar("logto_organization_id", { length: 128 }),
  capability: varchar("capability", { length: 80 }).notNull(),
  connectorKey: varchar("connector_key", { length: 120 }),
  canonicalRoleId: varchar("canonical_role_id", { length: 128 }),
  canonicalRoleName: varchar("canonical_role_name", { length: 160 }).notNull(),
  downstreamRoleKey: varchar("downstream_role_key", { length: 160 }),
  downstreamRoleName: varchar("downstream_role_name", { length: 160 }).notNull(),
  downstreamRoleSlug: varchar("downstream_role_slug", { length: 160 }),
  downstreamPermissions: jsonb("downstream_permissions").notNull().default(sql`'[]'::jsonb`),
  downstreamEntitlements: jsonb("downstream_entitlements").notNull().default(sql`'[]'::jsonb`),
  membershipConstraints: jsonb("membership_constraints").notNull().default(sql`'{}'::jsonb`),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (table) => ({ lookupIdx: index("capability_role_mappings_lookup_idx").on(table.logtoOrganizationId, table.capability, table.connectorKey, table.canonicalRoleName), activeIdx: index("capability_role_mappings_active_idx").on(table.isActive) }));

const idempotencyRecords = pgTable("idempotency_records", {
  idempotencyKey: varchar("idempotency_key", { length: 220 }).primaryKey(),
  operationId: uuid("operation_id"),
  actionType: varchar("action_type", { length: 120 }).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("completed"),
  resultJson: jsonb("result_json").notNull().default(sql`'{}'::jsonb`),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

module.exports = { localUsers, operationalTenants, auditLogs, operationalOperations, operationalOperationSteps, capabilities, adapters, connectors, connectorBindings, capabilityRoleMappings, idempotencyRecords };
