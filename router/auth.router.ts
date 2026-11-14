import { Router } from "express";
import { login, logout, me, refresh, refreshRedirect, register } from "../controller/auth.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/refresh-redirect", refreshRedirect);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
