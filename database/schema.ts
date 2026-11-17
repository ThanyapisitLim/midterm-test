import { sql } from "drizzle-orm";
import {
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// บอก Drizzle ว่าตารางหน้าตายังไง (ตารางจริงสร้างจาก schema.sql ในหน้า Neon เหมือนเดิม)
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  role: text("role", { enum: ["teacher", "student"] }).notNull(),
  studentCode: text("student_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  jti: uuid("jti").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamptz("expires_at").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const classrooms = pgTable("classrooms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  teacherId: integer("teacher_id").notNull(),
  name: text("name").notNull(),
  joinCode: text("join_code").unique(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    classroomId: integer("classroom_id").notNull(),
    studentId: integer("student_id").notNull(),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.classroomId, t.studentId] })],
);

export const checkinSessions = pgTable("checkin_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  classroomId: integer("classroom_id").notNull(),
  startedAt: timestamptz("started_at").notNull().defaultNow(),
  endsAt: timestamptz("ends_at").notNull(),
  endedAt: timestamptz("ended_at"),
});

export const checkCodes = pgTable("check_codes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  checkinSessionId: integer("checkin_session_id").notNull(),
  code: text("code").notNull(),
  startsAt: timestamptz("starts_at").notNull(),
  expiresAt: timestamptz("expires_at").notNull(),
});

export const checkinLogs = pgTable("checkin_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  checkinSessionId: integer("checkin_session_id").notNull(),
  studentId: integer("student_id").notNull(),
  code: text("code").notNull(),
  codeId: integer("code_id"),
  submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
});

export const attendance = pgTable("attendance", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  checkinSessionId: integer("checkin_session_id").notNull(),
  studentId: integer("student_id").notNull(),
  logId: integer("log_id"),
  status: text("status", { enum: ["present", "suspicious"] }).notNull(),
  flagReason: text("flag_reason"),
  checkedAt: timestamptz("checked_at").notNull().defaultNow(),
});

export const visits = pgTable(
  "visits",
  {
    ipAddress: text("ip_address").notNull(),
    visitDate: date("visit_date").notNull().default(sql`(now() at time zone 'Asia/Bangkok')::date`),
    firstVisitAt: timestamptz("first_visit_at").notNull().defaultNow(),
    lastVisitAt: timestamptz("last_visit_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ipAddress, t.visitDate] })]
);
