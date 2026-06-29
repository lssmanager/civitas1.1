import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./OwnerOperationalHomePage.tsx", import.meta.url), "utf8");

test("OwnerOperationalHomePage loads organizations and runtime in parallel", () => {
  assert.match(source, /Promise\.all\(\s*\[/);
  assert.match(source, /ownerApi\.getOrganizations\(\)/);
  assert.match(source, /ownerApi\.getWorkerQueuesObservability\(\)/);
});

test("OwnerOperationalHomePage keeps primary navigation out of the page body", () => {
  assert.doesNotMatch(source, /Create organization<\/Link>|Create organization<\/button>/);
  assert.match(source, /appRoutes\.ownerWorkerQueues\.path/);
  assert.match(source, /View operational issues/);
  assert.match(source, /Open organization/);
});

test("OwnerOperationalHomePage explains its executive summary responsibility", () => {
  assert.match(source, /Resumen ejecutivo del estado global/i);
  assert.match(source, /El detalle técnico vive en Runtime y la creación vive en Create/i);
  assert.doesNotMatch(source, /waiting \{queue\.waiting\}/);
});
