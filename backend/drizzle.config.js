require("dotenv").config();

module.exports = {
  schema: "./db/schema/index.js",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://civitas:change-me@localhost:5432/civitas",
  },
  verbose: true,
  strict: true,
};
