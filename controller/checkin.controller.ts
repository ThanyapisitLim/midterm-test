import type { Request, Response } from "express";
import { env } from "../config/env";
import * as Checkin from "../model/checkin.model";
import * as Classroom from "../model/classroom.model";
import { makeCheckinCodes } from "../utils/codes";

// คาบที่เป็นของห้องที่อาจารย์คนนี้สอน ไม่ใช่ → null
async function findOwnSession(req: Request) {
  const id = Number(req.params.id);
  return Number.isInteger(id) ? Checkin.findForTeacher(id, req.user!.id) : null;
}

// POST /api/classrooms/:id/checkin-sessions  (อาจารย์) เริ่มเช็คชื่อ สร้างรหัสทั้งคาบรอไว้เลย
export async function startCheckin(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const classroom = Number.isInteger(id) ? await Classroom.findById(id) : null;

    if (!classroom || classroom.teacher_id !== req.user!.id) {
      res.status(404).json({ error: "ไม่พบห้องเรียน" });
      return;
    }

    const open = await Checkin.findOpenByClassroom(classroom.id);
    if (open) {
      if (!Checkin.isDue(open)) {
        res.json({ session: { id: open.id } }); // ยังเปิดอยู่ ให้เปิดกลับมาดูต่อ
        return;
      }
      await Checkin.finalize(open.id); // คาบเก่าหมดเวลาแล้วแต่ยังไม่ได้ประเมินผล
    }

    const count = Math.floor(env.checkinDurationSeconds / env.checkinCodeSeconds);
    const codes = makeCheckinCodes(count, env.checkinCodeLength);

    try {
      const session = await Checkin.createSession(classroom.id, codes);
      res.status(201).json({ session: { id: session.id } });
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code !== "23505") throw err;
      // กดเริ่มซ้อนกัน มีอีกคำขอสร้างคาบไปก่อนแล้ว
      const again = await Checkin.findOpenByClassroom(classroom.id);
      if (!again) throw err;
      res.json({ session: { id: again.id } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// GET /api/checkin-sessions/:id/current  (อาจารย์) ตอนนี้ควรแสดงอะไร
// phase: waiting = รอรหัสแรก / showing = แสดงรหัส / closing = รอคนส่งรหัสสุดท้าย / finished = ประเมินผลแล้ว
// ms = เวลาที่เหลือของ phase นี้ (มิลลิวินาที) ส่งรหัสเฉพาะตัวปัจจุบัน ไม่ส่งรหัสที่ยังไม่ถึงเวลา
export async function getCurrent(req: Request, res: Response) {
  try {
    const session = await findOwnSession(req);
    if (!session) {
      res.status(404).json({ error: "ไม่พบการเช็คชื่อ" });
      return;
    }

    let finished = session.ended_at !== null;
    if (!finished && Checkin.isDue(session)) {
      await Checkin.finalize(session.id);
      finished = true;
    }

    const codes = await Checkin.listCodes(session.id);
    const now = session.now.getTime();
    const info = {
      total: codes.length,
      code_seconds: env.checkinCodeSeconds,
      submitted_count: await Checkin.countSubmitted(session.id),
      student_count: await Checkin.countStudents(session.classroom_id),
    };

    if (finished) {
      res.json({ ...info, phase: "finished", ms: 0 });
      return;
    }

    const firstStart = codes[0].starts_at.getTime();
    if (now < firstStart) {
      res.json({ ...info, phase: "waiting", ms: firstStart - now });
      return;
    }

    const index = codes.findIndex((c) => c.starts_at.getTime() <= now && now < c.expires_at.getTime());
    if (index >= 0) {
      res.json({
        ...info,
        phase: "showing",
        code: codes[index].code,
        round: index + 1,
        ms: codes[index].expires_at.getTime() - now,
      });
      return;
    }

    res.json({
      ...info,
      phase: "closing",
      ms: session.ends_at.getTime() + env.checkinGraceSeconds * 1000 - now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/checkin-sessions/:id/finish  (อาจารย์) จบการเช็คชื่อแล้วประเมินผลเดี๋ยวนี้
export async function finishCheckin(req: Request, res: Response) {
  try {
    const session = await findOwnSession(req);
    if (!session) {
      res.status(404).json({ error: "ไม่พบการเช็คชื่อ" });
      return;
    }

    await Checkin.finalize(session.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// GET /api/checkin-sessions/:id/result  (อาจารย์) ผลของคาบที่จบแล้ว
export async function getResult(req: Request, res: Response) {
  try {
    const session = await findOwnSession(req);
    if (!session) {
      res.status(404).json({ error: "ไม่พบการเช็คชื่อ" });
      return;
    }

    if (session.ended_at === null) {
      if (!Checkin.isDue(session)) {
        res.status(409).json({ error: "การเช็คชื่อยังไม่จบ" });
        return;
      }
      await Checkin.finalize(session.id);
    }

    const rows = await Checkin.listResult(session.id, session.classroom_id);
    const students = rows.map((r) => ({
      id: r.id,
      student_code: r.student_code,
      full_name: r.full_name,
      status: r.status ?? "absent",
      flag_reason: r.flag_reason,
    }));

    res.json({
      session: { id: session.id, started_at: session.started_at },
      summary: {
        total: students.length,
        present: students.filter((s) => s.status === "present").length,
        suspicious: students.filter((s) => s.status === "suspicious").length,
        absent: students.filter((s) => s.status === "absent").length,
      },
      students,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// POST /api/classrooms/:id/checkin  { code }  (นิสิต) ส่งรหัสเช็คชื่อ
// ตอบแค่ว่ารับแล้ว ไม่บอกว่าทันเวลาหรือไม่ ผลจริงตัดสินตอนจบคาบ
export async function submitCode(req: Request, res: Response) {
  try {
    const classroomId = Number(req.params.id);
    const studentId = req.user!.id;

    if (!Number.isInteger(classroomId) || !(await Classroom.isEnrolled(classroomId, studentId))) {
      res.status(404).json({ error: "ไม่พบห้องเรียน" });
      return;
    }

    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!/^\d+$/.test(code) || code.length !== env.checkinCodeLength) {
      res.status(400).json({ error: `รหัสต้องเป็นตัวเลข ${env.checkinCodeLength} หลัก` });
      return;
    }

    const session = await Checkin.findOpenByClassroom(classroomId);
    if (!session || Checkin.isDue(session)) {
      res.status(409).json({ error: "ตอนนี้ไม่มีการเช็คชื่อ" });
      return;
    }

    const codeId = await Checkin.findCodeId(session.id, code);
    await Checkin.addLog(session.id, studentId, code, codeId);

    if (codeId === null) {
      res.status(400).json({ error: "รหัสไม่ถูกต้อง" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}

// GET /api/classrooms/:id/checkin  (นิสิต) ตอนนี้มีการเช็คชื่ออยู่ไหม และส่งรหัสไปแล้วหรือยัง
export async function getMyCheckin(req: Request, res: Response) {
  try {
    const classroomId = Number(req.params.id);
    const studentId = req.user!.id;

    if (!Number.isInteger(classroomId) || !(await Classroom.isEnrolled(classroomId, studentId))) {
      res.status(404).json({ error: "ไม่พบห้องเรียน" });
      return;
    }

    let session = await Checkin.findOpenByClassroom(classroomId);
    if (session && Checkin.isDue(session)) {
      await Checkin.finalize(session.id);
      session = null;
    }

    const submitted = session ? await Checkin.hasSubmitted(session.id, studentId) : false;
    res.json({ open: session !== null, submitted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
  }
}
