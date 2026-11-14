import { randomUUID } from "node:crypto";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthUser {
  id: number;
  role: "teacher" | "student";
}

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
const ACCESS_SECONDS = env.accessTokenSeconds;
const REFRESH_SECONDS = env.refreshTokenSeconds;

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, role: user.role }, env.jwtAccessSecret, { expiresIn: ACCESS_SECONDS });
}

export function verifyAccessToken(token: string): AuthUser {
  return jwt.verify(token, env.jwtAccessSecret) as AuthUser;
}

export function signRefreshToken(userId: number) {
  const jti = randomUUID();
  const token = jwt.sign({ userId, jti }, env.jwtRefreshSecret, { expiresIn: REFRESH_SECONDS });
  const expiresAt = new Date(Date.now() + REFRESH_SECONDS * 1000);
  return { token, jti, expiresAt };
}

export function verifyRefreshToken(token: string): { userId: number; jti: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { userId: number; jti: string };
}

// httpOnly: JavaScript อ่าน cookie ไม่ได้ (กัน XSS)  secure: ส่งเฉพาะ https  sameSite: กัน CSRF
const cookieBase = { httpOnly: true, secure: env.isProduction, sameSite: "lax" as const };

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase, path: "/", maxAge: ACCESS_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase, path: "/api/auth", maxAge: REFRESH_SECONDS * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: "/api/auth" });
}
