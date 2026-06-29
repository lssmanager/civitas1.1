const express = require("express");
require("dotenv").config({ path: process.env.WORKER_ENV_FILE || "./.env" });
require("dotenv").config();

const { getDatabaseHealth } = require("../lib/databaseHealth");
const { pingDatabase } = require("../lib/db");
const { getRedisHealth } = require("../lib/redisHealth");
const { validateRuntimeEnv, waitForDatabase } = require("../runtime/env");
const { getRuntimeQueueConfig } = require("../services/runtime/config");
const { writeWorkerHeartbeat } = require("../services/runtime/heartbeat");
const { loadRuntimeQueueTelemetry } = require("../services/runtime/queues");
const { createWorkers } = require("./createWorkers");
const { reconcileQueuedOperations } = require("./reconcileQueuedOperations");

const port = Number(process.env.WORKER_PORT || 3002);
const runtimeQueueConfig = getRuntimeQueueConfig();
let bullWorkers = [];
let reconcilerTimer = null;

async function publishWorkerHeartbeat() {
  const queueTelemetry = await loadRuntimeQueueTelemetry();
  return writeWorkerHeartbeat({ queueTelemetry });
}
function startReconciler() {
  if (process.env.ENABLE_QUEUE_RECONCILER === "false") return;
  const interval = Number(process.env.QUEUE_RECONCILER_INTERVAL_MS || 30000);
  reconcilerTimer = setInterval(() => reconcileQueuedOperations().catch((error) => console.error(JSON.stringify({ component: "queue-reconciler", status: "failed", error: error.message }))), interval);
  reconcilerTimer.unref();
}
async function shutdown(signal) {
  console.log(JSON.stringify({ component: "civitas-worker", status: "shutdown", signal }));
  if (reconcilerTimer) clearInterval(reconcilerTimer);
  await Promise.all(bullWorkers.map((worker) => worker.close().catch(() => null)));
  process.exit(0);
}

const app = express();
app.get("/health", async (_req, res) => {
  const [database, redis] = await Promise.all([getDatabaseHealth(), getRedisHealth()]);
  let heartbeat;
  try { heartbeat = await publishWorkerHeartbeat(); } catch (error) { heartbeat = { status: "unhealthy", message: error.message }; }
  const statuses = [database.status, redis.status, heartbeat.status];
  const status = statuses.includes("unhealthy") ? "unhealthy" : statuses.includes("degraded") ? "degraded" : "healthy";
  res.status(status === "unhealthy" ? 503 : 200).json({ status, service: "civitas-worker", database, redis, heartbeat, bullmq: { prefix: runtimeQueueConfig.prefix, queueNames: runtimeQueueConfig.queueNames, queueRedisBase: runtimeQueueConfig.queueRedisBase, workers: bullWorkers.length, concurrency: Number(process.env.WORKER_CONCURRENCY || 1), transport: "bullmq" } });
});

if (require.main === module) {
  Promise.resolve()
    .then(() => validateRuntimeEnv({ requireRedis: true }))
    .then(() => waitForDatabase({ ping: pingDatabase }))
    .then(() => { bullWorkers = createWorkers(); startReconciler(); setInterval(() => publishWorkerHeartbeat().catch((error) => console.error("Worker heartbeat failed", error.message)), 30000).unref(); return publishWorkerHeartbeat(); })
    .then(() => app.listen(port, () => console.log(`Civitas worker health service running on port ${port} with BullMQ queues ${runtimeQueueConfig.queueNames.join(",")}`)))
    .catch((error) => { console.error(`Worker startup failed: ${error.message}`); process.exit(1); });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
module.exports = { app, publishWorkerHeartbeat };
