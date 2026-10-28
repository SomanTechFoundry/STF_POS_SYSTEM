import pg from "pg";
import env from "../config/env.js";

const { Pool } = pg;
const shouldUseSslFromUrl = /sslmode=require/i.test(env.DATABASE_URL || "");
const useSsl = env.DB_SSL || shouldUseSslFromUrl;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

export async function query(text, params = []) {
  return pool.query(text, params);
}
