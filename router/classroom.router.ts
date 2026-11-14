import { Router } from "express";
import {
  createClassroom,
  generateJoinCode,
  getClassroom,
  joinClassroom,
  listClassrooms,
} from "../controller/classroom.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listClassrooms);
router.post("/", requireRole("teacher"), createClassroom);
router.post("/join", requireRole("student"), joinClassroom);
router.get("/:id", getClassroom);
router.post("/:id/join-code", requireRole("teacher"), generateJoinCode);

export default router;
