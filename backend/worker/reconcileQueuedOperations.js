const { inArray } = require("drizzle-orm");
const { getDb, schema } = require("../lib/db");
const { enqueueActionOperation, getActionJobSnapshot } = require("../queues/actionQueue");
async function reconcileQueuedOperations({ db = getDb(), dbSchema = schema, limit = 50 } = {}) {
  const operations = await db.select().from(dbSchema.operationalOperations).where(inArray(dbSchema.operationalOperations.status, ["pending", "queued", "retry_scheduled"])).limit(limit);
  const results = [];
  for (const operation of operations) { const snapshot = await getActionJobSnapshot(operation); if (!snapshot) { const job = await enqueueActionOperation(operation); results.push({ operationId: operation.id, requeued: true, jobId: job.id }); } else results.push({ operationId: operation.id, requeued: false, jobId: snapshot.jobId }); }
  return results;
}
module.exports = { reconcileQueuedOperations };
