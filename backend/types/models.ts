export type Role = "teacher" | "student";

export interface User {
  id: number;
  role: Role;
  student_code: string;
  full_name: string;
  password_hash: string;
  created_at: Date;
}

// ข้อมูลผู้ใช้ที่ส่งออกไปหน้าเว็บได้ (ไม่มี password_hash)
export type PublicUser = Omit<User, "password_hash">;

// ข้อมูลที่อยู่ใน access token เก็บแค่ที่จำเป็น เพราะใครก็ decode อ่านได้ (แต่แก้ไม่ได้)
export interface AuthUser {
  id: number;
  role: Role;
}
