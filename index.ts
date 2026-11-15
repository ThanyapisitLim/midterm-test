/// <reference path="./types/express.d.ts" />
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import { env } from "./config/env";
import apiRouter from "./router";
import pagesRouter from "./router/pages.router";

const app = express();

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.resolve(process.cwd(), "views"));

// แสดงเวลาเป็นเวลาไทยเสมอ (server บน Vercel ใช้เวลา UTC) ใช้ในไฟล์ .ejs ได้เลย
function thai(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", ...options });
}
app.locals.formatDate = (date: Date) => thai(date, { dateStyle: "long" });
app.locals.formatTime = (date: Date) => thai(date, { timeStyle: "short" });

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// ไฟล์ที่เบราว์เซอร์โหลดตรง ๆ: output.css, script/, img/ (บน Vercel โฟลเดอร์ public/ ถูกเสิร์ฟโดย CDN ส่วนนี้ใช้ตอนรันในเครื่อง)
app.use(express.static(path.resolve(process.cwd(), "public")));

app.use("/api", apiRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "ไม่พบ API นี้" });
});

app.use(pagesRouter);
app.use((_req, res) => {
  res.status(404).send("ไม่พบหน้านี้");
});

// บน Vercel ไม่ต้อง listen Vercel เรียก app ที่ export ออกไปเอง
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`http://localhost:${env.port}`);
  });
}

export default app;
