import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error";

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, `ไม่พบ ${req.method} ${req.originalUrl}`));
}

// ทุก error จบที่นี่ ตอบเป็น JSON รูปแบบเดียวกันเสมอ: { error, details? }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  // body ไม่ใช่ JSON ที่ถูกต้อง (มาจาก express.json())
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
}
