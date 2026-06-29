-- Civitas operational foundation schema managed by Drizzle.
-- Logto remains canonical for identity, organizations, memberships, roles and tokens.
-- Civitas PostgreSQL stores only local operational state, audit, queue state and registry resolution data.

create extension if not exists pgcrypto;

create table if not exists local_users (
  id uuid primary key default gen_random_uuid(),
  logto_user_id varchar(128) not null unique,
  email_snapshot varchar(255),
  display_name_snapshot varchar(255),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists local_users_logto_user_id_idx on local_users(logto_user_id);

create table if not exists operational_tenants (
  id uuid primary key default gen_random_uuid(),
  logto_organization_id varchar(128) not null unique,
  name_snapshot varchar(255),
  operational_status varchar(40) not null default 'active',
  last_logto_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists operational_tenants_logto_org_id_idx on operational_tenants(logto_organization_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  logto_organization_id varchar(128),
  actor_logto_user_id varchar(128),
  actor_type varchar(40) not null default 'system',
  action varchar(120) not null,
  target_type varchar(80),
  target_id varchar(160),
  result varchar(40) not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  ip varchar(80),
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_logto_org_idx on audit_logs(logto_organization_id);
create index if not exists audit_logs_action_idx on audit_logs(action);
create index if not exists audit_logs_actor_idx on audit_logs(actor_logto_user_id);

create table if not exists operational_operations (
  id uuid primary key default gen_random_uuid(),
  logto_organization_id varchar(128),
  operation_type varchar(120) not null,
  entity_type varchar(80) not null default 'operational_task',
  entity_id varchar(160),
  status varchar(40) not null default 'pending',
  priority integer not null default 0,
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  last_error_json jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz,
  claimed_by varchar(160),
  claimed_at timestamptz,
  queue_name varchar(120),
  job_id varchar(160),
  idempotency_key varchar(200),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_operations_attempts_check check (attempts >= 0 and max_attempts > 0)
);
create index if not exists operational_operations_status_idx on operational_operations(status, next_retry_at);
create index if not exists operational_operations_logto_org_idx on operational_operations(logto_organization_id);
create unique index if not exists operational_operations_idempotency_idx on operational_operations(idempotency_key) where idempotency_key is not null;

create table if not exists operational_operation_steps (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operational_operations(id) on delete cascade,
  step_name varchar(120) not null,
  status varchar(40) not null default 'queued',
  queue_name varchar(120),
  job_id varchar(160),
  input_json jsonb not null default '{}'::jsonb,
  output_json jsonb not null default '{}'::jsonb,
  last_error_json jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operational_steps_operation_idx on operational_operation_steps(operation_id);
create index if not exists operational_steps_status_idx on operational_operation_steps(status);

create table if not exists registry_capabilities (
  id uuid primary key default gen_random_uuid(),
  key varchar(80) not null unique,
  status varchar(40) not null default 'active',
  description text,
  contract jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists registry_adapters (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references registry_capabilities(id) on delete cascade,
  key varchar(100) not null,
  status varchar(40) not null default 'available',
  module_ref varchar(255),
  operational_config_schema jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registry_adapters_capability_key_unique unique (capability_id, key)
);

create table if not exists registry_connectors (
  id uuid primary key default gen_random_uuid(),
  adapter_id uuid not null references registry_adapters(id) on delete cascade,
  key varchar(120) not null,
  status varchar(40) not null default 'configured',
  config jsonb not null default '{}'::jsonb,
  secrets_ref varchar(255),
  last_ping_at timestamptz,
  last_error_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registry_connectors_adapter_key_unique unique (adapter_id, key)
);

create table if not exists registry_connector_bindings (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references registry_connectors(id) on delete cascade,
  scope_type varchar(40) not null default 'tenant',
  logto_organization_id varchar(128),
  status varchar(40) not null default 'active',
  is_active boolean not null default true,
  routing_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registry_bindings_tenant_scope_check check (scope_type <> 'tenant' or logto_organization_id is not null)
);
create index if not exists registry_bindings_scope_idx on registry_connector_bindings(scope_type, logto_organization_id);
create index if not exists registry_bindings_active_idx on registry_connector_bindings(is_active, status);

insert into registry_capabilities (key, description)
values
  ('crm', 'Customer relationship management capability'),
  ('marketing', 'Marketing automation capability'),
  ('lms', 'Learning management capability'),
  ('community', 'Community capability'),
  ('payments', 'Payments capability'),
  ('notifications', 'Notifications capability'),
  ('support', 'Support capability'),
  ('analytics', 'Analytics capability')
on conflict (key) do nothing;

create table if not exists capability_role_mappings (
  id uuid primary key default gen_random_uuid(),
  logto_organization_id varchar(128),
  capability varchar(80) not null,
  connector_key varchar(120),
  canonical_role_id varchar(128),
  canonical_role_name varchar(160) not null,
  downstream_role_key varchar(160),
  downstream_role_name varchar(160) not null,
  downstream_role_slug varchar(160),
  downstream_permissions jsonb not null default '[]'::jsonb,
  downstream_entitlements jsonb not null default '[]'::jsonb,
  membership_constraints jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists capability_role_mappings_lookup_idx on capability_role_mappings(logto_organization_id, capability, connector_key, canonical_role_name);
create index if not exists capability_role_mappings_active_idx on capability_role_mappings(is_active);

create table if not exists idempotency_records (
  idempotency_key varchar(220) primary key,
  operation_id uuid,
  action_type varchar(120) not null,
  status varchar(40) not null default 'completed',
  result_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
