const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createSecurityPolicyRegistry, MemoryRateLimitStore, createRateLimitMiddleware } = require("../middleware/securityPolicies");
const { hashPassword, verifyPassword, PASSWORD_HASH_POLICY } = require("../security/passwordHashing");

test("route registry requires known policy metadata and records rate limit profile", () => {
  const app = express();
  const secureRoute = createSecurityPolicyRegistry({ app });
  assert.throws(() => secureRoute.get("/unsafe", "missingPolicy", (_req, res) => res.end()), /known security policy/);
  secureRoute.post("/safe", "ownerSensitiveWrite", (_req, res) => res.end());
  assert.deepEqual(secureRoute.registeredRoutes()[0], { method: "POST", paths: ["/safe"], policyName: "ownerSensitiveWrite", rateLimitProfile: "ownerSensitiveWrite" });
  assert.equal(secureRoute.assertAllRegisteredRoutesHavePolicies(), true);
});

test("sensitive endpoints in index.js are registered through policy profiles instead of raw Express routes", () => {
  const source = readFileSync(join(__dirname, "..", "index.js"), "utf8");
  assert.doesNotMatch(source, /app\.(get|post|put|patch|delete)\(/);
  assert.match(source, /secureRoute\.assertAllRegisteredRoutesHavePolicies\(\)/);
  assert.match(source, /secureRoute\.post\(\["\/owner\/organizations", "\/organizations"\], "ownerSensitiveWrite"/);
  assert.match(source, /secureRoute\.post\("\/owner\/system\/operations", "operationalTrigger"/);
  assert.match(source, /secureRoute\.post\("\/documents", "organizationAdminWrite"/);
});

test("rate limiter enforces profile limits using pluggable store", async () => {
  const store = new MemoryRateLimitStore({ now: () => 1_000 });
  const limiter = createRateLimitMiddleware({ profiles: { tiny: { windowMs: 60_000, max: 1, identityScope: "ip" } }, store })("tiny");
  const req = { ip: "127.0.0.1", socket: {}, headers: {}, params: {} };
  const makeRes = () => ({ statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  let nextCalled = 0;
  await limiter(req, makeRes(), () => { nextCalled += 1; });
  const res = makeRes();
  await limiter(req, res, () => { nextCalled += 1; });
  assert.equal(nextCalled, 1);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.policy, "tiny");
});

test("password hashing uses central scrypt policy and verifies with constant-time comparison", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  assert.match(encoded, /^scrypt\$N=\d+,r=\d+,p=\d+,l=\d+\$/);
  assert.equal(PASSWORD_HASH_POLICY.algorithm, "scrypt");
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("wrong", encoded), false);
});

test("Defender workflow declares least-privilege permissions for checkout and SARIF upload", () => {
  const workflow = readFileSync(join(__dirname, "..", "..", ".github", "workflows", "defender-for-devops.yml"), "utf8");
  assert.match(workflow, /permissions:\n\s+contents: read\n\s+security-events: write/);
});
