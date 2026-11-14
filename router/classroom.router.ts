import { Router } from "express";
import { getMyCheckin, startCheckin, submitCode } from "../controller/checkin.controller";
import {
  createClassroom,
  generateJoinCode,
  getClassroom,
  joinClassroom,
  listClassrooms,
} from "../controller/classroom.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { deviceId } from "../middleware/device";

const router = Router();

router.use(requireAuth);

router.get("/", listClassrooms);
router.post("/", requireRole("teacher"), createClassroom);
router.post("/join", requireRole("student"), joinClassroom);
router.get("/:id", getClassroom);
router.post("/:id/join-code", requireRole("teacher"), generateJoinCode);

router.post("/:id/checkin-sessions", requireRole("teacher"), startCheckin);
router.post("/:id/checkin", requireRole("student"), deviceId, submitCode);
router.get("/:id/checkin", requireRole("student"), getMyCheckin);

export default router;
