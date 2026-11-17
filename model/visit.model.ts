import { countDistinct, sql } from "drizzle-orm";
import { db } from "../database/db";
import { visits } from "../database/schema";

// ip นี้เข้าวันนี้ครั้งแรก → เพิ่มแถว (เวลาเข้าครั้งแรก = ตอนนี้)
// เข้าอีกในวันเดียวกัน (ip + วัน ชน) → ไม่เพิ่มแถว แค่อัปเดตเวลาเข้าล่าสุด
export async function record(ipAddress: string) {
  await db
    .insert(visits)
    .values({ ipAddress })
    .onConflictDoUpdate({ target: [visits.ipAddress, visits.visitDate], set: { lastVisitAt: sql`now()` } });
}

// วันนี้ (ตามเวลาไทย) มีกี่ ip / ทั้งหมดมีกี่ ip ที่เคยเข้า
export async function counts(): Promise<{ today: number; total: number }> {
  const rows = await db
    .select({
      today: sql<number>`count(*) filter (where ${visits.visitDate} = (now() at time zone 'Asia/Bangkok')::date)::int`,
      total: countDistinct(visits.ipAddress),
    })
    .from(visits);
  return rows[0];
}
