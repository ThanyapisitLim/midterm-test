import { pool } from "../database/db";

export async function save(jti: string, userId: number, expiresAt: Date) {
  await pool.query("insert into refresh_tokens (jti, user_id, expires_at) values ($1, $2, $3)", [
    jti,
    userId,
    expiresAt,
  ]);
}

// คืน true ถ้ามี token นี้อยู่และลบได้ ใช้ได้ครั้งเดียว ลบแล้วใช้ซ้ำไม่ได้
export async function remove(jti: string): Promise<boolean> {
  const result = await pool.query("delete from refresh_tokens where jti = $1", [jti]);
  return result.rowCount === 1;
}
