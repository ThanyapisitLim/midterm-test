-- รันซ้ำได้ ไม่ลบข้อมูลเดิม: npm run db:migrate

create table if not exists users (
  id            integer generated always as identity primary key,
  role          text not null check (role in ('teacher', 'student')),
  student_code  text not null unique,
  full_name     text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- เก็บแค่ jti ของ refresh token ที่ยังใช้ได้ ลบแถวทิ้งตอน refresh/logout
create table if not exists refresh_tokens (
  jti        uuid primary key,
  user_id    integer not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_user_idx on refresh_tokens (user_id);

create table if not exists classrooms (
  id         integer generated always as identity primary key,
  teacher_id integer not null references users(id) on delete cascade,
  name       text not null,
  join_code  text unique,
  created_at timestamptz not null default now()
);

create table if not exists enrollments (
  classroom_id integer not null references classrooms(id) on delete cascade,
  student_id   integer not null references users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

-- ended_at เป็น null = ยังเปิดเช็คชื่ออยู่
create table if not exists checkin_sessions (
  id           integer generated always as identity primary key,
  classroom_id integer not null references classrooms(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create unique index if not exists one_open_session_per_classroom
  on checkin_sessions (classroom_id) where ended_at is null;

-- เก็บ QR ทุกอันที่เคยแสดง เพื่อแยก "หมดอายุ" ออกจาก "ไม่มีอยู่จริง"
create table if not exists qr_tokens (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  token              text not null unique,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);
create index if not exists qr_tokens_session_expires_idx
  on qr_tokens (checkin_session_id, expires_at desc);

create table if not exists attendance (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  student_id         integer not null references users(id) on delete cascade,
  qr_token_id        integer references qr_tokens(id) on delete set null,
  device_id          text,
  status             text not null check (status in ('present', 'suspicious', 'rejected')),
  flag_reason        text,
  checked_at         timestamptz not null default now(),
  unique (checkin_session_id, student_id)
);
create index if not exists attendance_session_device_idx
  on attendance (checkin_session_id, device_id);

-- ปรับตารางที่สร้างไว้จากเวอร์ชันแรกให้ตรงกับด้านบน
alter table users drop column if exists email;
alter table users drop constraint if exists users_check;
alter table users alter column student_code set not null;
alter table refresh_tokens drop column if exists revoked_at;
