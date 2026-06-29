# Civitas Phase 0 Foundation

This folder tracks the executable foundation for Civitas 1.1.

Phase 0 is not a feature phase. It creates the contracts and guardrails that later modules must use.

## Included in this foundation pass

- Canonical capability and permission constants.
- RBAC matrix with global and organization roles.
- Connector registry with typed errors.
- Mock LMS and CRM adapters for verification tests.
- ActionDefinition validation.
- Idempotent action engine with operation and idempotency recording.
- Foundation schema migration SQL.
- Two standard runtime queues: `priority_commands` and `background_events`.
- Tests for registry loading, typed registry errors, action execution and idempotency.

## Files

- `backend/contracts/foundation.js`
- `backend/rbac/matrix.js`
- `backend/connectors/registry.js`
- `backend/connectors/adapters/mock.js`
- `backend/worker/actionDefinition.js`
- `backend/worker/engine.js`
- `backend/worker/foundationStore.js`
- `backend/db/schema/foundation.js`
- `backend/db/migrations/0000_foundation.sql`
- `backend/tests/foundationRegistry.test.js`
- `backend/tests/foundationWorkerEngine.test.js`

## Rules

1. API routes must talk to capabilities, never vendor adapters.
2. Adapters are loaded through the connector registry only.
3. Worker actions must provide input validation, preconditions, retry policy and idempotency key.
4. RBAC reads roles from Logto claims and maps them to Civitas permissions.
5. Postgres stores operational state, snapshots, sync and audit. Logto remains the source of truth for identity.
6. Redis powers runtime and worker queues.

## Verification

Run from `backend`:

```bash
npm test
```

The foundation tests correspond to the document's required checks:

1. Registry loads the adapter configured for a capability.
2. Registry raises a typed error when a capability is not configured.
3. Engine executes an action, records success and saves idempotency.
4. Second execution with the same idempotency key returns the cached result and does not create a second operation.
