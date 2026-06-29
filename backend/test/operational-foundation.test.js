const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeQueueNames, getRuntimeQueueConfig } = require("../services/runtime/config");
const { buildWorkerHeartbeatPayload } = require("../services/runtime/heartbeat");
const { FOUNDATION_CAPABILITIES } = require("../db/schema/foundation");

test("runtime queue config normalizes multiple BullMQ queues", () => {
  assert.deepEqual(normalizeQueueNames("priority_commands, background_events,priority_commands"), ["priority_commands", "background_events"]);
  const config = getRuntimeQueueConfig();
  assert.ok(config.prefix);
  assert.ok(Array.isArray(config.queueNames));
});

test("worker heartbeat payload identifies BullMQ queue telemetry", () => {
  const payload = buildWorkerHeartbeatPayload({ queueTelemetry: [{ name: "priority_commands", waiting: 1 }], now: new Date("2026-06-29T00:00:00.000Z") });
  assert.equal(payload.service, "civitas-worker");
  assert.equal(payload.updatedAt, "2026-06-29T00:00:00.000Z");
  assert.equal(payload.queueTelemetry[0].name, "priority_commands");
});

test("capability registry is capability-first and provider-neutral", () => {
  for (const capability of ["crm", "marketing", "lms", "community", "payments", "notifications", "support", "analytics"]) {
    assert.ok(FOUNDATION_CAPABILITIES.includes(capability));
  }
});
