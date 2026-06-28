const { redisCommand } = require("../../lib/redis");
const { getRuntimeQueueConfig } = require("./config");
const { parseHeartbeatPayload } = require("./heartbeat");
const { loadRuntimeQueueTelemetry } = require("./queues");

const safeMessage = (value, fallback = null) => {
  if (!value) return fallback;
  const message = typeof value === "string" ? value : value.message || value.error || JSON.stringify(value);
  return message.length > 280 ? `${message.slice(0, 277)}...` : message;
};

let workerHealthSnapshotCacheAt = 0;
let workerHealthSnapshotCache = null;

async function loadRedisWorkerHealthSnapshot({ redis = redisCommand, now = new Date() } = {}) {
  const config = getRuntimeQueueConfig();
  const staleMs = Number(process.env.SYNC_WORKER_HEARTBEAT_STALE_MS || 120000);
  const [pingResponse, heartbeatRaw, queueTelemetry] = await Promise.all([
    redis(["PING"]),
    redis(["GET", config.heartbeatKey]).catch(() => null),
    loadRuntimeQueueTelemetry({ redis, config, now }),
  ]);

  const heartbeatPayload = parseHeartbeatPayload(heartbeatRaw);
  const heartbeatAt = heartbeatPayload?.updatedAt || null;
  const heartbeatStale = heartbeatAt ? new Date(now).getTime() - new Date(heartbeatAt).getTime() > staleMs : false;
  const queueName = heartbeatPayload?.queueName || config.queueName;
  const queueRedisBase = heartbeatPayload?.queueRedisBase || config.queueRedisBase;
  const queues = Array.isArray(heartbeatPayload?.queueTelemetry) && heartbeatPayload.queueTelemetry.length
    ? heartbeatPayload.queueTelemetry.map((queue) => ({
        ...queue,
        name: queue.name || queueName,
        redisBase: queue.redisBase || queue.queueRedisBase || queueRedisBase,
        source: queue.source || "redis_runtime",
      }))
    : queueTelemetry;

  return {
    readiness: heartbeatAt ? (heartbeatStale ? "degraded" : "ready") : "degraded",
    worker: {
      heartbeatAt,
      heartbeatStale,
      workerHeartbeatState: !heartbeatAt ? "worker_offline" : heartbeatStale ? "worker_heartbeat_stale" : "alive",
      state: !heartbeatAt ? "worker_offline" : heartbeatStale ? "worker_heartbeat_stale" : "alive",
      source: "redis_runtime",
      service: heartbeatPayload?.service || null,
      pid: heartbeatPayload?.pid || null,
      heartbeatKey: config.heartbeatKey,
    },
    redis: {
      status: pingResponse === "PONG" ? "healthy" : "degraded",
      source: "redis_runtime",
      urlConfigured: true,
      heartbeatKey: config.heartbeatKey,
      queueRedisBase,
    },
    queues,
  };
}

function buildFallbackWorkerHealthSnapshot() {
  const config = getRuntimeQueueConfig();
  const heartbeatAt = process.env.SYNC_WORKER_HEARTBEAT_AT || null;
  const staleMs = Number(process.env.SYNC_WORKER_HEARTBEAT_STALE_MS || 120000);
  const heartbeatStale = heartbeatAt ? Date.now() - new Date(heartbeatAt).getTime() > staleMs : false;
  return {
    readiness: heartbeatAt ? (heartbeatStale ? "degraded" : "ready") : "degraded",
    worker: {
      heartbeatAt,
      heartbeatStale,
      workerHeartbeatState: !heartbeatAt ? "worker_offline" : heartbeatStale ? "worker_heartbeat_stale" : "alive",
      state: !heartbeatAt ? "worker_offline" : heartbeatStale ? "worker_heartbeat_stale" : "alive",
      source: "runtime_env",
      heartbeatKey: config.heartbeatKey,
    },
    redis: {
      status: process.env.REDIS_STATUS || (process.env.REDIS_URL ? "configured" : "unknown"),
      source: "runtime_env",
      urlConfigured: Boolean(process.env.REDIS_URL),
      heartbeatKey: config.heartbeatKey,
      queueRedisBase: config.queueRedisBase,
    },
    queues: [{
      name: config.queueName,
      redisBase: config.queueRedisBase,
      waiting: Number(process.env.SYNC_QUEUE_WAITING || 0),
      active: Number(process.env.SYNC_QUEUE_ACTIVE || 0),
      delayed: Number(process.env.SYNC_QUEUE_DELAYED || 0),
      failed: Number(process.env.SYNC_QUEUE_FAILED || 0),
      oldestJobAt: process.env.SYNC_QUEUE_OLDEST_JOB_AT || null,
      oldestJobAgeSeconds: Number(process.env.SYNC_QUEUE_OLDEST_JOB_AGE_SECONDS || 0),
      source: "runtime_env",
    }],
  };
}

function getWorkerHealthSnapshot() {
  const cacheTtlMs = Number(process.env.SYNC_WORKER_HEALTH_CACHE_MS || 15000);
  const cacheExpired = !workerHealthSnapshotCacheAt || Date.now() - workerHealthSnapshotCacheAt > cacheTtlMs;
  if (cacheExpired || !workerHealthSnapshotCache) {
    workerHealthSnapshotCache = buildFallbackWorkerHealthSnapshot();
    workerHealthSnapshotCacheAt = Date.now();
  }
  return workerHealthSnapshotCache;
}

async function loadWorkerHealthSnapshot({ now = new Date() } = {}) {
  try {
    if (!process.env.REDIS_URL) throw new Error("REDIS_URL is not configured");
    const snapshot = await loadRedisWorkerHealthSnapshot({ now });
    workerHealthSnapshotCache = snapshot;
    workerHealthSnapshotCacheAt = Date.now();
    return snapshot;
  } catch (error) {
    const snapshot = buildFallbackWorkerHealthSnapshot();
    snapshot.redis = { ...snapshot.redis, fallbackReason: safeMessage(error, "Redis runtime unavailable") };
    workerHealthSnapshotCache = snapshot;
    workerHealthSnapshotCacheAt = Date.now();
    return snapshot;
  }
}

module.exports = {
  buildFallbackWorkerHealthSnapshot,
  getWorkerHealthSnapshot,
  loadRedisWorkerHealthSnapshot,
  loadWorkerHealthSnapshot,
};
