import { randomInt } from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../config/env";
import * as Classroom from "../model/classroom.model";
import * as User from "../model/user.model";

// ตัดตัวที่อ่านสับสน (0 O 1 I) ออก
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeJoinCode(): string {
  let code = "";
  for (let i = 0; i < env.joinCodeLength; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return code;
}

// GET /api/classrooms  อาจารย์ได้ห้องที่สอน / นิสิตได้ห้องที่เข้าร่วม
export async function listClassrooms(req: Request, res: Response) {
  try {
    const user = req.user!;
    const classrooms =
      user.role === "teacher"
        ? await Classroom.listByTeacher(user.id)
        : await Classroom.listByStudent(user.id);
    res.json({ classrooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/classrooms  { name }
export async function createClassroom(req: Request, res: Response) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!name) {
      res.status(400).json({ error: "กรุณากรอกชื่อห้องเรียน" });
      return;
    }
    if (name.length > 100) {
      res.status(400).json({ error: "ชื่อห้องเรียนยาวเกิน 100 ตัวอักษร" });
      return;
    }

    const classroom = await Classroom.create(req.user!.id, name);
    res.status(201).json({ classroom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/classrooms/join  { joinCode }
export async function joinClassroom(req: Request, res: Response) {
  try {
    const joinCode = typeof req.body?.joinCode === "string" ? req.body.joinCode.trim().toUpperCase() : "";

    if (!joinCode) {
      res.status(400).json({ error: "กรุณากรอกโค้ดห้องเรียน" });
      return;
    }

    const classroom = await Classroom.findByJoinCode(joinCode);
    if (!classroom) {
      res.status(404).json({ error: "ไม่พบห้องเรียนจากโค้ดนี้" });
      return;
    }

    await Classroom.addStudent(classroom.id, req.user!.id);
    res.json({ classroom: { id: classroom.id, name: classroom.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// GET /api/classrooms/:id
// อาจารย์ (เจ้าของห้อง) ได้โค้ดเข้าห้อง + รายชื่อนิสิต / นิสิต (ที่อยู่ในห้อง) ได้ชื่อห้อง + ชื่ออาจารย์
export async function getClassroom(req: Request, res: Response) {
  try {
    const user = req.user!;
    const id = Number(req.params.id);
    const classroom = Number.isInteger(id) ? await Classroom.findById(id) : null;

    if (user.role === "teacher") {
      if (!classroom || classroom.teacher_id !== user.id) {
        res.status(404).json({ error: "ไม่พบห้องเรียน" });
        return;
      }
      const students = await Classroom.listStudents(classroom.id);
      res.json({
        classroom: { id: classroom.id, name: classroom.name, join_code: classroom.join_code },
        students,
      });
      return;
    }

    if (!classroom || !(await Classroom.isEnrolled(classroom.id, user.id))) {
      res.status(404).json({ error: "ไม่พบห้องเรียน" });
      return;
    }
    const teacher = await User.findById(classroom.teacher_id);
    res.json({ classroom: { id: classroom.id, name: classroom.name, teacher_name: teacher?.full_name ?? "" } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/classrooms/:id/join-code  สร้างโค้ดเข้าห้องใหม่ (โค้ดเดิมใช้ไม่ได้อีก)
export async function generateJoinCode(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const classroom = Number.isInteger(id) ? await Classroom.findById(id) : null;

    if (!classroom || classroom.teacher_id !== req.user!.id) {
      res.status(404).json({ error: "ไม่พบห้องเรียน" });
      return;
    }

    // สุ่มได้โค้ดซ้ำกับห้องอื่นจะชน unique แล้วลองใหม่
    for (let i = 0; i < 5; i++) {
      const code = makeJoinCode();
      try {
        await Classroom.setJoinCode(classroom.id, code);
        res.json({ join_code: code });
        return;
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err;
      }
    }
    res.status(500).json({ error: "สร้างโค้ดไม่สำเร็จ ลองใหม่อีกครั้ง" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}
