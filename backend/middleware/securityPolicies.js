const crypto = require("crypto");
const express = require("express");

const DEFAULT_JSON_LIMIT = process.env.HTTP_JSON_BODY_LIMIT || "1mb";

class MemoryRateLimitStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.buckets = new Map();
  }
  async increment(key, windowMs) {
    const now = this.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }
    current.count += 1;
    return { count: current.count, resetAt: current.resetAt };
  }
  async reset(key) { this.buckets.delete(key); }
}

const createIdentityKey = (req, scope = "auto") => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown-ip";
  const subject = req.user?.sub || req.user?.id || null;
  const organizationId = req.user?.organizationId || req.params?.organizationId || req.headers["x-organization-id"] || null;
  if (scope === "ip") return `ip:${ip}`;
  if (scope === "subject") return subject ? `sub:${subject}` : `ip:${ip}`;
  if (scope === "organization") return organizationId ? `org:${organizationId}:sub:${subject || ip}` : `sub:${subject || ip}`;
  return [organizationId && `org:${organizationId}`, subject && `sub:${subject}`, `ip:${ip}`].filter(Boolean).join(":");
};

const RATE_LIMIT_PROFILES = Object.freeze({
  publicLowRisk: { windowMs: 60_000, max: 120, identityScope: "ip" },
  authenticatedRead: { windowMs: 60_000, max: 240, identityScope: "subject" },
  authenticatedWrite: { windowMs: 60_000, max: 60, identityScope: "subject" },
  ownerSensitiveWrite: { windowMs: 60_000, max: 20, identityScope: "subject" },
  organizationAdminWrite: { windowMs: 60_000, max: 40, identityScope: "organization" },
  organizationMemberRead: { windowMs: 60_000, max: 180, identityScope: "organization" },
  webhook: { windowMs: 60_000, max: 120, identityScope: "ip" },
  operationalTrigger: { windowMs: 60_000, max: 15, identityScope: "organization" },
});

const POLICY_PROFILES = Object.freeze({
  public: { rateLimit: "publicLowRisk", defaultJson: true },
  health: { rateLimit: "publicLowRisk", defaultJson: false },
  authenticatedRead: { rateLimit: "authenticatedRead", defaultJson: true },
  authenticatedWrite: { rateLimit: "authenticatedWrite", defaultJson: true },
  ownerRead: { rateLimit: "authenticatedRead", defaultJson: true },
  ownerSensitiveWrite: { rateLimit: "ownerSensitiveWrite", defaultJson: true },
  organizationMemberRead: { rateLimit: "organizationMemberRead", defaultJson: true },
  organizationAdminWrite: { rateLimit: "organizationAdminWrite", defaultJson: true },
  webhook: { rateLimit: "webhook", rawBody: true },
  operationalTrigger: { rateLimit: "operationalTrigger", defaultJson: true },
});

const securityHeaders = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

const createRateLimitMiddleware = ({ profiles = RATE_LIMIT_PROFILES, store = new MemoryRateLimitStore() } = {}) => (profileName) => {
  const profile = profiles[profileName];
  if (!profile) throw new Error(`Unknown rate limit profile: ${profileName}`);
  return async (req, res, next) => {
    try {
      const keyMaterial = `${profileName}:${createIdentityKey(req, profile.identityScope)}`;
      const key = crypto.createHash("sha256").update(keyMaterial).digest("base64url");
      const state = await store.increment(key, profile.windowMs);
      const remaining = Math.max(profile.max - state.count, 0);
      res.setHeader("RateLimit-Limit", String(profile.max));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(Math.ceil(state.resetAt / 1000)));
      if (state.count > profile.max) {
        res.setHeader("Retry-After", String(Math.ceil((state.resetAt - Date.now()) / 1000)));
        return res.status(429).json({ error: "Too Many Requests", message: "Rate limit exceeded", policy: profileName });
      }
      return next();
    } catch (error) { return next(error); }
  };
};

const createSecurityPolicyRegistry = ({ app, rateLimit = createRateLimitMiddleware(), jsonLimit = DEFAULT_JSON_LIMIT } = {}) => {
  if (!app) throw new Error("Express app is required");
  const registeredRoutes = [];
  app.disable("x-powered-by");
  app.use(securityHeaders);
  const register = (method, paths, policyName, ...handlers) => {
    const policy = POLICY_PROFILES[policyName];
    if (!policy) throw new Error(`Route ${method.toUpperCase()} ${paths} must declare a known security policy profile`);
    if (!handlers.length) throw new Error(`Route ${method.toUpperCase()} ${paths} must declare at least one handler`);
    const bodyParser = policy.rawBody ? express.raw({ type: "*/*", limit: policy.bodyLimit || jsonLimit }) : policy.defaultJson ? express.json({ limit: policy.bodyLimit || jsonLimit }) : [];
    const middleware = [bodyParser, rateLimit(policy.rateLimit)].flat().filter(Boolean);
    registeredRoutes.push({ method: method.toUpperCase(), paths: Array.isArray(paths) ? paths : [paths], policyName, rateLimitProfile: policy.rateLimit });
    return app[method](paths, ...middleware, ...handlers);
  };
  const router = {
    get: (paths, policyName, ...handlers) => register("get", paths, policyName, ...handlers),
    post: (paths, policyName, ...handlers) => register("post", paths, policyName, ...handlers),
    put: (paths, policyName, ...handlers) => register("put", paths, policyName, ...handlers),
    patch: (paths, policyName, ...handlers) => register("patch", paths, policyName, ...handlers),
    delete: (paths, policyName, ...handlers) => register("delete", paths, policyName, ...handlers),
    registeredRoutes: () => registeredRoutes.slice(),
    assertAllRegisteredRoutesHavePolicies: () => {
      const missing = registeredRoutes.filter((route) => !route.policyName || !route.rateLimitProfile);
      if (missing.length) throw new Error(`Routes without security policy: ${JSON.stringify(missing)}`);
      return true;
    },
  };
  return router;
};

module.exports = { MemoryRateLimitStore, POLICY_PROFILES, RATE_LIMIT_PROFILES, createIdentityKey, createRateLimitMiddleware, createSecurityPolicyRegistry, securityHeaders };
