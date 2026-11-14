import { Router } from "express";
import {
  guestPage,
  studentClassroom,
  studentHome,
  teacherClassroom,
  teacherHome,
} from "../controller/page.controller";
import { pageAuth } from "../middleware/page-auth";

const router = Router();

router.get("/", guestPage("login", "เข้าสู่ระบบ"));
router.get("/register", guestPage("register", "สมัครสมาชิก"));

router.get("/teacher", pageAuth("teacher"), teacherHome);
router.get("/teacher/classroom", pageAuth("teacher"), teacherClassroom);

router.get("/student", pageAuth("student"), studentHome);
router.get("/student/classroom", pageAuth("student"), studentClassroom);

export default router;
