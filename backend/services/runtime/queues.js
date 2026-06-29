const { redisCommand } = require("../../lib/redis");
const { getRuntimeQueueConfig } = require("./config");

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readQueueMetric(redis, command, key) {
  try {
    const value = await redis([command, key]);
    return Number(value || 0);
  } catch {
    return 0;
  }
}

async function readListHead(redis, key) {
  try {
    const value = await redis(["LRANGE", key, "0", "0"]);
    return Array.isArray(value) && value.length ? String(value[0]) : null;
  } catch {
    return null;
  }
}

async function readSortedSetHead(redis, key) {
  try {
    const value = await redis(["ZRANGE", key, "0", "0", "WITHSCORES"]);
    if (!Array.isArray(value) || value.length < 2) return null;
    return { member: String(value[0]), score: Number(value[1]) || null };
  } catch {
    return null;
  }
}

function normalizeJobRedisKey(queueRedisBase, jobId) {
  if (!jobId) return null;
  const raw = String(jobId);
  if (raw.startsWith(`${queueRedisBase}:`)) return raw;
  return `${queueRedisBase}:${raw}`;
}

async function readJobTiming(redis, queueRedisBase, jobId) {
  const jobKey = normalizeJobRedisKey(queueRedisBase, jobId);
  if (!jobKey) return null;
  try {
    const value = await redis(["HMGET", jobKey, "timestamp", "processedOn", "finishedOn"]);
    if (!Array.isArray(value)) return null;
    return {
      timestamp: toPositiveNumber(value[0]),
      processedOn: toPositiveNumber(value[1]),
      finishedOn: toPositiveNumber(value[2]),
      jobKey,
    };
  } catch {
    return null;
  }
}

function selectOldestTimestampMs(candidates = []) {
  return candidates.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b)[0] || null;
}

async function readQueueOldestJobAt(redis, queueRedisBase) {
  const [waitingHead, activeHead, delayedHead, failedHead] = await Promise.all([
    readListHead(redis, `${queueRedisBase}:wait`),
    readListHead(redis, `${queueRedisBase}:active`),
    readSortedSetHead(redis, `${queueRedisBase}:delayed`),
    readSortedSetHead(redis, `${queueRedisBase}:failed`),
  ]);

  const [waitingTiming, activeTiming, failedTiming] = await Promise.all([
    readJobTiming(redis, queueRedisBase, waitingHead),
    readJobTiming(redis, queueRedisBase, activeHead),
    readJobTiming(redis, queueRedisBase, failedHead?.member || null),
  ]);

  const oldestTimestampMs = selectOldestTimestampMs([
    waitingTiming?.timestamp,
    activeTiming?.processedOn || activeTiming?.timestamp,
    delayedHead?.score,
    failedTiming?.finishedOn || failedTiming?.processedOn || failedTiming?.timestamp || failedHead?.score,
  ]);

  return toIso(oldestTimestampMs);
}

async function loadOneQueueTelemetry({ redis, queue, now }) {
  const [waiting, active, delayed, failed, oldestJobAt] = await Promise.all([
    readQueueMetric(redis, "LLEN", `${queue.redisBase}:wait`),
    readQueueMetric(redis, "LLEN", `${queue.redisBase}:active`),
    readQueueMetric(redis, "ZCARD", `${queue.redisBase}:delayed`),
    readQueueMetric(redis, "ZCARD", `${queue.redisBase}:failed`),
    readQueueOldestJobAt(redis, queue.redisBase),
  ]);

  const oldestJobAgeSeconds = oldestJobAt
    ? Math.max(0, Math.floor((new Date(now).getTime() - new Date(oldestJobAt).getTime()) / 1000))
    : 0;

  return {
    name: queue.name,
    redisBase: queue.redisBase,
    waiting,
    active,
    delayed,
    failed,
    oldestJobAt,
    oldestJobAgeSeconds,
    source: "redis_runtime",
  };
}

async function loadRuntimeQueueTelemetry({ redis = redisCommand, config = getRuntimeQueueConfig(), now = new Date() } = {}) {
  try {
    const { getBullQueueTelemetry } = require("./bullmq");
    return await getBullQueueTelemetry(config);
  } catch (_error) {
    const queues = Array.isArray(config.queues) && config.queues.length > 0
      ? config.queues
      : [{ name: config.queueName, redisBase: config.queueRedisBase }];
    return Promise.all(queues.map((queue) => loadOneQueueTelemetry({ redis, queue, now })));
  }
}

module.exports = {
  loadRuntimeQueueTelemetry,
  normalizeJobRedisKey,
  readJobTiming,
  readQueueOldestJobAt,
  readQueueMetric,
  selectOldestTimestampMs,
};
