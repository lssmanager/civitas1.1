let redis;
function getRedisUrl() {
  if (!process.env.REDIS_URL) { const error = new Error("REDIS_URL is required to connect to Redis"); error.code = "REDIS_URL_MISSING"; throw error; }
  return process.env.REDIS_URL;
}
function loadIORedis() { return require("ioredis"); }
function getRedisConnection() {
  if (!redis) { const IORedis = loadIORedis(); redis = new IORedis(getRedisUrl(), { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true }); }
  return redis;
}
async function redisCommand(parts) {
  const client = getRedisConnection();
  if (client.status === "wait") await client.connect();
  const [command, ...args] = parts;
  return client.call(command, ...args);
}
async function closeRedis() { if (redis) await redis.quit(); redis = null; }
module.exports = { closeRedis, getRedisConnection, getRedisUrl, redisCommand };
