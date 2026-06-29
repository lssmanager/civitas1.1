const { CANONICAL_PERMISSIONS } = require("../contracts/foundation");

const GLOBAL_ROLES = Object.freeze({
  OWNER: "owner",
  OWNER_GLOBAL: "owner_global",
  SUPPORT_AGENT: "support_agent",
});

const ORGANIZATION_ROLES = Object.freeze({
  ADMIN: "organization:admin",
  TEACHER: "organization:teacher",
  STUDENT: "organization:student",
  ADMIN_LEGACY: "Admin-org",
  STUDENT_LEGACY: "Student-org",
});

const RBAC_MATRIX = Object.freeze({
  [GLOBAL_ROLES.OWNER]: CANONICAL_PERMISSIONS,
  [GLOBAL_ROLES.OWNER_GLOBAL]: CANONICAL_PERMISSIONS,
  [GLOBAL_ROLES.SUPPORT_AGENT]: [
    "identity:read",
    "members:read",
    "connectors:read",
    "lms:read",
    "crm:read",
    "support:read",
    "scheduling:read",
    "payments:read",
    "audit:read",
  ],
  [ORGANIZATION_ROLES.ADMIN]: [
    "identity:read",
    "members:read",
    "members:invite",
    "members:remove",
    "seats:read",
    "seats:assign",
    "seats:release",
    "connectors:read",
    "connectors:configure",
    "lms:read",
    "lms:enroll",
    "crm:read",
    "support:read",
    "support:write",
    "scheduling:read",
    "scheduling:book",
    "payments:read",
    "audit:read",
  ],
  [ORGANIZATION_ROLES.ADMIN_LEGACY]: [
    "identity:read",
    "members:read",
    "members:invite",
    "members:remove",
    "seats:read",
    "seats:assign",
    "seats:release",
    "connectors:read",
    "connectors:configure",
    "lms:read",
    "lms:enroll",
    "crm:read",
    "support:read",
    "support:write",
    "scheduling:read",
    "scheduling:book",
    "payments:read",
    "audit:read",
  ],
  [ORGANIZATION_ROLES.TEACHER]: ["members:read", "seats:read", "lms:read", "support:read", "scheduling:read"],
  [ORGANIZATION_ROLES.STUDENT]: ["lms:read", "support:read", "scheduling:read"],
  [ORGANIZATION_ROLES.STUDENT_LEGACY]: ["lms:read", "support:read", "scheduling:read"],
});

const unique = (items) => [...new Set(items.filter(Boolean))];

const getPermissionsForRoles = (roles = []) =>
  unique(roles.flatMap((role) => RBAC_MATRIX[role] || []));

const hasPermission = (roles = [], permission) =>
  getPermissionsForRoles(roles).includes(permission);

const requirePermission = (permission) => (req, res, next) => {
  const roles = unique([
    ...(Array.isArray(req.user?.globalRoles) ? req.user.globalRoles : []),
    ...(Array.isArray(req.user?.organizationRoles) ? req.user.organizationRoles : []),
    ...(Array.isArray(req.user?.roles) ? req.user.roles : []),
  ]);

  if (!hasPermission(roles, permission)) {
    return res.status(403).json({
      error: "Forbidden",
      message: `Missing required Civitas permission: ${permission}`,
      requiredPermission: permission,
      roles,
    });
  }

  return next();
};

const requireOrg = (req, res, next) => {
  const organizationId = req.params?.organizationId || req.params?.id || req.user?.organizationId || req.body?.organizationId;
  if (!organizationId) {
    return res.status(403).json({
      error: "Forbidden",
      message: "organization_id is required for B2B operations.",
    });
  }
  req.organizationId = organizationId;
  return next();
};

const requireSeats = ({ getSeatAvailability } = {}) => async (req, res, next) => {
  if (!getSeatAvailability) return next();
  const availability = await getSeatAvailability(req.organizationId || req.params?.organizationId || req.params?.id);
  if (!availability || Number(availability.available || 0) <= 0) {
    return res.status(422).json({
      error: "SeatsUnavailable",
      message: "The organization has no seats available for this operation.",
      availability,
    });
  }
  return next();
};

module.exports = {
  GLOBAL_ROLES,
  ORGANIZATION_ROLES,
  RBAC_MATRIX,
  getPermissionsForRoles,
  hasPermission,
  requireOrg,
  requirePermission,
  requireSeats,
};
