import type { AuthUser } from "./models";

// เพิ่ม field ให้ req ของ Express: requireAuth ใส่ไว้ แล้ว controller ดึงไปใช้ต่อ
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
