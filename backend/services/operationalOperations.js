const { getDb, schema } = require("../lib/db");
const { enqueueActionOperation } = require("../queues/actionQueue");
const { getRuntimeQueueConfig } = require("./runtime/config");

const READY = ["pending", "retry_scheduled"];

async function createOperation(input) {
  const db = getDb();
  const queueName = input.queueName || getRuntimeQueueConfig().queueName;
  const [operation] = await db.insert(schema.operationalOperations).values({ logtoOrganizationId: input.logtoOrganizationId || null, operationType: input.actionType || input.operationType, entityType: input.entityType || "operational_task", entityId: input.entityId || null, inputJson: input.inputJson || {}, maxAttempts: input.maxAttempts || 3, queueName, idempotencyKey: input.idempotencyKey || null }).onConflictDoNothing().returning();
  const row = operation || (input.idempotencyKey ? (await db.select().from(schema.operationalOperations).where(require("drizzle-orm").eq(schema.operationalOperations.idempotencyKey, input.idempotencyKey)).limit(1))[0] : null);
  if (row) await enqueueOperation(row.id, { queueName });
  return row;
}

async function enqueueOperation(operationId, { queueName = getRuntimeQueueConfig().queueName } = {}) {
  const [operation] = await getDb().select().from(schema.operationalOperations).where(require("drizzle-orm").eq(schema.operationalOperations.id, operationId)).limit(1);
  const job = await enqueueActionOperation(operation || { id: operationId, operationType: "system.echo" }, { queueName });
  await getDb().update(schema.operationalOperations).set({ status: "queued", queueName, jobId: String(job.id), updatedAt: new Date() }).where(require("drizzle-orm").eq(schema.operationalOperations.id, operationId));
  return job;
}

async function claimNextOperation({ workerId, queueName = getRuntimeQueueConfig().queueName, now = new Date() } = {}) {
  const db = getDb();
  const { sql } = require("drizzle-orm");
  const result = await db.execute(sql`
    update operational_operations
       set status = 'processing', claimed_by = ${workerId}, claimed_at = ${now}, attempts = attempts + 1, queue_name = ${queueName}, updated_at = ${now}
     where id = (
       select id from operational_operations
        where status in ('pending','queued','retry_scheduled')
          and (next_retry_at is null or next_retry_at <= ${now})
        order by priority desc, created_at asc
        for update skip locked
        limit 1
     )
     returning *
  `);
  return result.rows?.[0] || null;
}

async function startOperationStep({ operationId, stepName, queueName, jobId, inputJson = {} }) {
  const [step] = await getDb().insert(schema.operationalOperationSteps).values({ operationId, stepName, status: "processing", queueName, jobId: jobId ? String(jobId) : null, inputJson, startedAt: new Date() }).returning();
  return step;
}
async function completeOperation({ operationId, stepId, outputJson = {} }) {
  const db = getDb(); const now = new Date();
  if (stepId) await db.update(schema.operationalOperationSteps).set({ status: "completed", outputJson, completedAt: now, updatedAt: now }).where(require("drizzle-orm").eq(schema.operationalOperationSteps.id, stepId));
  const [row] = await db.update(schema.operationalOperations).set({ status: "completed", outputJson, completedAt: now, updatedAt: now }).where(require("drizzle-orm").eq(schema.operationalOperations.id, operationId)).returning();
  await db.insert(schema.auditLogs).values({ logtoOrganizationId: row?.logtoOrganizationId || null, actorType: "worker", action: "operational_operation_completed", targetType: "operational_operation", targetId: operationId, result: "success", metadata: { operationId } });
  return row;
}
async function failOperation({ operation, stepId, error }) {
  const db = getDb(); const now = new Date(); const attempts = Number(operation.attempts || 0); const maxAttempts = Number(operation.max_attempts || operation.maxAttempts || 3);
  const retryable = attempts < maxAttempts; const status = retryable ? "retry_scheduled" : "failed"; const nextRetryAt = retryable ? new Date(now.getTime() + Math.min(300000, 5000 * 2 ** Math.max(0, attempts - 1))) : null;
  const errorJson = { message: error.message, name: error.name, retryable, at: now.toISOString() };
  if (stepId) await db.update(schema.operationalOperationSteps).set({ status, lastErrorJson: errorJson, completedAt: retryable ? null : now, updatedAt: now }).where(require("drizzle-orm").eq(schema.operationalOperationSteps.id, stepId));
  const [row] = await db.update(schema.operationalOperations).set({ status, lastErrorJson: errorJson, nextRetryAt, updatedAt: now, completedAt: retryable ? null : now }).where(require("drizzle-orm").eq(schema.operationalOperations.id, operation.id)).returning();
  await db.insert(schema.auditLogs).values({ logtoOrganizationId: operation.logto_organization_id || operation.logtoOrganizationId || null, actorType: "worker", action: retryable ? "operational_operation_retry_scheduled" : "operational_operation_failed", targetType: "operational_operation", targetId: operation.id, result: retryable ? "retry" : "error", metadata: { operationId: operation.id, error: errorJson } });
  return row;
}
async function listOperationalState({ limit = 100 } = {}) {
  const db = getDb();
  const [operations, steps, auditLogRows] = await Promise.all([db.select().from(schema.operationalOperations).orderBy(require("drizzle-orm").sql`created_at desc`).limit(limit), db.select().from(schema.operationalOperationSteps).orderBy(require("drizzle-orm").sql`created_at desc`).limit(limit), db.select().from(schema.auditLogs).orderBy(require("drizzle-orm").sql`created_at desc`).limit(limit)]);
  return { operations, steps, auditLogRows };
}
module.exports = { claimNextOperation, completeOperation, createOperation, enqueueOperation, failOperation, listOperationalState, startOperationStep };
