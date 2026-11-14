import { pool } from "../database/db";
import type { PublicUser, User } from "../types/models";

// model = ที่เดียวที่เขียน SQL  ใช้ $1, $2 แทนการต่อ string เสมอ ป้องกัน SQL injection

const PUBLIC_COLUMNS = "id, role, student_code, full_name, created_at";

// ตอน login ต้องใช้ password_hash ด้วย จึงดึงทุกคอลัมน์
export async function findByCode(studentCode: string): Promise<User | null> {
  const result = await pool.query<User>("select * from users where student_code = $1", [studentCode]);
  return result.rows[0] ?? null;
}

export async function findById(id: number): Promise<PublicUser | null> {
  const result = await pool.query<PublicUser>(`select ${PUBLIC_COLUMNS} from users where id = $1`, [id]);
  return result.rows[0] ?? null;
}

export function toPublic(user: User): PublicUser {
  const { password_hash: _omit, ...publicUser } = user;
  return publicUser;
}
