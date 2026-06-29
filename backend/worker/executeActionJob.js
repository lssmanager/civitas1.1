let UnrecoverableError; try { ({ UnrecoverableError } = require("bullmq")); } catch { UnrecoverableError = class UnrecoverableError extends Error { constructor(message) { super(message); this.name = "UnrecoverableError"; } }; }
const { getDb, schema } = require("../lib/db");
const { getActionDefinition } = require("./actionCatalog");
const { getIdempotencyRecord, saveIdempotencyRecord } = require("../services/operations/idempotency");
const { recordOperationStep } = require("../services/operations/recordOperationStep");
const { loadOperation, updateOperationStatus } = require("../services/operations/updateOperation");

async function executeActionJob(job, context = {}) {
  const db = context.db || getDb();
  const dbSchema = context.schema || schema;
  const operationId = job.data.operationId;
  const operation = await loadOperation({ db, schema: dbSchema, operationId });
  if (!operation) throw new UnrecoverableError(`Operation ${operationId} not found`);
  const actionType = job.data.actionType || operation.actionType || operation.operationType;
  const definition = getActionDefinition(actionType);
  const input = operation.inputJson || operation.input_json || {};
  if (definition.inputSchema && !definition.inputSchema(input)) throw new UnrecoverableError(`Invalid input for ${actionType}`);
  const idempotencyKey = definition.idempotencyKey?.(input, { operation, job }) || operation.idempotencyKey || null;
  const hit = await getIdempotencyRecord({ db, schema: dbSchema, idempotencyKey });
  if (hit) { await recordOperationStep({ db, schema: dbSchema, operationId, stepName: `${actionType}.idempotency.hit`, status: "idempotency.hit", queueName: job.queueName, jobId: job.id, outputJson: hit.resultJson || hit.result_json || {} }); return updateOperationStatus({ db, schema: dbSchema, operationId, status: "completed", patch: { outputJson: hit.resultJson || hit.result_json || {}, completedAt: new Date() } }); }
  await updateOperationStatus({ db, schema: dbSchema, operationId, status: "processing", patch: { claimedAt: new Date(), queueName: job.queueName, jobId: String(job.id) } });
  await recordOperationStep({ db, schema: dbSchema, operationId, stepName: `${actionType}.taken_by_worker`, status: "taken_by_worker", queueName: job.queueName, jobId: job.id, inputJson: input });
  try {
    if (definition.precondition) await definition.precondition(input, { operation, job, ...context });
    const output = await definition.execute(input, { operation, job, ...context });
    await recordOperationStep({ db, schema: dbSchema, operationId, stepName: `${actionType}.completed`, status: "completed", queueName: job.queueName, jobId: job.id, outputJson: output });
    await saveIdempotencyRecord({ db, schema: dbSchema, idempotencyKey, operationId, actionType, resultJson: output });
    return updateOperationStatus({ db, schema: dbSchema, operationId, status: "completed", patch: { outputJson: output, completedAt: new Date() } });
  } catch (error) {
    const retryable = error.retryable !== false && !error.unrecoverable;
    const errorJson = { message: error.message, name: error.name, retryable, at: new Date().toISOString() };
    await recordOperationStep({ db, schema: dbSchema, operationId, stepName: `${actionType}.failed`, status: "failed", queueName: job.queueName, jobId: job.id, lastErrorJson: errorJson });
    await updateOperationStatus({ db, schema: dbSchema, operationId, status: retryable ? "retry_scheduled" : "failed", patch: { lastErrorJson: errorJson, completedAt: retryable ? null : new Date() } });
    if (!retryable) throw new UnrecoverableError(error.message);
    throw error;
  }
}
module.exports = { executeActionJob };
