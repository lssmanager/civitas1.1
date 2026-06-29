const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { requireAuth, requireOrganizationAccess } = require("./middleware/auth");
const { createSecurityPolicyRegistry } = require("./middleware/securityPolicies");
const {
  listLogtoOrganizations,
  listLogtoOrganizationRoles,
  validateOrganizationTemplate,
  getLogtoOrganizationById,
} = require("./services/logtoManagement");
const {
  normalizeProvisioningInput,
  runCanonicalOrganizationProvisioning,
  ORGANIZATION_ADMIN_ROLE_NAME,
  JIT_DEFAULT_ORGANIZATION_ROLE_NAME,
} = require("./services/organizationProvisioningCore");
const { buildConsolidatedOperationalResponse } = require("./services/operationalStateAssembler");
const { getWorkerHealthSnapshot, loadWorkerHealthSnapshot, loadWorkerQueuesObservability } = require("./services/operationalObservability");
const { getDatabaseHealth } = require("./lib/databaseHealth");
const { getRedisHealth } = require("./lib/redisHealth");
const { validateRuntimeEnv, waitForDatabase } = require("./runtime/env");
const { pingDatabase } = require("./lib/db");
const { createOperation, listOperationalState } = require("./services/operationalOperations");
const { listRegistry } = require("./services/registryStore");

const app = express();
const port = process.env.PORT || 3000;
const API_RESOURCE = process.env.LOGTO_API_RESOURCE_INDICATOR || "https://api.civitas.example";

app.use(cors());
const secureRoute = createSecurityPolicyRegistry({ app });

const requireOwner = (req, res, next) => {
  const globalRoles = Array.isArray(req.user?.globalRoles) ? req.user.globalRoles : [];
  if (!globalRoles.includes("owner_global")) {
    return res.status(403).json({ error: "Forbidden", message: "This endpoint requires the owner_global role." });
  }
  return next();
};

