-- Civitas Phase 0 foundation schema
-- Source of truth by domain:
-- identity lives in Logto; Civitas DB stores operational state, snapshots, sync and audit.

create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  logto_organization_id varchar(100) unique,
  name varchar(255) not null,
  type varchar(30),
  status varchar(30) default 'trial',
  plan varchar(50),
  seats_total integer default 0,
  seats_used integer default 0,
  renewal_date timestamp,
  subdomain varchar(100) unique,
  branding jsonb,
  invitation_policy jsonb,
  role_policy jsonb,
  sync_config jsonb,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  logto_user_id varchar(100) not null unique,
  email_snapshot varchar(255),
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  logto_role varchar(50),
  status varchar(20) default 'active',
  joined_at timestamp default now(),
  constraint memberships_org_user_unique unique (org_id, user_id)
);

create table if not exists seats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  status varchar(20) not null,
  assigned_at timestamp,
  released_at timestamp,
  created_at timestamp default now()
);

create table if not exists org_connectors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  capability varchar(50) not null,
  adapter varchar(50) not null,
  routing_strategy varchar(30) default 'single',
  config jsonb not null,
  status varchar(20) default 'not_configured',
  last_ping timestamp,
  last_error varchar(500),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  constraint org_capability_unique unique (org_id, capability)
);

create table if not exists organization_runtime_state (
  org_id uuid not null references organizations(id) on delete cascade,
  capability varchar(50) not null,
  state_key varchar(100) not null,
  state_value jsonb not null,
  updated_at timestamp default now(),
  primary key (org_id, capability, state_key)
);

create table if not exists sync_operations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  action_type varchar(100) not null,
  status varchar(30) not null,
  input jsonb,
  output jsonb,
  error text,
  attempt integer default 1,
  max_attempts integer default 3,
  next_retry_at timestamp,
  idempotency_key varchar(200),
  created_at timestamp default now(),
  completed_at timestamp
);

create index if not exists sync_operations_org_id_idx on sync_operations(org_id);
create index if not exists sync_operations_idempotency_key_idx on sync_operations(idempotency_key);
create index if not exists sync_operations_status_idx on sync_operations(status);

create table if not exists sync_operation_steps (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references sync_operations(id) on delete cascade,
  step_name varchar(100) not null,
  status varchar(20) not null,
  input jsonb,
  output jsonb,
  error text,
  started_at timestamp,
  completed_at timestamp
);

create table if not exists sync_operation_items (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid references sync_operations(id) on delete cascade,
  step_id uuid references sync_operation_steps(id) on delete cascade,
  entity_type varchar(50) not null,
  entity_id varchar(200) not null,
  status varchar(30) not null,
  error text,
  metadata jsonb,
  created_at timestamp default now()
);

create table if not exists idempotency_records (
  idempotency_key varchar(200) primary key,
  operation_type varchar(100) not null,
  scope varchar(100),
  status varchar(20) not null,
  result jsonb,
  ttl_seconds integer default 86400,
  expires_at timestamp not null,
  created_at timestamp default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  actor_id varchar(100),
  actor_type varchar(30),
  action varchar(100) not null,
  target_type varchar(50),
  target_id varchar(100),
  result varchar(20),
  metadata jsonb,
  ip varchar(50),
  user_agent varchar(500),
  created_at timestamp default now()
);

create index if not exists audit_logs_org_id_idx on audit_logs(org_id);
create index if not exists audit_logs_action_idx on audit_logs(action);
