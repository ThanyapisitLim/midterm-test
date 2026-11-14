import { readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "./db";

// สร้าง/ปรับตารางทั้งหมดตาม schema.sql  รัน: npm run db:migrate
async function migrate() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("migrate เสร็จ");
}

migrate()
  .catch((err) => {
    console.error("migrate ไม่สำเร็จ:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
