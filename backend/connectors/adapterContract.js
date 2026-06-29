const { codes, connectorError } = require("./errors");
const ADAPTER_HEALTH_STATUSES = Object.freeze({ HEALTHY: "HEALTHY", DEGRADED: "DEGRADED", UNHEALTHY: "UNHEALTHY" });
function createAdapterHealth({ status = ADAPTER_HEALTH_STATUSES.HEALTHY, latency_ms = 0, latencyMs, last_successful_ping = null, lastSuccessfulPing, error, rate_limit_remaining, pending_events, backoff_hint_ms } = {}) {
  return { status, latency_ms: latencyMs ?? latency_ms, last_successful_ping: lastSuccessfulPing ?? last_successful_ping, ...(error ? { error } : {}), ...(rate_limit_remaining !== undefined ? { rate_limit_remaining } : {}), ...(pending_events !== undefined ? { pending_events } : {}), ...(backoff_hint_ms !== undefined ? { backoff_hint_ms } : {}) };
}
function assertAdapterContract(adapter) {
  for (const key of ["capability", "provider", "actions", "healthcheck", "execute"]) {
    if (adapter[key] === undefined) throw connectorError(codes.CONFIG_INVALID, `Adapter is missing ${key}`);
  }
  if (!Array.isArray(adapter.actions) || typeof adapter.healthcheck !== "function" || typeof adapter.execute !== "function") throw connectorError(codes.CONFIG_INVALID, "Adapter contract is invalid");
  return adapter;
}
module.exports = { ADAPTER_HEALTH_STATUSES, assertAdapterContract, createAdapterHealth };
