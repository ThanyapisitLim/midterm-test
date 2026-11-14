import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import apiRouter from "./router";

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.use("/api", apiRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "ไม่พบ API นี้" });
});

// ในเครื่อง backend เสิร์ฟหน้าเว็บด้วย จะได้อยู่ origin เดียวกับ API (เรียก /api ได้เลย ไม่ต้องตั้ง CORS)
if (!process.env.VERCEL) {
  const publicDir = path.resolve(process.cwd(), "../frontend/src");
  app.use(express.static(publicDir, { extensions: ["html"] }));
}

export default app;
