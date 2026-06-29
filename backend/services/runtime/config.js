const DEFAULT_QUEUE_NAMES = Object.freeze(["priority_commands", "background_events"]);

function normalizeQueueNames(value) {
  if (!value) return DEFAULT_QUEUE_NAMES;
  const names = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return names.length > 0 ? [...new Set(names)] : DEFAULT_QUEUE_NAMES;
}

function getRuntimeQueueConfig() {
  const prefix = process.env.BULLMQ_PREFIX || "civitas";
  const legacyQueueName = process.env.SYNC_QUEUE_NAME || process.env.BULLMQ_QUEUE_NAME || null;
  const queueNames = legacyQueueName ? normalizeQueueNames(legacyQueueName) : normalizeQueueNames(process.env.BULLMQ_QUEUE_NAMES || process.env.SYNC_QUEUE_NAMES);
  const queues = queueNames.map((name) => ({
    name,
    redisBase: process.env[`BULLMQ_${name.toUpperCase()}_REDIS_KEY`] || `${prefix}:${name}`,
  }));

  return {
    prefix,
    queueName: legacyQueueName || queueNames[0],
    queueNames,
    queues,
    queueRedisBase: process.env.SYNC_QUEUE_REDIS_KEY || `${prefix}:${legacyQueueName || queueNames[0]}`,
    heartbeatKey: process.env.SYNC_WORKER_HEARTBEAT_KEY || `${prefix}:worker:heartbeat`,
  };
}

module.exports = { DEFAULT_QUEUE_NAMES, getRuntimeQueueConfig, normalizeQueueNames };
