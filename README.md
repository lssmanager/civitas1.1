# Civitas 1.1

Civitas 1.1 is the clean reconstruction foundation for the Civitas platform. It keeps the parts that already work well from the previous codebase and removes the contaminated owner UI and legacy operational surfaces that were mixing logs, snapshots, and partial truths.

This repository is no longer treated as the original Logto sample app. It now serves as the clean base for:

- Logto as the canonical identity, organizations, memberships, roles, permissions, tenant context, and token source
- a standardized operational backbone for Civitas
- an extensible RBAC contract for `owner_global`, `organization_admin`, and `organization_member`
- future capability-based modules such as CRM, Marketing, LMS, Community, and Payments

## Fuente canónica por dominio

- **Logto**: identity, authentication, organizations, memberships, roles, permissions, tenant context, and tokens
- **FluentCRM / WordPress**: commercial relationship, company, contacts, tags, lists, purchase, renewal, and commercial status
- **Moodle**: courses, enrollments, progress, and academic history
- **BuddyBoss**: groups, community, and social memberships
- **Civitas database**: operational metadata, audit data, synchronization state, mappings between systems, queues, events, reconciliation state, and cross-system operational rules

### What must not live canonically in PostgreSQL

- parallel organizations if Logto already defines the real organization
- parallel RBAC models if Logto already defines the real permissions and roles
- provider live state presented as if it were local truth without clear source labeling
- UI-specific summaries as if they were canonical business state

## What has already been migrated into this repository

### Identity and access foundation

- backend Logto authentication middleware
- backend Logto Management API integration
- owner-global organization provisioning endpoint
- organization creation in Logto from Civitas
- organization admin bootstrap in Logto from Civitas
- user and organization `customData` handling foundations
- frontend environment wiring for Logto and API connectivity

### Operational backbone foundation

- standardized operational action catalog
- standardized operational contract builders
- consolidated operational response JSON schema
- frontend operational contract types
- backend operational contract tests
- canonical operational JSON examples

### RBAC foundation

- frontend RBAC matrix separated for:
  - `owner_global`
  - `organization_admin`
  - `organization_member`

## What is intentionally not migrated yet

The following parts are intentionally not treated as the current baseline because they need a cleaner rebuild:

- owner dashboard UI
- organization operational console UI
- worker and queues UI
- logs UI as a primary support path
- any legacy surface that recomposes truth from partial snapshots or pushes users into circular navigation

## Repository structure

- `backend/`: Node.js API and Logto integration foundation
- `frontend/`: React frontend foundation and RBAC-aware route metadata
- `contracts/`: operational schemas
- `examples/`: canonical operational contract examples
- `docs/architecture/`: architectural backbone documentation
- `docker-compose.yml`: minimal two-service startup for backend and frontend

## Quick container start

If your deployment platform expects Docker Compose, this repository now exposes a root `docker-compose.yml`.

1. Copy the root environment file.

```bash
cp .env.example .env
```

2. Copy the backend environment file.

```bash
cp backend/.env.example backend/.env
```

3. Fill both files with your real Logto values.

4. Start the stack.

```bash
docker compose up --build
```

Services exposed by default:

- frontend: `http://localhost:4173`
- backend: `http://localhost:3000`

## Local setup

### Prerequisites

- Node.js 22+ recommended
- a Logto tenant
- one Logto SPA application for the frontend
- one Logto M2M application for backend management API access

## Backend setup

1. Go to the backend directory.

```bash
cd backend
```

2. Copy the environment file.

```bash
cp .env.example .env
```

3. Configure the backend environment.

Required variables:

- `LOGTO_ENDPOINT`
- `LOGTO_ISSUER`
- `LOGTO_JWKS_URI`
- `LOGTO_APP_ID`
- `LOGTO_APP_SECRET`
- `LOGTO_M2M_APP_ID`
- `LOGTO_M2M_APP_SECRET`
- `LOGTO_API_RESOURCE_INDICATOR`

Recommended Civitas-specific variables:

- `CIVITAS_ALLOWED_ORG_USER_GLOBAL_ROLES`
- `LOGTO_ENABLE_ADMIN_PASSWORD_RESET`
- `LOGTO_JWKS_TIMEOUT_MS`
- `LOGTO_JWT_VERIFY_TIMEOUT_MS`
- `LOGTO_MANAGEMENT_TIMEOUT_MS`

4. Install dependencies.

```bash
npm install
```

5. Run the backend.

```bash
npm run dev
```

### Backend health checks

Once running, validate:

- `GET /health` should return `ok: true`
- `GET /` should return the backend identity payload
- `GET /me` should work with a valid bearer token

### Current backend owner flow

The clean migrated owner-global route currently available is:

- `POST /owner/organizations`

This route is designed for a global owner token and should:

- create the Logto organization
- ensure the organization template exists
- add the bootstrap admin user to the organization
- assign the organization admin role when resolved

## Frontend setup

1. Go to the frontend directory.

```bash
cd frontend
```

2. Copy the frontend environment file.

```bash
cp .env.example .env
```

3. Configure the frontend environment.

Required variables:

- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `VITE_API_BASE_URL`
- `VITE_API_RESOURCE_INDICATOR`
- `VITE_APP_REDIRECT_URI`
- `VITE_APP_SIGNOUT_REDIRECT_URI`

4. Install dependencies.

```bash
npm install
```

5. Run the frontend.

```bash
npm run dev
```

## How to connect frontend and backend correctly

- the frontend must request access tokens for the same API resource configured in `VITE_API_RESOURCE_INDICATOR`
- the backend must validate those tokens against `LOGTO_API_RESOURCE_INDICATOR`
- owner-global routes must be protected by global roles, not by implicit organization membership
- organization-scoped routes must remain separate from global-owner routes

## Current validation targets

At this stage, validate these first:

1. frontend login through Logto
2. backend token verification through Logto JWKS
3. `GET /me` payload shape
4. owner-global organization creation through `POST /owner/organizations`
5. operational contract tests with `npm test` in `backend`
6. compose startup with `docker compose up --build`

## Architecture notes

This repository is intended to evolve as a capability-based Civitas platform:

- identity
- CRM
- Marketing
- LMS
- Community
- Payments
- worker action engine
- operational-state
- worker-queues

Each capability should be introduced through:

- a stable contract
- adapters per provider
- operational observability
- standardized actions
- explicit canonical source boundaries

## Next migration layer

The next layer to migrate after this clean foundation is:

1. operational state assembler and observability services after cleanup
2. connector registry
3. CRM capability contract from the FluentCRM foundations
4. worker action engine
5. clean owner-facing UI surfaces rebuilt on top of the backbone
