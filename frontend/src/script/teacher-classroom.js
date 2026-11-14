import { api, escapeHtml, initNavbar, requireLogin, showError } from "/script/common.js";

const user = await requireLogin("teacher");
initNavbar(user);

const id = new URLSearchParams(location.search).get("id");
const className = document.getElementById("classroom-name");
const pageError = document.getElementById("page-error");
const joinCode = document.getElementById("join-code");
const generateBtn = document.getElementById("generate-btn");
const codeError = document.getElementById("code-error");
const studentCount = document.getElementById("student-count");
const rows = document.getElementById("student-rows");
const empty = document.getElementById("empty");

function showJoinCode(code) {
  joinCode.textContent = code ?? "–";
  generateBtn.textContent = code ? "สร้างโค้ดใหม่" : "สร้างโค้ด";
}

// GET /api/classrooms/:id → { classroom: { id, name, join_code }, students: [{ id, student_code, full_name }] }
function render({ classroom, students }) {
  document.title = `${classroom.name} · เช็คชื่อเข้าเรียน`;
  className.textContent = classroom.name;
  showJoinCode(classroom.join_code);
  studentCount.textContent = `(${students.length})`;
  empty.classList.toggle("hidden", students.length > 0);
  rows.innerHTML = students
    .map(
      (s) => `
      <tr>
        <td class="px-4 py-3 font-mono">${escapeHtml(s.student_code)}</td>
        <td class="px-4 py-3">${escapeHtml(s.full_name)}</td>
      </tr>`
    )
    .join("");
}

async function load() {
  try {
    render(await api(`/classrooms/${encodeURIComponent(id)}`));
  } catch (err) {
    showError(pageError, err.message);
  }
}

// POST /api/classrooms/:id/join-code → { join_code }
generateBtn.addEventListener("click", async () => {
  codeError.textContent = "";
  generateBtn.disabled = true;
  try {
    const { join_code } = await api(`/classrooms/${encodeURIComponent(id)}/join-code`, { method: "POST" });
    showJoinCode(join_code);
  } catch (err) {
    codeError.textContent = err.message;
  } finally {
    generateBtn.disabled = false;
  }
});

if (id) {
  load();
} else {
  showError(pageError, "ไม่พบห้องเรียน");
}
