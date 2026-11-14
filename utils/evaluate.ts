export interface EvalLog {
  id: number;
  student_id: number;
  code_id: number | null;
  device_id: string | null;
  submitted_at: Date;
  starts_at: Date | null;
  expires_at: Date | null;
}

export interface Verdict {
  student_id: number;
  log_id: number;
  status: "present" | "suspicious";
  flag_reason: string | null;
}

// ตัดสินผลทั้งคาบจาก log (logs ต้องเรียงตามเวลาที่ส่ง) คนที่ไม่มี log ที่รหัสถูกเลย ไม่อยู่ในผล = ขาด
export function evaluate(logs: EvalLog[], graceSeconds: number): Verdict[] {
  const best = new Map<number, Verdict & { device_id: string | null }>();

  for (const log of logs) {
    // รหัสที่ไม่มีอยู่จริงในคาบนี้ ไม่นับ
    if (log.code_id === null || !log.starts_at || !log.expires_at) continue;

    const submitted = log.submitted_at.getTime();
    let reason: string | null = null;
    if (submitted < log.starts_at.getTime()) {
      reason = "ส่งรหัสก่อนเวลาที่รหัสจะแสดง";
    } else if (submitted > log.expires_at.getTime() + graceSeconds * 1000) {
      const late = Math.round((submitted - log.expires_at.getTime()) / 1000);
      reason = `ส่งรหัสที่หมดอายุแล้ว ${late} วินาที`;
    }

    const status = reason ? "suspicious" : "present";
    const current = best.get(log.student_id);

    // เก็บ log แรกไว้ แต่ถ้าทีหลังมี log ที่ทันเวลา ให้ใช้อันนั้นแทน
    if (!current || (current.status === "suspicious" && status === "present")) {
      best.set(log.student_id, {
        student_id: log.student_id,
        log_id: log.id,
        status,
        flag_reason: reason,
        device_id: log.device_id,
      });
    }
  }

  // เครื่องเดียวกันเช็คชื่อให้หลายคน → ทำเครื่องหมาย (suspicious) ทุกคนที่ใช้เครื่องนั้น
  const studentsByDevice = new Map<string, number[]>();
  for (const verdict of best.values()) {
    if (!verdict.device_id) continue;
    const students = studentsByDevice.get(verdict.device_id) ?? [];
    students.push(verdict.student_id);
    studentsByDevice.set(verdict.device_id, students);
  }
  for (const students of studentsByDevice.values()) {
    if (students.length < 2) continue;
    for (const studentId of students) {
      const verdict = best.get(studentId)!;
      const reason = `ใช้เครื่องเดียวกับอีก ${students.length - 1} คน`;
      verdict.status = "suspicious";
      verdict.flag_reason = verdict.flag_reason ? `${verdict.flag_reason} / ${reason}` : reason;
    }
  }

  return [...best.values()].map(({ student_id, log_id, status, flag_reason }) => ({
    student_id,
    log_id,
    status,
    flag_reason,
  }));
}
