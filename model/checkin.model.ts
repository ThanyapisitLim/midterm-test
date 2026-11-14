import { env } from "../config/env";
import { pool } from "../database/db";
import { evaluate, type EvalLog } from "../utils/evaluate";

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

export interface LastResult {
  session_id: number;
  started_at: Date;
  status: "present" | "suspicious" | null;
}

const SESSION_COLUMNS = "id, classroom_id, started_at, ends_at, ended_at, now() as now";

// ถึงเวลาประเมินผลหรือยัง: หลังรหัสสุดท้ายหมดอายุ + ช่วงผ่อนผัน (ให้คนที่ส่งรหัสสุดท้ายช้าทัน)
export function isDue(session: SessionWithNow): boolean {
  return session.now.getTime() >= session.ends_at.getTime() + env.checkinGraceSeconds * 1000;
}

// คาบที่ยังไม่ได้ประเมินผล (ห้องหนึ่งมีได้คาบเดียว)
export async function findOpenByClassroom(classroomId: number): Promise<SessionWithNow | null> {
  const result = await pool.query<SessionWithNow>(
    `select ${SESSION_COLUMNS} from checkin_sessions where classroom_id = $1 and ended_at is null`,
    [classroomId]
  );
  return result.rows[0] ?? null;
}

// หาคาบที่เป็นของห้องที่อาจารย์คนนี้สอน
export async function findForTeacher(sessionId: number, teacherId: number): Promise<SessionWithNow | null> {
  const result = await pool.query<SessionWithNow>(
    `select s.id, s.classroom_id, s.started_at, s.ends_at, s.ended_at, now() as now
     from checkin_sessions s
     join classrooms c on c.id = s.classroom_id
     where s.id = $1 and c.teacher_id = $2`,
    [sessionId, teacherId]
  );
  return result.rows[0] ?? null;
}

// สร้างคาบพร้อมรหัสทั้งหมดรอไว้เลย รหัสตัวที่ i เริ่มโชว์หลังกดเริ่ม (delay + i * ช่วงละกี่วินาที)
export async function createSession(classroomId: number, codes: string[]): Promise<Session> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const totalSeconds = env.checkinStartDelaySeconds + codes.length * env.checkinCodeSeconds;
    const created = await client.query<Session>(
      `insert into checkin_sessions (classroom_id, ends_at)
       values ($1, now() + make_interval(secs => $2))
       returning id, classroom_id, started_at, ends_at, ended_at`,
      [classroomId, totalSeconds]
    );
    const session = created.rows[0];

    const startsAt = codes.map(
      (_, i) => new Date(session.started_at.getTime() + (env.checkinStartDelaySeconds + i * env.checkinCodeSeconds) * 1000)
    );
    const expiresAt = startsAt.map((start) => new Date(start.getTime() + env.checkinCodeSeconds * 1000));

    // ส่งเป็น array แล้วให้ database แตกเป็นแถว (ครั้งเดียว ไม่ต้อง insert ทีละตัว)
    await client.query(
      `insert into check_codes (checkin_session_id, code, starts_at, expires_at)
       select $1, * from unnest($2::text[], $3::timestamptz[], $4::timestamptz[])`,
      [session.id, codes, startsAt, expiresAt]
    );

    await client.query("commit");
    return session;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function listCodes(sessionId: number): Promise<Code[]> {
  const result = await pool.query<Code>(
    "select id, code, starts_at, expires_at from check_codes where checkin_session_id = $1 order by starts_at",
    [sessionId]
  );
  return result.rows;
}

// คืน id ของรหัสในคาบนี้ ไม่มีรหัสนี้ในคาบ → null
export async function findCodeId(sessionId: number, code: string): Promise<number | null> {
  const result = await pool.query<{ id: number }>(
    "select id from check_codes where checkin_session_id = $1 and code = $2",
    [sessionId, code]
  );
  return result.rows[0]?.id ?? null;
}

