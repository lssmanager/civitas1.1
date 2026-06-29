const CAPABILITIES = Object.freeze([
  "identity",
  "authorization",
  "role_mapping",
  "crm",
  "lms",
  "community",
  "payments",
  "email",
  "notifications",
  "support",
  "scheduling",
  "storage",
  "analytics",
]);
function isSupportedCapability(capability) { return CAPABILITIES.includes(capability); }
module.exports = { CAPABILITIES, isSupportedCapability };
