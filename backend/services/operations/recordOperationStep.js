const { eq } = require("drizzle-orm");
async function recordOperationStep({ db, schema, operationId, stepName, status, queueName, jobId, inputJson = {}, outputJson = {}, lastErrorJson = null }) {
  const now = new Date();
  const [row] = await db.insert(schema.operationalOperationSteps).values({ operationId, stepName, status, queueName, jobId: jobId ? String(jobId) : null, inputJson, outputJson, lastErrorJson, startedAt: status.includes("taken") || status === "processing" ? now : null, completedAt: ["completed", "failed", "idempotency.hit"].includes(status) ? now : null, updatedAt: now }).returning();
  return row;
}
module.exports = { recordOperationStep };
