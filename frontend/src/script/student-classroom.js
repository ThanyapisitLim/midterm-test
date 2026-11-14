import { api, initNavbar, requireLogin, showError } from "/script/common.js";

const user = await requireLogin("student");
initNavbar(user);

const id = new URLSearchParams(location.search).get("id");
const className = document.getElementById("classroom-name");
const teacherName = document.getElementById("teacher-name");
const pageError = document.getElementById("page-error");

// GET /api/classrooms/:id → { classroom: { id, name, teacher_name } }
async function load() {
  try {
    const { classroom } = await api(`/classrooms/${encodeURIComponent(id)}`);
    document.title = `${classroom.name} · เช็คชื่อเข้าเรียน`;
    className.textContent = classroom.name;
    teacherName.textContent = classroom.teacher_name;
  } catch (err) {
    showError(pageError, err.message);
  }
}

if (id) {
  load();
} else {
  showError(pageError, "ไม่พบห้องเรียน");
}
