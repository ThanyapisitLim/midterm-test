import type { NextFunction, Request, Response } from "express";
import type { Role } from "../types/models";
import { HttpError } from "../utils/http-error";
import { ACCESS_COOKIE, verifyAccessToken } from "../utils/tokens";

// ใส่หน้า route ที่ต้อง login: อ่าน access token จาก cookie แล้วเก็บไว้ที่ req.user
// ตอบ 401 เมื่อไม่มี/หมดอายุ ฝั่งหน้าเว็บเห็น 401 แล้วจะเรียก /api/auth/refresh เองแล้วลองใหม่
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(new HttpError(401, "กรุณาเข้าสู่ระบบ"));

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, "เซสชันหมดอายุ"));
  }
}

// ใช้ต่อจาก requireAuth เพื่อจำกัดสิทธิ์ เช่น requireRole("teacher")
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, "ไม่มีสิทธิ์เข้าถึง"));
    }
    next();
  };
}
