import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./OwnerWorkerQueuesPage.tsx", import.meta.url), "utf8");

test("OwnerWorkerQueuesPage loads worker and queue observability from the owner API", () => {
  assert.match(source, /ownerApi\.getWorkerQueuesObservability\(\)/);
  assert.match(source, /setData\(response\)/);
});

test("OwnerWorkerQueuesPage renders queue and blocked organization summaries", () => {
  assert.match(source, /data\?\.queues\.map/);
  assert.match(source, /data\?\.blockedOrganizations\.length/);
  assert.match(source, /Operational runtime console/);
});

test("OwnerWorkerQueuesPage stays framed as the clean civitas10 runtime view", () => {
  assert.match(source, /worker heartbeat, Redis signal, colas, backlog, failed jobs/i);
});