// เก็บทุกครั้งที่นิสิตกรอกรหัส ยังไม่ตัดสินอะไร
export async function addLog(
  sessionId: number,
  studentId: number,
  code: string,
  codeId: number | null,
  deviceId: string | null
) {
  await pool.query(
    "insert into checkin_logs (checkin_session_id, student_id, code, code_id, device_id) values ($1, $2, $3, $4, $5)",
    [sessionId, studentId, code, codeId, deviceId]
  );
}

export async function countSubmitted(sessionId: number): Promise<number> {
  const result = await pool.query<{ n: number }>(
    "select count(distinct student_id)::int as n from checkin_logs where checkin_session_id = $1 and code_id is not null",
    [sessionId]
  );
  return result.rows[0].n;
}

export async function countStudents(classroomId: number): Promise<number> {
  const result = await pool.query<{ n: number }>(
    "select count(*)::int as n from enrollments where classroom_id = $1",
    [classroomId]
  );
  return result.rows[0].n;
}

export async function hasSubmitted(sessionId: number, studentId: number): Promise<boolean> {
  const result = await pool.query(
    "select 1 from checkin_logs where checkin_session_id = $1 and student_id = $2 and code_id is not null limit 1",
    [sessionId, studentId]
  );
  return result.rowCount === 1;
}

// จบคาบ: อ่าน log ทั้งหมดมาตัดสิน แล้วบันทึกผลลง attendance เรียกซ้ำกี่ครั้งก็ได้ผลเดียวกัน
export async function finalize(sessionId: number) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    // ตั้ง ended_at ได้แค่คนเดียว คนที่เรียกพร้อมกันจะรอจนคนแรก commit แล้วไม่เจอแถว จึงไม่ประเมินซ้ำ
    const closed = await client.query(
      "update checkin_sessions set ended_at = now() where id = $1 and ended_at is null",
      [sessionId]
    );

    if (closed.rowCount === 1) {
      const logs = await client.query<EvalLog>(
        `select l.id, l.student_id, l.code_id, l.device_id, l.submitted_at, c.starts_at, c.expires_at
         from checkin_logs l
         left join check_codes c on c.id = l.code_id
         where l.checkin_session_id = $1
         order by l.submitted_at, l.id`,
        [sessionId]
      );

      const verdicts = evaluate(logs.rows, env.checkinGraceSeconds);
      if (verdicts.length > 0) {
        await client.query(
          `insert into attendance (checkin_session_id, student_id, log_id, status, flag_reason)
           select $1, * from unnest($2::int[], $3::int[], $4::text[], $5::text[])`,
          [
            sessionId,
            verdicts.map((v) => v.student_id),
            verdicts.map((v) => v.log_id),
            verdicts.map((v) => v.status),
            verdicts.map((v) => v.flag_reason),
          ]
        );
      }
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// รายชื่อนิสิตทั้งห้อง พร้อมผล (status เป็น null = ขาด)
export async function listResult(sessionId: number, classroomId: number): Promise<ResultRow[]> {
  const result = await pool.query<ResultRow>(
    `select u.id, u.student_code, u.full_name, a.status, a.flag_reason
     from enrollments e
     join users u on u.id = e.student_id
     left join attendance a on a.checkin_session_id = $1 and a.student_id = u.id
     where e.classroom_id = $2
     order by u.student_code`,
    [sessionId, classroomId]
  );
  return result.rows;
}

// ผลของคาบล่าสุดที่จบแล้ว ของนิสิตคนนี้
export async function lastResult(classroomId: number, studentId: number): Promise<LastResult | null> {
  const result = await pool.query<LastResult>(
    `select s.id as session_id, s.started_at, a.status
     from checkin_sessions s
     left join attendance a on a.checkin_session_id = s.id and a.student_id = $2
     where s.classroom_id = $1 and s.ended_at is not null
     order by s.started_at desc
     limit 1`,
    [classroomId, studentId]
  );
  return result.rows[0] ?? null;
}
