import { Router } from "express";
import authRouter from "./auth.router";
import classroomRouter from "./classroom.router";

const router = Router();

router.use("/auth", authRouter);
router.use("/classrooms", classroomRouter);

export default router;
