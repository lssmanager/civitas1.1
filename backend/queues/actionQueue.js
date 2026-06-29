const { createQueue, QUEUE_NAMES } = require("./config");
const { getActionDefinition } = require("../worker/actionCatalog");
const queueCache = new Map();
function getActionJobId(operation) { return `action-operation-${operation.id}`; }
function selectQueueForAction(actionType) { return getActionDefinition(actionType).queue || QUEUE_NAMES.BACKGROUND_EVENTS; }
function getQueue(name) { if (!queueCache.has(name)) queueCache.set(name, createQueue(name)); return queueCache.get(name); }
async function enqueueActionOperation(operation, options = {}) { const actionType = operation.actionType || operation.operationType; const queueName = options.queueName || selectQueueForAction(actionType); const queue = getQueue(queueName); const jobId = options.jobId || getActionJobId(operation); return queue.add(actionType, { operationId: operation.id, actionType, orgId: operation.logtoOrganizationId || operation.orgId || null }, { jobId, ...options }); }
async function getActionJobSnapshot(operationOrJobId) { const jobId = typeof operationOrJobId === "string" ? operationOrJobId : getActionJobId(operationOrJobId); for (const name of Object.values(QUEUE_NAMES)) { const queue = getQueue(name); const job = await queue.getJob(jobId); if (job) return { queueName: name, jobId, state: await job.getState(), data: job.data, attemptsMade: job.attemptsMade }; } return null; }
async function closeActionQueues() { await Promise.all([...queueCache.values()].map((queue) => queue.close())); queueCache.clear(); }
module.exports = { closeActionQueues, enqueueActionOperation, getActionJobId, getActionJobSnapshot, selectQueueForAction };
