import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as RefreshToken from "../model/refresh-token.model";
import * as User from "../model/user.model";
import { HttpError } from "../utils/http-error";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens";

// hash ปลอมไว้เทียบเวลา user ไม่มีในระบบ ให้ใช้เวลาตอบเท่ากับกรณีรหัสผ่านผิด
// ไม่งั้นวัดเวลาตอบแล้วรู้ได้ว่ารหัสนี้มีบัญชีอยู่จริงหรือไม่
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

// ออก access + refresh token ใหม่ให้ผู้ใช้ แล้วฝากไว้ใน httpOnly cookie
async function issueSession(res: Response, user: { id: number; role: "teacher" | "student" }): Promise<void> {
  const refresh = signRefreshToken(user.id);
  await RefreshToken.create(refresh.jti, user.id, refresh.expiresAt);
  setAuthCookies(res, signAccessToken(user), refresh.token);
}

// POST /api/auth/login   body: { studentCode, password }
export async function login(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const studentCode = typeof body.studentCode === "string" ? body.studentCode.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const details: Record<string, string> = {};
  if (!studentCode) details.studentCode = "กรุณากรอกรหัสนักศึกษาหรือรหัสอาจารย์";
  if (!password) details.password = "กรุณากรอกรหัสผ่าน";
  if (Object.keys(details).length > 0) throw new HttpError(400, "ข้อมูลไม่ครบ", details);
  if (studentCode.length > 50 || password.length > 200) throw new HttpError(400, "ข้อมูลยาวเกินไป");

  const user = await User.findByCode(studentCode);
  const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    // ข้อความเดียวกันทั้งสองกรณี ไม่บอกว่าผิดที่รหัสหรือรหัสผ่าน
    throw new HttpError(401, "รหัสหรือรหัสผ่านไม่ถูกต้อง");
  }

  await issueSession(res, user);
  res.json({ user: User.toPublic(user) });
}

// POST /api/auth/refresh   ไม่มี body ใช้ refresh token จาก cookie
// หมุนเวียน (rotation): token ที่ใช้แล้วใช้ซ้ำไม่ได้ ได้คู่ใหม่ทุกครั้ง
export async function refresh(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new HttpError(401, "กรุณาเข้าสู่ระบบ");

  let claims: { userId: number; jti: string };
  try {
    claims = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    throw new HttpError(401, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  // ใช้ได้ครั้งเดียว ถ้าไม่สำเร็จแปลว่า token นี้เคยถูกใช้/ถูกเพิกถอนไปแล้ว แต่ยังมีคนพยายามเอามาใช้
  // อาจเป็นเพราะ token รั่ว จึงเพิกถอนทุกเครื่องของผู้ใช้คนนี้เพื่อความปลอดภัย
  const consumed = await RefreshToken.consume(claims.jti);
  if (!consumed) {
    await RefreshToken.revokeAllForUser(claims.userId);
    clearAuthCookies(res);
    throw new HttpError(401, "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
  }

  const user = await User.findById(claims.userId);
  if (!user) {
    clearAuthCookies(res);
    throw new HttpError(401, "ไม่พบบัญชีผู้ใช้");
  }

  await issueSession(res, user);
  res.json({ user });
}

// POST /api/auth/logout   เพิกถอน refresh token จริง ๆ ที่ฝั่ง server แล้วลบ cookie
export async function logout(req: Request, res: Response) {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      await RefreshToken.consume(verifyRefreshToken(token).jti);
    } catch {
      // token เสียหรือหมดอายุอยู่แล้ว ก็ถือว่า logout สำเร็จ
    }
  }
  clearAuthCookies(res);
  res.json({ ok: true });
}

// GET /api/auth/me   (ต้อง login) หน้าเว็บเรียกเพื่อรู้ว่าใครอยู่ และ role อะไร
export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id);
  if (!user) {
    clearAuthCookies(res);
    throw new HttpError(401, "ไม่พบบัญชีผู้ใช้");
  }
  res.json({ user });
}
