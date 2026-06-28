import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./App/index.tsx", import.meta.url), "utf8");

test("App routes expose the clean owner pages", () => {
  assert.match(source, /OwnerOperationalHomePage/);
  assert.match(source, /OwnerOrganizationOperationalPage/);
  assert.match(source, /OwnerWorkerQueuesPage/);
});

test("App routes redirect authenticated users into the owner overview", () => {
  assert.match(source, /Navigate to=\{appRoutes\.owner\.path\} replace/);
  assert.match(source, /path=\{appRoutes\.ownerWorkerQueues\.path\}/);
});
