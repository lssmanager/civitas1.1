const { Queue, Worker, QueueEvents } = require("bullmq");
const { getRedisConnection } = require("../../lib/redis");
const { getRuntimeQueueConfig } = require("./config");

const queues = new Map();
const queueEvents = new Map();

function bullConnection() { return getRedisConnection(); }
function getQueue(name = getRuntimeQueueConfig().queueName) {
  const config = getRuntimeQueueConfig();
  if (!queues.has(name)) queues.set(name, new Queue(name, { connection: bullConnection(), prefix: config.prefix, defaultJobOptions: { attempts: Number(process.env.WORKER_JOB_ATTEMPTS || 3), backoff: { type: "exponential", delay: Number(process.env.WORKER_JOB_BACKOFF_MS || 5000) }, removeOnComplete: Number(process.env.WORKER_REMOVE_ON_COMPLETE || 1000), removeOnFail: Number(process.env.WORKER_REMOVE_ON_FAIL || 5000) } }));
  return queues.get(name);
}
function getQueueEvents(name = getRuntimeQueueConfig().queueName) {
  const config = getRuntimeQueueConfig();
  if (!queueEvents.has(name)) queueEvents.set(name, new QueueEvents(name, { connection: bullConnection(), prefix: config.prefix }));
  return queueEvents.get(name);
}
async function enqueueOperationalJob({ queueName, name = "operational-operation", operationId, payload = {}, options = {} }) {
  const queue = getQueue(queueName);
  return queue.add(name, { operationId, ...payload }, { jobId: options.jobId || operationId, ...options });
}
function createOperationalWorker({ queueName = getRuntimeQueueConfig().queueName, processor, concurrency = Number(process.env.WORKER_CONCURRENCY || 1) }) {
  return new Worker(queueName, processor, { connection: bullConnection(), prefix: getRuntimeQueueConfig().prefix, concurrency });
}
async function getBullQueueTelemetry(config = getRuntimeQueueConfig()) {
  const queuesConfig = config.queueNames.map((name) => ({ name }));
  return Promise.all(queuesConfig.map(async ({ name }) => {
    const queue = getQueue(name);
    const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
    const jobs = await queue.getJobs(["waiting", "active", "delayed", "failed"], 0, 0, true);
    const oldest = jobs[0]?.timestamp ? new Date(jobs[0].timestamp).toISOString() : null;
    return { name, redisBase: `${config.prefix}:${name}`, waiting: counts.waiting || 0, active: counts.active || 0, delayed: counts.delayed || 0, failed: counts.failed || 0, completed: counts.completed || 0, oldestJobAt: oldest, oldestJobAgeSeconds: oldest ? Math.floor((Date.now() - new Date(oldest).getTime()) / 1000) : 0, source: "bullmq" };
  }));
}
async function closeBullRuntime() { await Promise.all([...queues.values()].map((q)=>q.close()).concat([...queueEvents.values()].map((q)=>q.close()))); queues.clear(); queueEvents.clear(); }
module.exports = { closeBullRuntime, createOperationalWorker, enqueueOperationalJob, getBullQueueTelemetry, getQueue, getQueueEvents };
