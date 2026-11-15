import { Router } from "express";
import { getMyCheckin, startCheckin, submitCode } from "../controller/checkin.controller";
import { createClassroom, generateJoinCode, joinClassroom } from "../controller/classroom.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/", requireRole("teacher"), createClassroom);
router.post("/join", requireRole("student"), joinClassroom);
router.post("/:id/join-code", requireRole("teacher"), generateJoinCode);

router.post("/:id/checkin-sessions", requireRole("teacher"), startCheckin);
router.post("/:id/checkin", requireRole("student"), submitCode);
router.get("/:id/checkin", requireRole("student"), getMyCheckin);

export default router;
