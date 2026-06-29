import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const baseSource = readFileSync(new URL("./base.ts", import.meta.url), "utf8");
const ownerSource = readFileSync(new URL("./owner.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../pages/App/index.tsx", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");

test("owner API fetch obtains a Logto access token for the configured API resource", () => {
  assert.match(baseSource, /ownerApiFetch/);
  assert.match(baseSource, /getAccessToken\(API_RESOURCE_INDICATOR\)/);
  assert.doesNotMatch(ownerSource, /fetchWithToken\("\/owner/);
  assert.match(ownerSource, /ownerApiFetch\("\/owner\/organizations"\)/);
  assert.match(ownerSource, /ownerApiFetch\("\/owner\/system\/worker-queues"\)/);
});

test("owner API errors distinguish rejected token from missing owner role", () => {
  assert.match(baseSource, /response\.status === 401\) return "Access token rejected by API"/);
  assert.match(baseSource, /response\.status === 403\) return "Owner role required"/);
});

test("Logto config asks for API audience and role claims", () => {
  assert.match(appSource, /resources: \[ReservedResource\.Organization, APP_ENV\.api\.resourceIndicator\]/);
  assert.match(appSource, /UserScope\.Roles/);
  assert.match(appSource, /UserScope\.OrganizationRoles/);
});

test("frontend env documents API resource parity with backend", () => {
  assert.match(envExample, /Must exactly match backend LOGTO_API_RESOURCE_INDICATOR/);
  assert.match(envExample, /VITE_API_RESOURCE_INDICATOR=https:\/\/api\.civitas\.example/);
});
