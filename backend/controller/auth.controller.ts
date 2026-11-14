import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as RefreshToken from "../model/refresh-token.model";
import * as User from "../model/user.model";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens";

async function startSession(res: Response, user: { id: number; role: "teacher" | "student" }) {
  const refresh = signRefreshToken(user.id);
  await RefreshToken.save(refresh.jti, user.id, refresh.expiresAt);
  setAuthCookies(res, signAccessToken(user), refresh.token);
}

// POST /api/auth/login  { studentCode, password }
export async function login(req: Request, res: Response) {
  try {
    const { studentCode, password } = req.body ?? {};

    if (typeof studentCode !== "string" || typeof password !== "string" || !studentCode.trim() || !password) {
      res.status(400).json({ error: "กรุณากรอกรหัสและรหัสผ่าน" });
      return;
    }

    const user = await User.findByCode(studentCode.trim());

    // ตอบข้อความเดียวกันทั้งสองกรณี จะได้ไม่รู้ว่ารหัสไหนมีอยู่จริง
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(401).json({ error: "รหัสหรือรหัสผ่านไม่ถูกต้อง" });
      return;
    }

    await startSession(res, user);
    res.json({
      user: { id: user.id, role: user.role, student_code: user.student_code, full_name: user.full_name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/auth/refresh  แลก refresh token เป็นคู่ใหม่ (ใช้ได้ครั้งเดียว)
export async function refresh(req: Request, res: Response) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
      return;
    }

    let claims;
    try {
      claims = verifyRefreshToken(token);
    } catch {
      clearAuthCookies(res);
      res.status(401).json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
      return;
    }

    const found = await RefreshToken.remove(claims.jti);
    if (!found) {
      clearAuthCookies(res);
      res.status(401).json({ error: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" });
      return;
    }

    const user = await User.findById(claims.userId);
    if (!user) {
      clearAuthCookies(res);
      res.status(401).json({ error: "ไม่พบบัญชีผู้ใช้" });
      return;
    }

    await startSession(res, user);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        await RefreshToken.remove(verifyRefreshToken(token).jti);
      } catch {
        // token เสียหรือหมดอายุแล้ว ไม่ต้องทำอะไร
      }
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// GET /api/auth/me
export async function me(req: Request, res: Response) {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      clearAuthCookies(res);
      res.status(401).json({ error: "ไม่พบบัญชีผู้ใช้" });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}
