import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Run with --env-file=.env.local");
}

export const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 5) });

// Neon ตัด connection ที่ว่างนานทิ้ง ถ้าไม่ดัก error นี้ server จะ crash
pool.on("error", (err) => {
  console.error("Idle Postgres client error:", err.message);
});
