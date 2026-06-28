const {
  ACTIONS,
  FRESHNESS_SOURCES,
  buildFreshness,
  buildInvalidation,
  buildOperationalBlock,
} = require("./operational/contract");

const safeMessage = (value, fallback = null) => {
  if (!value) return fallback;
  const message = typeof value === "string" ? value : value.message || value.error || JSON.stringify(value);
  return message.length > 280 ? `${message.slice(0, 277)}...` : message;
};

const toIso = (value) => value?.toISOString?.() ?? value ?? null;
const normalizeOutput = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const secondsSince = (value, now = new Date()) => {
  const ms = value ? new Date(value).getTime() : 0;
  return ms ? Math.max(0, Math.floor((new Date(now).getTime() - ms) / 1000)) : null;
};
const isActiveOperationalStatus = (status) => ["queued", "running", "downstream_running", "processing", "active", "waiting", "delayed"].includes(String(status || ""));
const isProblemOperationalStatus = (status) => ["failed", "partial_failed", "error", "conflict", "hitl_required"].includes(String(status || ""));

let workerHealthSnapshotCacheAt = 0;
let workerHealthSnapshotCache = null;

function buildFallbackWorkerHealthSnapshot() {
  const heartbeatAt = process.env.SYNC_WORKER_HEARTBEAT_AT || null;
  const staleMs = Number(process.env.SYNC_WORKER_HEARTBEAT_STALE_MS || 120000);
  const heartbeatStale = heartbeatAt ? Date.now() - new Date(heartbeatAt).getTime() > staleMs : false;
  const queueName = process.env.SYNC_QUEUE_NAME || "sync";
  return {
    readiness: heartbeatAt ? (heartbeatStale ? "degraded" : "ready") : "degraded",
    worker: {
      heartbeatAt,
      heartbeatStale,
      workerHeartbeatState: !heartbeatAt ? "worker_offline" : heartbeatStale ? "worker_heartbeat_stale" : "alive",
      state: !heartbeatAt ? "worker_offline" : heartbeatStale ? "worker_heartbeat_stale" : "alive",
      source: "runtime_env",
    },
    redis: {
      status: process.env.REDIS_STATUS || (process.env.REDIS_URL ? "configured" : "unknown"),
      source: "runtime_env",
      urlConfigured: Boolean(process.env.REDIS_URL),
    },
    queues: [{
      name: queueName,
      waiting: Number(process.env.SYNC_QUEUE_WAITING || 0),
      active: Number(process.env.SYNC_QUEUE_ACTIVE || 0),
      delayed: Number(process.env.SYNC_QUEUE_DELAYED || 0),
      failed: Number(process.env.SYNC_QUEUE_FAILED || 0),
      oldestJobAgeSeconds: Number(process.env.SYNC_QUEUE_OLDEST_JOB_AGE_SECONDS || 0),
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

async function loadWorkerHealthSnapshot() {
  const snapshot = buildFallbackWorkerHealthSnapshot();
  workerHealthSnapshotCache = snapshot;
  workerHealthSnapshotCacheAt = Date.now();
  return snapshot;
}

function classifyWorkerHealthState(workerHealth = {}) {
  const worker = workerHealth.worker || {};
  const heartbeatState = worker.workerHeartbeatState || worker.state;
  if (heartbeatState === "worker_offline" || !worker.heartbeatAt) return "worker_offline";
  if (heartbeatState === "worker_heartbeat_stale" || worker.heartbeatStale) return "worker_heartbeat_stale";
  return "alive";
}

function classifyQueueState(queue = {}, { workerState = "alive", previousQueue = null } = {}) {
  if (Number(queue.failed || 0) > 0) return "failed_jobs_present";
  if (workerState !== "alive" && (Number(queue.waiting || 0) > 0 || Number(queue.active || 0) > 0)) return "stuck_in_queue";
  if (Number(queue.oldestJobAgeSeconds || 0) >= 900) return "stuck_in_queue";
  if (Number(queue.waiting || 0) >= 10) return "backlog_growing";
  if (previousQueue && Number(queue.waiting || 0) > Number(previousQueue.waiting || 0) && Number(queue.oldestJobAgeSeconds || 0) > 120) return "backlog_growing";
  return "alive";
}

function blockForClassification({ classification, checkedAt, source = FRESHNESS_SOURCES.WORKER_RUNTIME, details = {}, humanMessage = null, providerCode = null, providerStatus = null, operationIds = [] } = {}) {
  const critical = ["worker_offline", "stuck_in_queue"].includes(classification);
  const warning = ["worker_heartbeat_stale", "backlog_growing", "failed_jobs_present"].includes(classification);
  const status = classification === "alive" ? "healthy" : classification;
  return buildOperationalBlock({
    status,
    severity: critical ? "critical" : warning ? "warning" : "success",
    humanMessage: humanMessage || (classification === "alive" ? "Worker y colas operativas al día." : "Se detectó una señal operacional que requiere revisión owner."),
    providerCode,
    providerStatus,
    nextAction: classification === "alive" ? ACTIONS.NONE : classification === "worker_heartbeat_stale" ? ACTIONS.VERIFY_PROVIDER : ACTIONS.HUMAN_ACTION_REQUIRED,
    freshness: buildFreshness({ source, checkedAt, staleAfterSeconds: source === FRESHNESS_SOURCES.WORKER_RUNTIME ? 30 : 300 }),
    invalidation: buildInvalidation({ invalidateOnOperationIds: operationIds }),
    details,
  });
}

function buildWorkerHealthBlock(workerHealth = {}, { generatedAt = new Date() } = {}) {
  const classification = classifyWorkerHealthState(workerHealth);
  const checkedAt = workerHealth.worker?.heartbeatAt || generatedAt;
  const source = workerHealth.worker?.heartbeatAt ? FRESHNESS_SOURCES.WORKER_RUNTIME : FRESHNESS_SOURCES.LOCAL_RECONCILED;
  const block = blockForClassification({
    classification,
    checkedAt,
    source,
    humanMessage: classification === "alive" ? "Worker vivo con heartbeat fresco." : classification === "worker_offline" ? "No hay heartbeat persistido del worker; no se asume salud correcta." : "El heartbeat del worker está vencido.",
    providerCode: workerHealth.redis?.status || null,
    providerStatus: classification,
    details: { readiness: workerHealth.readiness || "unknown", heartbeatAt: workerHealth.worker?.heartbeatAt || null, redis: workerHealth.redis || null, source: workerHealth.worker?.source || null },
  });
  return { classification, readiness: workerHealth.readiness || "unknown", heartbeat: { at: workerHealth.worker?.heartbeatAt || null, state: classification }, redis: workerHealth.redis || null, ...block };
}

function buildQueuesBlocks(queues = [], { workerState = "alive", generatedAt = new Date(), previousQueues = [] } = {}) {
  return queues.map((queue) => {
    const previousQueue = previousQueues.find((item) => item.name === queue.name);
    const classification = classifyQueueState(queue, { workerState, previousQueue });
    return {
      name: queue.name,
      waiting: Number(queue.waiting || 0),
      active: Number(queue.active || 0),
      delayed: Number(queue.delayed || 0),
      failed: Number(queue.failed || 0),
      oldestJobAgeSeconds: Number(queue.oldestJobAgeSeconds || 0),
      classification,
      ...blockForClassification({ classification, checkedAt: generatedAt, providerCode: queue.name, providerStatus: classification, details: { queueName: queue.name, previousWaiting: previousQueue?.waiting ?? null } }),
    };
  });
}

function latestStepByOperation(steps = []) {
  const map = new Map();
  for (const step of steps) {
    const previous = map.get(step.operationId);
    if (!previous || new Date(step.updatedAt || 0) > new Date(previous.updatedAt || 0)) map.set(step.operationId, step);
  }
  return map;
}

function serializeActiveOperation(operation, step, profile, workerState, now = new Date()) {
  const output = normalizeOutput(step?.outputJson);
  const error = normalizeOutput(step?.lastErrorJson || operation.lastErrorJson);
  const classification = workerState !== "alive" && isActiveOperationalStatus(operation.status) ? workerState : isProblemOperationalStatus(step?.status || operation.status) ? "failed_jobs_present" : "alive";
  const operationId = operation.id;
  const block = blockForClassification({
    classification,
    checkedAt: step?.updatedAt || operation.updatedAt || now,
    providerCode: output.providerCode || error.code || null,
    providerStatus: output.providerStatus || error.status || step?.status || operation.status,
    details: { operationId, organizationId: operation.logtoOrganizationId || operation.entityId || null, retryable: Boolean(error.retryable || isProblemOperationalStatus(operation.status)) },
    operationIds: [operationId],
    source: isActiveOperationalStatus(operation.status) ? FRESHNESS_SOURCES.WORKER_RUNTIME : FRESHNESS_SOURCES.LOCAL_RECONCILED,
    humanMessage: output.humanMessage || error.message || `Operación ${operation.operationType} en estado ${operation.status}.`,
  });
  return {
    operationId,
    organizationId: operation.logtoOrganizationId || operation.entityId || null,
    organizationName: profile?.nameCache || null,
    operationType: operation.operationType,
    entityType: operation.entityType,
    stepName: step?.stepName || null,
    status: step?.status || operation.status,
    retryState: output.retryState || operation.status,
    queueName: step?.queueName || output.queueName || null,
    jobId: step?.jobId || output.jobId || null,
    jobAgeSeconds: secondsSince(step?.createdAt || operation.createdAt, now),
    workerHeartbeatState: workerState,
    ...block,
  };
}

function buildBlockedOrganizations({ profiles = [], activeOperations = [], workerState = "alive", queueClassifications = [] } = {}) {
  const activeByOrg = new Map();
  for (const op of activeOperations) {
    if (op.organizationId && !activeByOrg.has(op.organizationId)) activeByOrg.set(op.organizationId, op);
  }
  const globalQueueBlocker = queueClassifications.find((queue) => ["stuck_in_queue", "backlog_growing", "failed_jobs_present"].includes(queue.classification));
  return profiles.map((profile) => {
    const op = activeByOrg.get(profile.logtoOrganizationId);
    const missingCompany = !profile.fluentcrmCompanyId || ["not_linked", "pending", "conflict", "error"].includes(profile.fluentcrmSyncStatus);
    const contactsNotStarted = op?.stepName && /contact/i.test(op.stepName) && ["queued", "waiting", "delayed"].includes(op.status || op.retryState);
    const workerBlock = workerState !== "alive" && op;
    const queueBlock = globalQueueBlocker && op;
    const blocker = workerBlock ? workerState : queueBlock ? globalQueueBlocker.classification : missingCompany ? "missing_company" : contactsNotStarted ? "contacts_not_started" : null;
    if (!blocker) return null;
    const block = blockForClassification({
      classification: ["worker_offline", "worker_heartbeat_stale", "stuck_in_queue", "backlog_growing", "failed_jobs_present"].includes(blocker) ? blocker : "failed_jobs_present",
      checkedAt: profile.updatedAt || new Date(),
      providerCode: op?.providerCode || null,
      providerStatus: op?.providerStatus || profile.fluentcrmSyncStatus || null,
      operationIds: op ? [op.operationId] : [],
      source: op ? FRESHNESS_SOURCES.WORKER_RUNTIME : FRESHNESS_SOURCES.LOCAL_RECONCILED,
      humanMessage: blocker === "missing_company" ? "Falta crear o enlazar Company en FluentCRM según el contrato operacional." : blocker === "contacts_not_started" ? "La sincronización de contactos no inició o está pendiente." : op?.humanMessage,
    });
    return { logtoOrganizationId: profile.logtoOrganizationId, name: profile.nameCache || null, blocker, references: { operationIds: op ? [op.operationId] : [], queueName: op?.queueName || globalQueueBlocker?.name || null }, ...block };
  }).filter(Boolean);
}

function buildTimeline({ operations = [], steps = [], auditLogRows = [], profiles = [], limit = 25 } = {}) {
  const profileByOrg = new Map(profiles.map((profile) => [profile.logtoOrganizationId, profile]));
  const opById = new Map(operations.map((operation) => [operation.id, operation]));
  const stepEvents = steps.map((step) => {
    const op = opById.get(step.operationId) || {};
    const output = normalizeOutput(step.outputJson);
    const error = normalizeOutput(step.lastErrorJson);
    return {
      id: `step-${step.id}`,
      at: step.updatedAt?.toISOString?.() || step.updatedAt || step.createdAt,
      type: /provider_verification/i.test(step.stepName) ? "provider_verification" : /contact/i.test(step.stepName) ? "contacts_blocked" : /company/i.test(step.stepName) && ["failed", "error"].includes(step.status) ? "company_sync_failed" : step.status === "queued" ? "worker_taken" : "operational_step",
      organizationId: op.logtoOrganizationId || null,
      organizationName: profileByOrg.get(op.logtoOrganizationId)?.nameCache || null,
      operationId: step.operationId,
      stepName: step.stepName,
      status: step.status,
      providerCode: output.providerCode || error.code || null,
      providerStatus: output.providerStatus || error.status || step.status,
      humanMessage: output.humanMessage || error.message || `${step.stepName} ${step.status}`,
    };
  });
  const auditEvents = auditLogRows.map((log) => ({
    id: `audit-${log.id}`,
    at: log.createdAt?.toISOString?.() || log.createdAt,
    type: /retry/i.test(log.action) ? "retry_requested" : log.result === "error" ? "manual_action_required" : "audit_event",
    organizationId: log.organizationId || null,
    organizationName: profileByOrg.get(log.organizationId)?.nameCache || null,
    operationId: log.metadata?.syncOperationId || log.metadata?.operationId || null,
    stepName: log.metadata?.stepName || null,
    status: log.result,
    providerCode: log.metadata?.providerCode || null,
    providerStatus: log.metadata?.providerStatus || null,
    humanMessage: safeMessage(log.metadata?.humanMessage || log.metadata?.message || log.action, "Evento operacional registrado."),
  }));
  return [...stepEvents, ...auditEvents].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, limit);
}

function buildWorkerQueuesObservabilityAggregate({ workerHealth = {}, operations = [], steps = [], profiles = [], auditLogRows = [], generatedAt = new Date(), previousQueues = [] } = {}) {
  const workerHealthBlock = buildWorkerHealthBlock(workerHealth, { generatedAt });
  const queues = buildQueuesBlocks(workerHealth.queues || [], { workerState: workerHealthBlock.classification, generatedAt, previousQueues });
  const stepByOp = latestStepByOperation(steps);
  const profileByOrg = new Map(profiles.map((profile) => [profile.logtoOrganizationId, profile]));
  const activeOperations = operations
    .filter((operation) => isActiveOperationalStatus(operation.status) || isProblemOperationalStatus(operation.status) || isProblemOperationalStatus(stepByOp.get(operation.id)?.status))
    .map((operation) => serializeActiveOperation(operation, stepByOp.get(operation.id), profileByOrg.get(operation.logtoOrganizationId), workerHealthBlock.classification, generatedAt));
  const blockedOrganizations = buildBlockedOrganizations({ profiles, activeOperations, workerState: workerHealthBlock.classification, queueClassifications: queues });
  const timeline = buildTimeline({ operations, steps, auditLogRows, profiles });
  return {
    contractVersion: "2026-06-civitas10-worker-queues-v1",
    generatedAt: generatedAt.toISOString(),
    source: {
      backbone: "operational/contract",
      primary: "worker_runtime+clean_owner_backbone",
      dominance: "worker_runtime_over_local_reconciled_over_persisted_snapshot",
    },
    workerHealth: workerHealthBlock,
    queues,
    activeOperations,
    blockedOrganizations,
    timeline,
  };
}

async function loadWorkerQueuesObservability({ profiles = [], operations = [], steps = [], auditLogRows = [] } = {}) {
  const workerHealth = await loadWorkerHealthSnapshot();
  return buildWorkerQueuesObservabilityAggregate({ workerHealth, operations, steps, profiles, auditLogRows, generatedAt: new Date() });
}

module.exports = {
  buildWorkerQueuesObservabilityAggregate,
  buildWorkerHealthBlock,
  buildQueuesBlocks,
  classifyQueueState,
  classifyWorkerHealthState,
  getWorkerHealthSnapshot,
  loadWorkerHealthSnapshot,
  loadWorkerQueuesObservability,
};