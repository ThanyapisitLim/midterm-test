import { Router } from "express";
import { finishCheckin, getCurrent, getResult } from "../controller/checkin.controller";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth, requireRole("teacher"));

router.get("/:id/current", getCurrent);
router.post("/:id/finish", finishCheckin);
router.get("/:id/result", getResult);

export default router;
