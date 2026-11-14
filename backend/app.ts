import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler, notFound } from "./middleware/error";
import apiRouter from "./router";

const app = express();

// อยู่หลัง proxy ของ Vercel: ให้ req.ip และ req.secure อ่านค่าจริงจาก header
app.set("trust proxy", 1);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use("/api", apiRouter);
app.use("/api", notFound); // /api/อะไรก็ตามที่ไม่มี → 404 เป็น JSON

// รันในเครื่อง: backend เสิร์ฟหน้าเว็บจาก frontend/src ด้วย หน้าเว็บกับ API จึงอยู่ที่ localhost:3000 เหมือนกัน
// (cookie ผูกกับโดเมน+พอร์ต ถ้าแยกพอร์ตกัน cookie login จะไม่ติดไปกับ /api)
// บน Vercel ไม่ใช้ส่วนนี้ เพราะ frontend deploy แยก แล้วส่ง /api ต่อมาที่นี่ ดู frontend/vercel.json
if (!process.env.VERCEL) {
  const publicDir = path.resolve(process.cwd(), "../frontend/src");
  app.use(express.static(publicDir, { extensions: ["html"] }));
}

app.use(notFound);
app.use(errorHandler);

export default app;
