import { and, asc, count, countDistinct, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { env } from "../config/env";
import { db } from "../database/db";
import { attendance, checkCodes, checkinLogs, checkinSessions, classrooms, enrollments, users } from "../database/schema";
import { evaluate } from "../utils/evaluate";

export interface Session {
  id: number;
  classroom_id: number;
  started_at: Date;
  ends_at: Date;
  ended_at: Date | null;
}

// now = เวลาตอนนี้ตามนาฬิกาของ database ใช้เทียบเวลาทุกอย่างเพื่อไม่ให้นาฬิกาเครื่องต่าง ๆ ไม่ตรงกัน
export interface SessionWithNow extends Session {
  now: Date;
}

export interface Code {
  id: number;
  code: string;
  starts_at: Date;
  expires_at: Date;
}

export interface ResultRow {
  id: number;
  student_code: string;
  full_name: string;
  status: "present" | "suspicious" | null;
  flag_reason: string | null;
}

// ตั้งชื่อ key เป็น snake_case ให้ตรงกับ interface
const sessionColumns = {
  id: checkinSessions.id,
  classroom_id: checkinSessions.classroomId,
  started_at: checkinSessions.startedAt,
  ends_at: checkinSessions.endsAt,
  ended_at: checkinSessions.endedAt,
};

// เวลาปัจจุบันของ database (sql ดิบต้องแปลงเป็น Date เอง)
const dbNow = sql<Date>`now()`.mapWith((value) => new Date(value));

// ถึงเวลาประเมินผลหรือยัง: หลังรหัสสุดท้ายหมดอายุ + ช่วงผ่อนผัน (ให้คนที่ส่งรหัสสุดท้ายช้าทัน)
export function isDue(session: SessionWithNow): boolean {
  return session.now.getTime() >= session.ends_at.getTime() + env.checkinGraceSeconds * 1000;
}

// คาบที่ยังไม่ได้ประเมินผล (ห้องหนึ่งมีได้คาบเดียว)
export async function findOpenByClassroom(classroomId: number): Promise<SessionWithNow | null> {
  const rows = await db
    .select({ ...sessionColumns, now: dbNow })
    .from(checkinSessions)
    .where(and(eq(checkinSessions.classroomId, classroomId), isNull(checkinSessions.endedAt)));
  return rows[0] ?? null;
}

// หาคาบที่เป็นของห้องที่อาจารย์คนนี้สอน
export async function findForTeacher(sessionId: number, teacherId: number): Promise<SessionWithNow | null> {
  const rows = await db
    .select({ ...sessionColumns, now: dbNow })
    .from(checkinSessions)
    .innerJoin(classrooms, eq(classrooms.id, checkinSessions.classroomId))
    .where(and(eq(checkinSessions.id, sessionId), eq(classrooms.teacherId, teacherId)));
  return rows[0] ?? null;
}

// สร้างคาบพร้อมรหัสทั้งหมดรอไว้เลย รหัสตัวที่ i เริ่มโชว์หลังกดเริ่ม (delay + i * ช่วงละกี่วินาที)
export async function createSession(classroomId: number, codes: string[]): Promise<Session> {
  return db.transaction(async (tx) => {
    const totalSeconds = env.checkinStartDelaySeconds + codes.length * env.checkinCodeSeconds;
    const created = await tx
      .insert(checkinSessions)
      .values({ classroomId, endsAt: sql`now() + make_interval(secs => ${totalSeconds})` })
      .returning(sessionColumns);
    const session = created[0];

    const rows = codes.map((code, i) => {
      const startsAt = new Date(session.started_at.getTime() + (env.checkinStartDelaySeconds + i * env.checkinCodeSeconds) * 1000);
      const expiresAt = new Date(startsAt.getTime() + env.checkinCodeSeconds * 1000);
      return { checkinSessionId: session.id, code, startsAt, expiresAt };
    });
    await tx.insert(checkCodes).values(rows);

    return session;
  });
}

export async function listCodes(sessionId: number): Promise<Code[]> {
  return db
    .select({ id: checkCodes.id, code: checkCodes.code, starts_at: checkCodes.startsAt, expires_at: checkCodes.expiresAt })
    .from(checkCodes)
    .where(eq(checkCodes.checkinSessionId, sessionId))
    .orderBy(asc(checkCodes.startsAt));
}

// คืน id ของรหัสในคาบนี้ ไม่มีรหัสนี้ในคาบ → null
export async function findCodeId(sessionId: number, code: string): Promise<number | null> {
  const rows = await db
    .select({ id: checkCodes.id })
    .from(checkCodes)
    .where(and(eq(checkCodes.checkinSessionId, sessionId), eq(checkCodes.code, code)));
  return rows[0]?.id ?? null;
}

// เก็บทุกครั้งที่นิสิตกรอกรหัส ยังไม่ตัดสินอะไร
export async function addLog(
  sessionId: number,
  studentId: number,
  code: string,
  codeId: number | null
) {
  await db.insert(checkinLogs).values({ checkinSessionId: sessionId, studentId, code, codeId });
}

export async function countSubmitted(sessionId: number): Promise<number> {
  const rows = await db
    .select({ n: countDistinct(checkinLogs.studentId) })
    .from(checkinLogs)
    .where(and(eq(checkinLogs.checkinSessionId, sessionId), isNotNull(checkinLogs.codeId)));
  return rows[0].n;
}

export async function countStudents(classroomId: number): Promise<number> {
  const rows = await db.select({ n: count() }).from(enrollments).where(eq(enrollments.classroomId, classroomId));
  return rows[0].n;
}

export async function hasSubmitted(sessionId: number, studentId: number): Promise<boolean> {
  const rows = await db
    .select({ id: checkinLogs.id })
    .from(checkinLogs)
    .where(
      and(eq(checkinLogs.checkinSessionId, sessionId), eq(checkinLogs.studentId, studentId), isNotNull(checkinLogs.codeId))
    )
    .limit(1);
  return rows.length === 1;
}

// จบคาบ: อ่าน log ทั้งหมดมาตัดสิน แล้วบันทึกผลลง attendance เรียกซ้ำกี่ครั้งก็ได้ผลเดียวกัน
export async function finalize(sessionId: number) {
  await db.transaction(async (tx) => {
    // ตั้ง ended_at ได้แค่คนเดียว คนที่เรียกพร้อมกันจะรอจนคนแรก commit แล้วไม่เจอแถว จึงไม่ประเมินซ้ำ
    const closed = await tx
      .update(checkinSessions)
      .set({ endedAt: sql`now()` })
      .where(and(eq(checkinSessions.id, sessionId), isNull(checkinSessions.endedAt)))
      .returning({ id: checkinSessions.id });

    if (closed.length === 0) return;

    const logs = await tx
      .select({
        id: checkinLogs.id,
        student_id: checkinLogs.studentId,
        code_id: checkinLogs.codeId,
        submitted_at: checkinLogs.submittedAt,
        starts_at: checkCodes.startsAt,
        expires_at: checkCodes.expiresAt,
      })
      .from(checkinLogs)
      .leftJoin(checkCodes, eq(checkCodes.id, checkinLogs.codeId))
      .where(eq(checkinLogs.checkinSessionId, sessionId))
      .orderBy(asc(checkinLogs.submittedAt), asc(checkinLogs.id));

    const verdicts = evaluate(logs, env.checkinGraceSeconds);
    if (verdicts.length > 0) {
      await tx.insert(attendance).values(
        verdicts.map((v) => ({
          checkinSessionId: sessionId,
          studentId: v.student_id,
          logId: v.log_id,
          status: v.status,
          flagReason: v.flag_reason,
        }))
      );
    }
  });
}

// รายชื่อนิสิตทั้งห้อง พร้อมผล (status เป็น null = ขาด)
export async function listResult(sessionId: number, classroomId: number): Promise<ResultRow[]> {
  return db
    .select({
      id: users.id,
      student_code: users.studentCode,
      full_name: users.fullName,
      status: attendance.status,
      flag_reason: attendance.flagReason,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .leftJoin(attendance, and(eq(attendance.checkinSessionId, sessionId), eq(attendance.studentId, users.id)))
    .where(eq(enrollments.classroomId, classroomId))
    .orderBy(users.studentCode);
}

export interface HistoryRow {
  session_id: number;
  started_at: Date;
  status: "present" | "suspicious" | null;
}

// ทุกคาบที่จบแล้วของห้องนี้ นับเฉพาะคาบที่เริ่มหลังนิสิตเข้าห้อง (คาบก่อนเข้าห้องไม่ถือว่าขาด) ล่าสุดก่อน
export async function listHistoryForStudent(classroomId: number, studentId: number): Promise<HistoryRow[]> {
  return db
    .select({ session_id: checkinSessions.id, started_at: checkinSessions.startedAt, status: attendance.status })
    .from(checkinSessions)
    .innerJoin(
      enrollments,
      and(eq(enrollments.classroomId, checkinSessions.classroomId), eq(enrollments.studentId, studentId))
    )
    .leftJoin(attendance, and(eq(attendance.checkinSessionId, checkinSessions.id), eq(attendance.studentId, studentId)))
    .where(
      and(
        eq(checkinSessions.classroomId, classroomId),
        isNotNull(checkinSessions.endedAt),
        gte(checkinSessions.startedAt, enrollments.joinedAt)
      )
    )
    .orderBy(desc(checkinSessions.startedAt));
}
