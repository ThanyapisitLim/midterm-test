import { Router } from "express";
import authRouter from "./auth.router";

// รวมทุก route ไว้ใต้ /api (ดู app.ts)
const router = Router();

router.use("/auth", authRouter);

export default router;