const summarizeStatus = (statuses) => {
  if (statuses.includes("unhealthy")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
};

const getLogtoConfigHealth = () => {
  const required = [
    "LOGTO_ENDPOINT",
    "LOGTO_ISSUER",
    "LOGTO_JWKS_URL",
    "LOGTO_API_RESOURCE_INDICATOR",
    "LOGTO_MANAGEMENT_API_TOKEN_ENDPOINT",
    "LOGTO_MANAGEMENT_API_APPLICATION_ID",
    "LOGTO_MANAGEMENT_API_APPLICATION_SECRET",
    "LOGTO_MANAGEMENT_API_RESOURCE",
  ];
  const missing = required.filter((name) => !process.env[name]);
  return { status: missing.length ? "unhealthy" : "healthy", configured: missing.length === 0, missing };
};

const getWorkerReadiness = () => {
  const configured = Boolean(process.env.SERVICE_URL_WORKER || process.env.REDIS_URL || process.env.SYNC_WORKER_HEARTBEAT_AT);
  return {
    status: configured ? "healthy" : "degraded",
    serviceUrl: process.env.SERVICE_URL_WORKER || null,
    message: configured ? "Worker runtime can publish heartbeat and queue state to the owner backbone." : "Configure worker heartbeat or Redis-related environment variables to enrich operational runtime state.",
  };
};

const buildMeResponse = (user) => {
  const globalRoles = Array.isArray(user?.globalRoles) ? user.globalRoles : [];
  const organizationRoles = Array.isArray(user?.organizationRoles) ? user.organizationRoles : [];
  return {
    auth: {
      sub: user?.sub || user?.id || null,
      organizationId: user?.organizationId || null,
      scopes: user?.scopes || [],
      roles: user?.roles || [],
      globalRoles,
      organizationRoles,
      owner: {
        canReadOwner: globalRoles.includes("owner_global"),
        canWriteOwner: globalRoles.includes("owner_global"),
      },
    },
  };
};

const getLogtoOrganizationId = (organization = {}) => organization.id || organization.organizationId || organization.logtoOrganizationId || null;
const getLogtoOrganizationName = (organization = {}) => organization.name || organization.nameCache || null;
const getLogtoOrganizationCustomData = (organization = {}) => {
  const customData = organization.customData || organization.custom_data || {};
  return customData && typeof customData === "object" && !Array.isArray(customData) ? customData : {};
};

const deriveOperationalProfile = (organization = {}) => {
  const customData = getLogtoOrganizationCustomData(organization);
  const civitasProfile = customData.civitasProfile && typeof customData.civitasProfile === "object" ? customData.civitasProfile : {};
  const business = civitasProfile.business && typeof civitasProfile.business === "object" ? civitasProfile.business : {};
  const downstream = civitasProfile.downstream && typeof civitasProfile.downstream === "object" ? civitasProfile.downstream : {};
  const crm = downstream.crm && typeof downstream.crm === "object" ? downstream.crm : {};
  const fluentcrmCompanyId = crm.companyId || crm.company_id || downstream.fluentcrmCompanyId || customData.fluentcrmCompanyId || null;
  return {
    id: getLogtoOrganizationId(organization),
    logtoOrganizationId: getLogtoOrganizationId(organization),
    nameCache: getLogtoOrganizationName(organization),
    slug: business.slug || null,
    updatedAt: civitasProfile.updatedAt || organization.updatedAt || organization.createdAt || new Date().toISOString(),
    fluentcrmCompanyId,
    fluentcrmSyncStatus: fluentcrmCompanyId ? "linked" : "not_linked",
    settings: { civitasProfile },
  };
};

const serializeOwnerOrganization = (organization) => ({
  logtoOrganizationId: getLogtoOrganizationId(organization),
  name: getLogtoOrganizationName(organization),
  logtoOrganization: organization,
  profile: deriveOperationalProfile(organization),
});

const buildOperationalOrganization = (organization, profile) => ({
  logtoOrganizationId: profile?.logtoOrganizationId || getLogtoOrganizationId(organization),
  name: profile?.nameCache || getLogtoOrganizationName(organization),
  profileId: profile?.id || null,
  sourceAnchors: {
    logtoOrganizationId: profile?.logtoOrganizationId || getLogtoOrganizationId(organization),
  },
});

secureRoute.get("/health", "health", async (_req, res) => {
  const [database, redis] = await Promise.all([getDatabaseHealth(), getRedisHealth()]);
  const logto = getLogtoConfigHealth();
  const worker = getWorkerReadiness();
  const status = summarizeStatus(["healthy", logto.status, database.status, redis.status, worker.status]);
  res.status(status === "unhealthy" ? 503 : 200).json({ status, service: "civitas10-backend", api: { status: "healthy" }, logto, database, redis, worker });
});

secureRoute.get("/me", "authenticatedRead", requireAuth(API_RESOURCE), (req, res) => {
  res.json(buildMeResponse(req.user));
});

secureRoute.get("/owner/me", "ownerRead", requireAuth(API_RESOURCE), requireOwner, (req, res) => {
  const me = buildMeResponse(req.user);
  res.json({
    owner: {
      logtoUserId: me.auth.sub,
      internalUserId: me.auth.sub,
      authorizedBy: "logto_global_role_and_scope",
      requiredScope: "owner:read",
      requiredWriteScope: "owner:write",
      canReadOwner: me.auth.owner.canReadOwner,
      canWriteOwner: me.auth.owner.canWriteOwner,
      globalRoles: me.auth.globalRoles,
      scopes: me.auth.scopes,
    },
  });
});

secureRoute.get("/owner/organization-template", "ownerRead", requireAuth(API_RESOURCE), requireOwner, async (_req, res) => {
  try {
    const roles = await listLogtoOrganizationRoles();
    const template = await validateOrganizationTemplate({ requiredRoleNames: [ORGANIZATION_ADMIN_ROLE_NAME, JIT_DEFAULT_ORGANIZATION_ROLE_NAME] });
    return res.json({
      roles: roles.map((role) => ({ id: role.id || role.organizationRoleId || role.roleId, name: role.name || role.nameCache || role.key })).filter((role) => role.id && role.name),
      requiredRoleNames: template.requiredRoleNames,
      missingRoleNames: template.missingRoleNames,
      ready: template.ok,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OwnerOrganizationTemplateError", message: error?.message || "Failed to load Logto organization template", code: error?.code || null, details: error?.body || null });
  }
});

secureRoute.get("/owner/organizations", "ownerRead", requireAuth(API_RESOURCE), requireOwner, async (_req, res) => {
  try {
    const organizations = await listLogtoOrganizations();
    return res.json({ organizations: organizations.map(serializeOwnerOrganization) });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OwnerOrganizationsListError", message: error?.message || "Failed to list organizations from Logto", code: error?.code || null, details: error?.body || null });
  }
});

secureRoute.get("/owner/organizations/:organizationId/operational-state", "ownerRead", requireAuth(API_RESOURCE), requireOwner, async (req, res) => {
  try {
    const logtoOrganization = await getLogtoOrganizationById(req.params.organizationId);
    const profile = deriveOperationalProfile(logtoOrganization);
    const workerHealth = await loadWorkerHealthSnapshot();
    const operationalState = await listOperationalState({ limit: 100 });
    const response = buildConsolidatedOperationalResponse({
      organization: buildOperationalOrganization(logtoOrganization, profile),
      logtoOrganization,
      profile,
      pending: operationalState.operations.filter((operation) => operation.logtoOrganizationId === req.params.organizationId),
      events: operationalState.auditLogRows.filter((row) => row.logtoOrganizationId === req.params.organizationId),
      workerHealth,
      generatedAt: new Date(),
      compatibility: { repository: "civitas10", mode: "clean_foundation_no_legacy_sync_tables" },
    });
    return res.json(response);
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OwnerOperationalStateError", message: error?.message || "Failed to build operational state", code: error?.code || null, details: error?.body || null });
  }
});

secureRoute.get("/owner/system/worker-queues", "ownerRead", requireAuth(API_RESOURCE), requireOwner, async (_req, res) => {
  try {
    const organizations = await listLogtoOrganizations().catch(() => []);
    const profiles = organizations.map(deriveOperationalProfile);
    const operationalState = await listOperationalState({ limit: 200 });
    const aggregate = await loadWorkerQueuesObservability({ profiles, operations: operationalState.operations, steps: operationalState.steps, auditLogRows: operationalState.auditLogRows });
    return res.json(aggregate);
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OwnerWorkerQueuesError", message: error?.message || "Failed to load worker and queues observability", code: error?.code || null, details: error?.body || null });
  }
});


secureRoute.get("/owner/system/registry", "ownerRead", requireAuth(API_RESOURCE), requireOwner, async (_req, res) => {
  try {
    return res.json({ registry: await listRegistry() });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OwnerRegistryError", message: error?.message || "Failed to load operational registry" });
  }
});

secureRoute.post("/owner/system/operations", "operationalTrigger", requireAuth(API_RESOURCE), requireOwner, async (req, res) => {
  try {
    const operation = await createOperation(req.body || {});
    return res.status(202).json({ operation });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OperationalOperationCreateError", message: error?.message || "Failed to enqueue operational operation" });
  }
});

secureRoute.post(["/owner/organizations", "/organizations"], "ownerSensitiveWrite", requireAuth(API_RESOURCE), requireOwner, async (req, res) => {
  try {
    const normalized = normalizeProvisioningInput(req.body || {});
    if (normalized.errors.length > 0) {
      return res.status(400).json({ error: "ValidationError", message: "Organization provisioning input is invalid", details: normalized.errors });
    }
    const result = await runCanonicalOrganizationProvisioning({ input: normalized.value });
    return res.status(201).json({
      status: result.status,
      data: result.organization,
      bootstrap: {
        firstAdminUserId: result.administrativeContactAssignments[0]?.logtoUserId || null,
        assignedOrganizationRole: result.administrativeContactAssignments[0]?.roleName || null,
        administrativeContactAssignments: result.administrativeContactAssignments,
        jitProvisioning: result.jitProvisioning,
      },
    });
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.name || "OrganizationProvisioningError", message: error?.message || "Failed to create organization in Logto", code: error?.code || null, details: error?.body || null });
  }
});

secureRoute.get("/documents", "organizationMemberRead", requireOrganizationAccess({ requiredScopes: ["read:documents"] }), async (_req, res) => {
  res.json([
    { id: "1", title: "Getting Started Guide", updatedAt: "2024-03-15", updatedBy: "John Doe", preview: "Welcome to Civitas clean foundation..." },
    { id: "2", title: "Operational Contract Notes", updatedAt: "2024-03-14", updatedBy: "Alice Smith", preview: "The owner backbone now prefers operational-state over legacy logs..." },
  ]);
});

secureRoute.post("/documents", "organizationAdminWrite", requireOrganizationAccess({ requiredScopes: ["create:documents"] }), async (_req, res) => {
  res.json({ data: "Document created" });
});

secureRoute.get("/", "public", (_req, res) => {
  res.json({ message: "Welcome to the Civitas 10 API" });
});

secureRoute.assertAllRegisteredRoutesHavePolicies();

if (require.main === module) {
  Promise.resolve()
    .then(() => validateRuntimeEnv({ requireRedis: true }))
    .then(() => waitForDatabase({ ping: pingDatabase }))
    .then(() => app.listen(port, () => { console.log(`Server is running on port ${port}`); }))
    .catch((error) => { console.error(`Backend startup failed: ${error.message}`); process.exit(1); });
}

module.exports = { app, secureRoute, getWorkerHealthSnapshot, deriveOperationalProfile };
