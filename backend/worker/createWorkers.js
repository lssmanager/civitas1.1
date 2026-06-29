const { Worker } = require("bullmq");
const { QUEUE_NAMES, createRedisConnection, getBullMqPrefix, getWorkerConcurrency } = require("../queues/config");
const { executeActionJob } = require("./executeActionJob");
function logWorkerEvent(event) { console.log(JSON.stringify({ component: "civitas-worker", ...event })); }
function createWorkers(context = {}) { return Object.values(QUEUE_NAMES).map((queueName) => { const worker = new Worker(queueName, (job) => executeActionJob(job, context), { connection: createRedisConnection(), prefix: getBullMqPrefix(), concurrency: getWorkerConcurrency() }); worker.on("completed", (job) => logWorkerEvent({ queueName, jobId: job.id, actionType: job.name, operationId: job.data?.operationId, status: "completed", attemptsMade: job.attemptsMade })); worker.on("failed", (job, error) => logWorkerEvent({ queueName, jobId: job?.id, actionType: job?.name, operationId: job?.data?.operationId, status: "failed", attemptsMade: job?.attemptsMade, error: error.message })); worker.on("error", (error) => logWorkerEvent({ queueName, status: "error", error: error.message })); return worker; }); }
module.exports = { createWorkers };
