function getRuntimeQueueConfig() {
  const prefix = process.env.BULLMQ_PREFIX || "civitas";
  const queueName = process.env.SYNC_QUEUE_NAME || process.env.BULLMQ_QUEUE_NAME || "default";
  return {
    prefix,
    queueName,
    queueRedisBase: process.env.SYNC_QUEUE_REDIS_KEY || `${prefix}:${queueName}`,
    heartbeatKey: process.env.SYNC_WORKER_HEARTBEAT_KEY || `${prefix}:worker:heartbeat`,
  };
}

module.exports = { getRuntimeQueueConfig };
