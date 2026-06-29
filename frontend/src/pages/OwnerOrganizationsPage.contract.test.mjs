import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./OwnerOrganizationsPage.tsx", import.meta.url), "utf8");

test("OwnerOrganizationsPage is scoped to provisioning and not secondary navigation", () => {
  assert.match(source, /Provisioning workspace/);
  assert.match(source, /template status, organización canónica, custom data, usuarios administrativos, segmentación y submit/i);
  assert.doesNotMatch(source, /Back to home/);
  assert.doesNotMatch(source, /<Link to="\/"/);
});
