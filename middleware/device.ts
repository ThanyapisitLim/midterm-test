import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const DEVICE_COOKIE = "device_id";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ให้ทุกเบราว์เซอร์มี device_id ติดตัว ไว้จับมือถือเครื่องเดียวที่เช็คชื่อให้หลายคน
export function deviceId(req: Request, res: Response, next: NextFunction) {
  let id = req.cookies?.[DEVICE_COOKIE];

  if (typeof id !== "string" || id.length === 0 || id.length > 100) {
    id = randomUUID();
    res.cookie(DEVICE_COOKIE, id, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      maxAge: ONE_YEAR_MS,
    });
  }

  req.deviceId = id;
  next();
}
