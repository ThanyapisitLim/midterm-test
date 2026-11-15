import { Router } from "express";
import { login, logout, refresh, refreshRedirect, register } from "../controller/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/refresh-redirect", refreshRedirect);
router.post("/logout", logout);

export default router;
