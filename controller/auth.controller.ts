import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
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

// POST /api/auth/register  { role, fullName, studentCode, password, confirmPassword }
export async function register(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const role = body.role;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const studentCode = typeof body.studentCode === "string" ? body.studentCode.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    // กติกาต้องตรงกับ frontend/src/script/register.js
    const details: Record<string, string> = {};

    if (role !== "student" && role !== "teacher") details.role = "กรุณาเลือกประเภทผู้ใช้";

    if (!fullName) details.fullName = "กรุณากรอกชื่อ-นามสกุล";
    else if (fullName.length > 100) details.fullName = "ชื่อยาวเกิน 100 ตัวอักษร";

    if (role === "teacher") {
      if (!/^[A-Za-z0-9]{3,20}$/.test(studentCode)) details.studentCode = "รหัสอาจารย์ใช้ตัวอักษรหรือตัวเลข 3-20 ตัว";
    } else if (!/^\d{8,12}$/.test(studentCode)) {
      details.studentCode = "รหัสนักศึกษาต้องเป็นตัวเลข 8-12 หลัก";
    }

    if (password.length < 8) details.password = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว";
    else if (password.length > 72) details.password = "รหัสผ่านยาวเกินไป (ไม่เกิน 72 ตัว)";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) details.password = "ต้องมีทั้งตัวอักษรและตัวเลข";

    if (confirmPassword !== password) details.confirmPassword = "รหัสผ่านไม่ตรงกัน";

    if (Object.keys(details).length > 0) {
      res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", details });
      return;
    }

    if (await User.findByCode(studentCode)) {
      res.status(409).json({ error: "รหัสนี้ถูกใช้แล้ว", details: { studentCode: "รหัสนี้ถูกใช้แล้ว" } });
      return;
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const user = await User.create(role, studentCode, fullName, passwordHash);

    await startSession(res, user);
    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
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

// GET /api/auth/refresh-redirect?next=/teacher  ต่ออายุ session แล้ว redirect กลับหน้าเดิม
// ใช้กับหน้าที่ render ที่ server: refresh cookie ถูกส่งเฉพาะ /api/auth จึงต้องผ่านทางนี้
export async function refreshRedirect(req: Request, res: Response) {
  // รับเฉพาะ path ในเว็บเรา กันถูกส่งไปเว็บอื่น (open redirect)
  const next = typeof req.query.next === "string" && /^\/(?![/\\])/.test(req.query.next) ? req.query.next : "/";

  const fail = () => {
    clearAuthCookies(res);
    res.redirect(`/?next=${encodeURIComponent(next)}`);
  };

  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return fail();

    let claims;
    try {
      claims = verifyRefreshToken(token);
    } catch {
      return fail();
    }

    if (!(await RefreshToken.remove(claims.jti))) return fail();

    const user = await User.findById(claims.userId);
    if (!user) return fail();

    await startSession(res, user);
    res.redirect(next);
  } catch (err) {
    console.error(err);
    res.status(500).send("เกิดข้อผิดพลาดในระบบ");
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
