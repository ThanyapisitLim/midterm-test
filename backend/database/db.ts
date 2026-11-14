import { Pool } from "pg";

// DATABASE_URL มาจาก .env.local (ได้จาก `neon deploy`) ตอนรันในเครื่อง
// ส่วนบน Vercel ให้ตั้งใน Environment Variables ของโปรเจกต์
// ใช้ตัวที่เป็น pooled (host มี -pooler) เพราะ serverless เปิด connection ใหม่บ่อย
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Run with --env-file=.env.local");
}

export const pool = new Pool({ connectionString, max: 5 });
