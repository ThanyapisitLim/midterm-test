import { pool } from "../database/db";

export interface PublicUser {
  id: number;
  role: "teacher" | "student";
  student_code: string;
  full_name: string;
}

export interface User extends PublicUser {
  password_hash: string;
}

// ใช้ $1 แทนการต่อ string เพื่อกัน SQL injection
export async function findByCode(studentCode: string): Promise<User | null> {
  const result = await pool.query<User>("select * from users where student_code = $1", [studentCode]);
  return result.rows[0] ?? null;
}

export async function findById(id: number): Promise<PublicUser | null> {
  const result = await pool.query<PublicUser>(
    "select id, role, student_code, full_name from users where id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}
