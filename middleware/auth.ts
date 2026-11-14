import type { NextFunction, Request, Response } from "express";
import { ACCESS_COOKIE, verifyAccessToken } from "../utils/tokens";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: "เซสชันหมดอายุ" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึง" });
      return;
    }
    next();
  };
}
