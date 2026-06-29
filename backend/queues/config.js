const { getRedisConnection, getRedisUrl } = require("../lib/redis");
const QUEUE_NAMES = Object.freeze({ PRIORITY_COMMANDS: "priority_commands", BACKGROUND_EVENTS: "background_events" });
function getBullMqPrefix() { return process.env.BULLMQ_PREFIX || "civitas"; }
function getWorkerConcurrency() { return Number(process.env.WORKER_CONCURRENCY || 1); }
function defaultJobOptions(action = {}) { return { attempts: Number(action.maxAttempts || process.env.WORKER_JOB_ATTEMPTS || 3), backoff: { type: "exponential", delay: Number(process.env.WORKER_JOB_BACKOFF_MS || 5000) }, removeOnComplete: Number(process.env.WORKER_REMOVE_ON_COMPLETE || 1000), removeOnFail: Number(process.env.WORKER_REMOVE_ON_FAIL || 5000) }; }
function createRedisConnection() { return getRedisConnection(); }
function createQueue(name, action = {}) { const { Queue } = require("bullmq"); return new Queue(name, { connection: createRedisConnection(), prefix: getBullMqPrefix(), defaultJobOptions: defaultJobOptions(action) }); }
module.exports = { QUEUE_NAMES, createQueue, createRedisConnection, defaultJobOptions, getBullMqPrefix, getRedisUrl, getWorkerConcurrency };
