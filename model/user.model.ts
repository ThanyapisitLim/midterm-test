import { eq } from "drizzle-orm";
import { db } from "../database/db";
import { users } from "../database/schema";

export interface PublicUser {
  id: number;
  role: "teacher" | "student";
  student_code: string;
  full_name: string;
}

export interface User extends PublicUser {
  password_hash: string;
}

// คอลัมน์ที่ส่งออกไปให้ที่อื่นใช้ (ตั้งชื่อ key เป็น snake_case ให้ตรงกับ interface)
const publicColumns = {
  id: users.id,
  role: users.role,
  student_code: users.studentCode,
  full_name: users.fullName,
};

export async function findByCode(studentCode: string): Promise<User | null> {
  const rows = await db
    .select({ ...publicColumns, password_hash: users.passwordHash })
    .from(users)
    .where(eq(users.studentCode, studentCode));
  return rows[0] ?? null;
}

export async function create(
  role: "teacher" | "student",
  studentCode: string,
  fullName: string,
  passwordHash: string
): Promise<PublicUser> {
  const rows = await db
    .insert(users)
    .values({ role, studentCode, fullName, passwordHash })
    .returning(publicColumns);
  return rows[0];
}

export async function findById(id: number): Promise<PublicUser | null> {
  const rows = await db.select(publicColumns).from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}
