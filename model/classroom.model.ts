import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../database/db";
import { classrooms, enrollments, users } from "../database/schema";

export interface Classroom {
  id: number;
  teacher_id: number;
  name: string;
  join_code: string | null;
}

export interface TeacherClassroom {
  id: number;
  name: string;
  student_count: number;
}

export interface StudentClassroom {
  id: number;
  name: string;
  teacher_name: string;
}

export interface Student {
  id: number;
  student_code: string;
  full_name: string;
}

// ตั้งชื่อ key เป็น snake_case ให้ตรงกับ interface
const classroomColumns = {
  id: classrooms.id,
  teacher_id: classrooms.teacherId,
  name: classrooms.name,
  join_code: classrooms.joinCode,
};

export async function listByTeacher(teacherId: number): Promise<TeacherClassroom[]> {
  return db
    .select({ id: classrooms.id, name: classrooms.name, student_count: count(enrollments.studentId) })
    .from(classrooms)
    .leftJoin(enrollments, eq(enrollments.classroomId, classrooms.id))
    .where(eq(classrooms.teacherId, teacherId))
    .groupBy(classrooms.id)
    .orderBy(desc(classrooms.createdAt));
}

export async function listByStudent(studentId: number): Promise<StudentClassroom[]> {
  return db
    .select({ id: classrooms.id, name: classrooms.name, teacher_name: users.fullName })
    .from(enrollments)
    .innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId))
    .innerJoin(users, eq(users.id, classrooms.teacherId))
    .where(eq(enrollments.studentId, studentId))
    .orderBy(desc(enrollments.joinedAt));
}

export async function create(teacherId: number, name: string): Promise<Classroom> {
  const rows = await db.insert(classrooms).values({ teacherId, name }).returning(classroomColumns);
  return rows[0];
}

export async function findById(id: number): Promise<Classroom | null> {
  const rows = await db.select(classroomColumns).from(classrooms).where(eq(classrooms.id, id));
  return rows[0] ?? null;
}

export async function findByJoinCode(joinCode: string): Promise<Classroom | null> {
  const rows = await db.select(classroomColumns).from(classrooms).where(eq(classrooms.joinCode, joinCode));
  return rows[0] ?? null;
}

// ตั้งโค้ดได้ครั้งเดียว: ถ้าห้องนี้มีโค้ดแล้วจะไม่ทำอะไรและคืน false
// join_code ซ้ำกับห้องอื่นจะ error code 23505 (unique)
export async function setJoinCode(id: number, joinCode: string): Promise<boolean> {
  const updated = await db
    .update(classrooms)
    .set({ joinCode })
    .where(and(eq(classrooms.id, id), isNull(classrooms.joinCode)))
    .returning({ id: classrooms.id });
  return updated.length === 1;
}

export async function addStudent(classroomId: number, studentId: number) {
  await db.insert(enrollments).values({ classroomId, studentId }).onConflictDoNothing();
}

export async function isEnrolled(classroomId: number, studentId: number): Promise<boolean> {
  const rows = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classroomId, classroomId), eq(enrollments.studentId, studentId)));
  return rows.length === 1;
}

export async function listStudents(classroomId: number): Promise<Student[]> {
  return db
    .select({ id: users.id, student_code: users.studentCode, full_name: users.fullName })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .where(eq(enrollments.classroomId, classroomId))
    .orderBy(users.studentCode);
}
