const { eq } = require("drizzle-orm");
async function loadOperation({ db, schema, operationId }) { const rows = await db.select().from(schema.operationalOperations).where(eq(schema.operationalOperations.id, operationId)).limit(1); return rows[0] || null; }
async function updateOperationStatus({ db, schema, operationId, status, patch = {} }) { const [row] = await db.update(schema.operationalOperations).set({ status, updatedAt: new Date(), ...patch }).where(eq(schema.operationalOperations.id, operationId)).returning(); return row; }
module.exports = { loadOperation, updateOperationStatus };
