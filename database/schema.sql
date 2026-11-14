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

-- เริ่มเช็คชื่อ 1 ครั้ง (1 คาบ) ends_at = เวลาที่รหัสสุดท้ายหมด  ended_at เป็น null = ยังไม่ได้ประเมินผล
create table if not exists checkin_sessions (
  id           integer generated always as identity primary key,
  classroom_id integer not null references classrooms(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ends_at      timestamptz not null,
  ended_at     timestamptz
);
create unique index if not exists one_open_session_per_classroom
  on checkin_sessions (classroom_id) where ended_at is null;

-- รหัส 6 หลักที่สร้างรอไว้ทั้งคาบ แต่ละตัวมีช่วงเวลาที่ถูกโชว์ (starts_at ถึง expires_at)
-- รหัสซ้ำกันได้ถ้าอยู่คนละคาบ
create table if not exists check_codes (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  code               text not null,
  starts_at          timestamptz not null,
  expires_at         timestamptz not null,
  unique (checkin_session_id, code)
);
create index if not exists check_codes_session_starts_idx
  on check_codes (checkin_session_id, starts_at);

-- ทุกครั้งที่นิสิตกรอกรหัส (code_id เป็น null ถ้ารหัสไม่มีอยู่ในคาบนี้) ไว้ให้ตัดสินตอนจบคาบ
create table if not exists checkin_logs (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  student_id         integer not null references users(id) on delete cascade,
  code               text not null,
  code_id            integer references check_codes(id) on delete set null,
  device_id          text,
  submitted_at       timestamptz not null default now()
);
create index if not exists checkin_logs_session_student_idx
  on checkin_logs (checkin_session_id, student_id);
create index if not exists checkin_logs_session_device_idx
  on checkin_logs (checkin_session_id, device_id);

-- ผลสุดท้ายของแต่ละคน สร้างตอนจบคาบ (ไม่มีแถว = ขาด)
create table if not exists attendance (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  student_id         integer not null references users(id) on delete cascade,
  log_id             integer references checkin_logs(id) on delete set null,
  status             text not null check (status in ('present', 'suspicious', 'rejected')),
  flag_reason        text,
  checked_at         timestamptz not null default now(),
  unique (checkin_session_id, student_id)
);
