const { pingDatabase } = require("./db");

async function getDatabaseHealth() {
  if (!process.env.DATABASE_URL) return { status: "unhealthy", configured: false, driver: "drizzle", message: "DATABASE_URL is not configured" };
  try {
    const result = await pingDatabase();
    return { status: "healthy", configured: true, driver: "drizzle", latencyMs: result.latencyMs };
  } catch (error) {
    return { status: "unhealthy", configured: true, driver: "drizzle", message: error.message };
  }
}
module.exports = { getDatabaseHealth };
