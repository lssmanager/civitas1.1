const existing = require("../../../services/logtoManagement");
const { resolveLogtoConfig, sanitizeLogtoConfig } = require("./config");
async function callLogtoManagementApi(path, options = {}, context = {}) {
  if (typeof existing.callLogtoManagementApi === "function") return existing.callLogtoManagementApi(path, options, context);
  throw new Error("Logto management client is not exposed in this repository yet");
}
module.exports = { ...existing, callLogtoManagementApi, resolveLogtoConfig, sanitizeLogtoConfig };
