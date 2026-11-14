import type { NextFunction, Request, Response } from "express";
import * as User from "../model/user.model";
import { ACCESS_COOKIE, type AuthUser, clearAuthCookies, verifyAccessToken } from "../utils/tokens";

export function homeOf(role: AuthUser["role"]): string {
  return role === "teacher" ? "/teacher" : "/student";
}

// อ่าน access token จาก cookie ไม่มีหรือหมดอายุ → null
export function readAuth(req: Request): AuthUser | null {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

// ป้องกันหน้าเว็บที่ render ที่ server (ต่างจาก requireAuth ที่ตอบ JSON ให้ API)
// - ยังไม่ login หรือ access token หมดอายุ → ไป /api/auth/refresh-redirect ให้ลองต่ออายุ ถ้าไม่ได้จะไปหน้า login
// - login แล้วแต่ผิด role → ส่งกลับหน้าของ role ตัวเอง
export function pageAuth(role: AuthUser["role"]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = readAuth(req);
      if (!auth) {
        res.redirect(`/api/auth/refresh-redirect?next=${encodeURIComponent(req.originalUrl)}`);
        return;
      }
      if (auth.role !== role) {
        res.redirect(homeOf(auth.role));
        return;
      }

      const user = await User.findById(auth.id);
      if (!user) {
        clearAuthCookies(res);
        res.redirect("/");
        return;
      }

      // ห้ามเก็บหน้าไว้ในแคช ไม่งั้นหลัง logout กดย้อนกลับจะเห็นหน้าเดิม
      res.set("Cache-Control", "no-store");
      req.user = auth;
      res.locals.user = user; // ใช้ในไฟล์ .ejs ได้เลยในชื่อ user
      next();
    } catch (err) {
      console.error(err);
      res.status(500).send("เกิดข้อผิดพลาดในระบบ");
    }
  };
}
