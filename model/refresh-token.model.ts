import { eq } from "drizzle-orm";
import { db } from "../database/db";
import { refreshTokens } from "../database/schema";

export async function save(jti: string, userId: number, expiresAt: Date) {
  await db.insert(refreshTokens).values({ jti, userId, expiresAt });
}

// คืน true ถ้ามี token นี้อยู่และลบได้ ใช้ได้ครั้งเดียว ลบแล้วใช้ซ้ำไม่ได้
export async function remove(jti: string): Promise<boolean> {
  const deleted = await db.delete(refreshTokens).where(eq(refreshTokens.jti, jti)).returning({ jti: refreshTokens.jti });
  return deleted.length === 1;
}
