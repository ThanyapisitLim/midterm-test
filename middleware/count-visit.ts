import type { NextFunction, Request, Response } from "express";
import * as Visit from "../model/visit.model";

// นับผู้เข้าชมหน้า Home ต่อ ip ต่อวัน แล้วส่งตัวเลขให้ไฟล์ .ejs ใช้ในชื่อ visitors  นับพลาดก็ไม่ให้หน้าเว็บพัง
export async function countVisit(req: Request, res: Response, next: NextFunction) {
  res.locals.visitors = { today: 0, total: 0 };
  try {
    // Node ใส่ ::ffff: หน้า ip แบบ IPv4 เอาออกให้เหลือ ip ปกติ
    if (req.ip) await Visit.record(req.ip.replace("::ffff:", ""));
    res.locals.visitors = await Visit.counts();
  } catch (err) {
    console.error(err);
  }
  next();
}
