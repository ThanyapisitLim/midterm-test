import { Router } from "express";
import authRouter from "./auth.router";
import checkinRouter from "./checkin.router";
import classroomRouter from "./classroom.router";

const router = Router();

router.use("/auth", authRouter);
router.use("/classrooms", classroomRouter);
router.use("/checkin-sessions", checkinRouter);

export default router;
