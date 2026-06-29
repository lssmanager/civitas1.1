let pool;
let db;
const schema = new Proxy({}, { get(_target, prop) { return require("../db/schema")[prop]; } });

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) { const error = new Error("DATABASE_URL is required to connect to Postgres"); error.code = "DATABASE_URL_MISSING"; throw error; }
  return process.env.DATABASE_URL;
}
function getPool() {
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: getDatabaseUrl(), max: Number(process.env.DATABASE_POOL_MAX || 10), connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || process.env.DATABASE_HEALTH_TIMEOUT_MS || 5000), idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000) });
  }
  return pool;
}
function getDb() { if (!db) { const { drizzle } = require("drizzle-orm/node-postgres"); db = drizzle(getPool(), { schema }); } return db; }
async function queryPostgres(query = "select 1", params = []) { if (typeof query === "string") return getPool().query(query, params); return getDb().execute(query); }
async function pingDatabase() { const { sql } = require("drizzle-orm"); const startedAt = Date.now(); await getDb().execute(sql`select 1`); return { ok: true, latencyMs: Date.now() - startedAt }; }
async function closeDatabase() { if (pool) await pool.end(); pool = null; db = null; }
module.exports = { closeDatabase, getDatabaseUrl, getDb, getPool, pingDatabase, queryPostgres, schema };
