import type { Request, Response } from "express";
import { homeOf, readAuth } from "../middleware/page-auth";
import * as Checkin from "../model/checkin.model";
import * as Classroom from "../model/classroom.model";
import * as User from "../model/user.model";

const TITLE = "เช็คชื่อเข้าเรียน";

// ?id=5 → 5 ไม่ใช่ตัวเลข → null
function queryId(req: Request): number | null {
  const id = Number(req.query.id);
  return Number.isInteger(id) ? id : null;
}

function serverError(res: Response, err: unknown) {
  console.error(err);
  res.status(500).send("เกิดข้อผิดพลาดในระบบ");
}

// หน้า login / register: ถ้า login อยู่แล้วให้ไปหน้าของตัวเองเลย
export function guestPage(view: string, title: string) {
  return (req: Request, res: Response) => {
    const auth = readAuth(req);
    if (auth) {
      res.redirect(homeOf(auth.role));
      return;
    }
    res.render(view, { title: `${title} · ${TITLE}` });
  };
}

export async function teacherHome(req: Request, res: Response) {
  try {
    const classrooms = await Classroom.listByTeacher(req.user!.id);
    res.render("teacher/home", { title: `ห้องเรียนของฉัน · ${TITLE}`, classrooms });
  } catch (err) {
    serverError(res, err);
  }
}

export async function teacherClassroom(req: Request, res: Response) {
  try {
    const id = queryId(req);
    const classroom = id === null ? null : await Classroom.findById(id);

    // ไม่มีห้อง หรือไม่ใช่ห้องที่เราสอน → กลับหน้าหลัก
    if (!classroom || classroom.teacher_id !== req.user!.id) {
      res.redirect("/teacher");
      return;
    }

    const students = await Classroom.listStudents(classroom.id);
    res.render("teacher/classroom", { title: `${classroom.name} · ${TITLE}`, classroom, students });
  } catch (err) {
    serverError(res, err);
  }
}

export async function studentHome(req: Request, res: Response) {
  try {
    const classrooms = await Classroom.listByStudent(req.user!.id);
    res.render("student/home", { title: `ห้องเรียนของฉัน · ${TITLE}`, classrooms });
  } catch (err) {
    serverError(res, err);
  }
}

export async function studentClassroom(req: Request, res: Response) {
  try {
    const studentId = req.user!.id;
    const id = queryId(req);

    if (id === null || !(await Classroom.isEnrolled(id, studentId))) {
      res.redirect("/student");
      return;
    }

    // คาบที่หมดเวลาแล้วแต่ยังไม่ถูกประเมินผล ประเมินให้ก่อน ประวัติจะได้เป็นปัจจุบัน
    const open = await Checkin.findOpenByClassroom(id);
    if (open && Checkin.isDue(open)) await Checkin.finalize(open.id);

    const classroom = await Classroom.findById(id);
    const teacher = classroom ? await User.findById(classroom.teacher_id) : null;
    if (!classroom) {
      res.redirect("/student");
      return;
    }

    // นิสิตเห็นแค่ มาเรียน / รอตรวจสอบ / ขาด ไม่เห็นเหตุผลที่ถูกทำเครื่องหมาย
    const rows = await Checkin.listHistoryForStudent(id, studentId);
    const history = rows.map((r) => ({
      session_id: r.session_id,
      started_at: r.started_at,
      status: r.status === "present" ? "present" : r.status === "suspicious" ? "pending" : "absent",
    }));
    const summary = {
      total: history.length,
      present: history.filter((h) => h.status === "present").length,
      pending: history.filter((h) => h.status === "pending").length,
    };

    res.render("student/classroom", {
      title: `${classroom.name} · ${TITLE}`,
      classroom,
      teacherName: teacher?.full_name ?? "",
      history,
      summary,
    });
  } catch (err) {
    serverError(res, err);
  }
}
