import { pool } from "../database/db";

export async function create(jti: string, userId: number, expiresAt: Date): Promise<void> {
  await pool.query("insert into refresh_tokens (jti, user_id, expires_at) values ($1, $2, $3)", [jti, userId, expiresAt]);
}

// "ใช้" token: ตั้ง revoked_at ได้เฉพาะตอนที่ยังไม่ถูกใช้และยังไม่หมดอายุ  คืน true ถ้าสำเร็จ
// เป็นคำสั่งเดียวแบบ atomic: ถ้ามี 2 request เอา token เดียวกันมาพร้อมกัน จะได้ true แค่ตัวเดียว
export async function consume(jti: string): Promise<boolean> {
  const result = await pool.query(
    "update refresh_tokens set revoked_at = now() where jti = $1 and revoked_at is null and expires_at > now()",
    [jti]
  );
  return result.rowCount === 1;
}

// ใช้ตอนจับได้ว่ามีคนเอา refresh token ที่ใช้ไปแล้วมาใช้ซ้ำ: ยกเลิกทุกเครื่องของผู้ใช้คนนั้น
export async function revokeAllForUser(userId: number): Promise<void> {
  await pool.query("update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", [userId]);
}
