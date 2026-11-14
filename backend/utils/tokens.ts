import { randomUUID } from "node:crypto";
import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser, Role } from "../types/models";

// access token  = บัตรผ่านอายุสั้น (15 นาที) แนบมากับทุก request ถ้าหลุดก็ใช้ได้ไม่นาน
// refresh token = บัตรแลกบัตรผ่านใหม่ อายุยาว (7 วัน) ใช้ได้ครั้งเดียว (rotation) และเพิกถอนได้ผ่านตาราง refresh_tokens
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.jwtAccessSecret, {
    algorithm: "HS256",
    subject: String(user.id),
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

// โยน error ถ้า token ปลอม ถูกแก้ หรือหมดอายุ
export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.jwtAccessSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  const id = Number(payload.sub);
  if (!Number.isInteger(id) || (payload.role !== "teacher" && payload.role !== "student")) {
    throw new Error("Malformed access token");
  }
  return { id, role: payload.role as Role };
}

// jti = id สุ่มของ refresh token นี้ เก็บลง DB แทนตัว token
export function signRefreshToken(userId: number): { token: string; jti: string; expiresAt: Date } {
  const jti = randomUUID();
  const token = jwt.sign({}, env.jwtRefreshSecret, {
    algorithm: "HS256",
    subject: String(userId),
    jwtid: jti,
    expiresIn: REFRESH_TTL_SECONDS,
  });
  return { token, jti, expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) };
}

export function verifyRefreshToken(token: string): { userId: number; jti: string } {
  const payload = jwt.verify(token, env.jwtRefreshSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || !payload.jti) throw new Error("Malformed refresh token");
  return { userId, jti: payload.jti };
}

// httpOnly = JavaScript ฝั่งหน้าเว็บอ่าน cookie นี้ไม่ได้ ทำให้ XSS ขโมย token ไม่ได้
// secure   = ส่งเฉพาะ https (เปิดตอน production เพราะ localhost เป็น http)
// sameSite = lax กันเว็บอื่นยิง POST มาพร้อม cookie ของเรา (CSRF)
const baseOptions = { httpOnly: true, secure: env.isProduction, sameSite: "lax" } as const;

// refresh cookie ถูกส่งเฉพาะ /api/auth/* ไม่ติดไปกับ request อื่น ลดโอกาสหลุด
const accessOptions: CookieOptions = { ...baseOptions, path: "/" };
const refreshOptions: CookieOptions = { ...baseOptions, path: "/api/auth" };

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshOptions, maxAge: REFRESH_TTL_SECONDS * 1000 });
}

// clearCookie ต้องใช้ path เดียวกับตอนตั้ง ไม่งั้นเบราว์เซอร์ไม่ลบ
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, accessOptions);
  res.clearCookie(REFRESH_COOKIE, refreshOptions);
}
