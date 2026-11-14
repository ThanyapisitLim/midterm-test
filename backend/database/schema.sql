-- รันซ้ำได้ ไม่ลบข้อมูลเดิม (ใช้ if not exists)

-- อาจารย์ + นิสิตอยู่ตารางเดียว แยกด้วย role  login ด้วย student_code + รหัสผ่าน (อาจารย์ก็ใช้คอลัมน์นี้เก็บรหัสอาจารย์)
create table if not exists users (
  id            integer generated always as identity primary key,
  role          text not null check (role in ('teacher', 'student')),
  student_code  text not null unique,
  full_name     text not null,
  password_hash text not null,                -- hash จาก bcrypt ห้ามเก็บรหัสผ่านจริง
  created_at    timestamptz not null default now()
);

-- refresh token ที่ออกให้: เก็บแค่ jti (id ในตัว token) ไม่เก็บตัว token  ใช้เพิกถอน (logout) และจับการเอา token เก่ามาใช้ซ้ำ
create table if not exists refresh_tokens (
  jti        uuid primary key,
  user_id    integer not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,                     -- null = ยังใช้ได้
  created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_user_idx on refresh_tokens (user_id);

-- ห้องเรียน: อาจารย์ 1 คนมีได้หลายห้อง
create table if not exists classrooms (
  id         integer generated always as identity primary key,
  teacher_id integer not null references users(id) on delete cascade,
  name       text not null,
  join_code  text unique,                     -- null = ยังไม่ได้ Generate; กดสร้างใหม่แล้วโค้ดเก่าใช้ไม่ได้
  created_at timestamptz not null default now()
);

-- นักเรียนเข้าร่วมห้อง (กรอก join_code)
create table if not exists enrollments (
  classroom_id integer not null references classrooms(id) on delete cascade,
  student_id   integer not null references users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

-- การเช็คชื่อ 1 ครั้ง (1 วัน/1 คาบ)  ended_at เป็น null = ยังเปิดอยู่
create table if not exists checkin_sessions (
  id           integer generated always as identity primary key,
  classroom_id integer not null references classrooms(id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);
-- ห้องเดียวเปิดเช็คชื่อซ้อนกันไม่ได้
create unique index if not exists one_open_session_per_classroom
  on checkin_sessions (classroom_id) where ended_at is null;

-- QR ทุกอันที่เคยแสดง เก็บไว้หมด เพื่อแยกได้ว่า token "หมดอายุ" หรือ "ปลอม/ไม่มีอยู่จริง"
create table if not exists qr_tokens (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  token              text not null unique,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);
create index if not exists qr_tokens_session_expires_idx
  on qr_tokens (checkin_session_id, expires_at desc);

-- ผลเช็คชื่อ: 1 คน 1 แถวต่อ 1 การเช็คชื่อ
create table if not exists attendance (
  id                 integer generated always as identity primary key,
  checkin_session_id integer not null references checkin_sessions(id) on delete cascade,
  student_id         integer not null references users(id) on delete cascade,
  qr_token_id        integer references qr_tokens(id) on delete set null,
  device_id          text,                    -- จาก cookie ใช้จับเครื่องเดียวเช็คให้หลายคน
  status             text not null check (status in ('present', 'suspicious', 'rejected')),
  flag_reason        text,                    -- เช่น "QR หมดอายุแล้ว 12 วินาที"
  checked_at         timestamptz not null default now(),
  unique (checkin_session_id, student_id)
);
create index if not exists attendance_session_device_idx
  on attendance (checkin_session_id, device_id);

-- ปรับตาราง users ที่สร้างไว้จากเวอร์ชันแรก (มี email และ student_code เว้นว่างได้) ให้ตรงกับด้านบน รันซ้ำได้
alter table users drop column if exists email;
alter table users drop constraint if exists users_check;
alter table users alter column student_code set not null;
