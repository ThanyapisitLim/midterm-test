import { pool } from "../database/db";

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

export async function listByTeacher(teacherId: number): Promise<TeacherClassroom[]> {
  const result = await pool.query<TeacherClassroom>(
    `select c.id, c.name, count(e.student_id)::int as student_count
     from classrooms c
     left join enrollments e on e.classroom_id = c.id
     where c.teacher_id = $1
     group by c.id
     order by c.created_at desc`,
    [teacherId]
  );
  return result.rows;
}

export async function listByStudent(studentId: number): Promise<StudentClassroom[]> {
  const result = await pool.query<StudentClassroom>(
    `select c.id, c.name, u.full_name as teacher_name
     from enrollments e
     join classrooms c on c.id = e.classroom_id
     join users u on u.id = c.teacher_id
     where e.student_id = $1
     order by e.joined_at desc`,
    [studentId]
  );
  return result.rows;
}

export async function create(teacherId: number, name: string): Promise<Classroom> {
  const result = await pool.query<Classroom>(
    "insert into classrooms (teacher_id, name) values ($1, $2) returning id, teacher_id, name, join_code",
    [teacherId, name]
  );
  return result.rows[0];
}

export async function findById(id: number): Promise<Classroom | null> {
  const result = await pool.query<Classroom>(
    "select id, teacher_id, name, join_code from classrooms where id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findByJoinCode(joinCode: string): Promise<Classroom | null> {
  const result = await pool.query<Classroom>(
    "select id, teacher_id, name, join_code from classrooms where join_code = $1",
    [joinCode]
  );
  return result.rows[0] ?? null;
}

// ตั้งโค้ดได้ครั้งเดียว: ถ้าห้องนี้มีโค้ดแล้วจะไม่ทำอะไรและคืน false
// join_code ซ้ำกับห้องอื่นจะ error code 23505 (unique)
export async function setJoinCode(id: number, joinCode: string): Promise<boolean> {
  const result = await pool.query(
    "update classrooms set join_code = $1 where id = $2 and join_code is null",
    [joinCode, id]
  );
  return result.rowCount === 1;
}

export async function addStudent(classroomId: number, studentId: number) {
  await pool.query(
    "insert into enrollments (classroom_id, student_id) values ($1, $2) on conflict do nothing",
    [classroomId, studentId]
  );
}

export async function isEnrolled(classroomId: number, studentId: number): Promise<boolean> {
  const result = await pool.query(
    "select 1 from enrollments where classroom_id = $1 and student_id = $2",
    [classroomId, studentId]
  );
  return result.rowCount === 1;
}

export async function listStudents(classroomId: number): Promise<Student[]> {
  const result = await pool.query<Student>(
    `select u.id, u.student_code, u.full_name
     from enrollments e
     join users u on u.id = e.student_id
     where e.classroom_id = $1
     order by u.student_code`,
    [classroomId]
  );
  return result.rows;
}
