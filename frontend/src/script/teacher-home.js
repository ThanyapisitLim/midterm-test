import { api, escapeHtml, hideError, initNavbar, showError } from "/script/common.js";

const list = document.getElementById("classroom-list");
const empty = document.getElementById("empty");
const pageError = document.getElementById("page-error");
const form = document.getElementById("create-form");
const createError = document.getElementById("create-error");
const createBtn = document.getElementById("create-btn");

initNavbar();

// GET /api/classrooms → { classrooms: [{ id, name, student_count }] }
function render(classrooms) {
  empty.classList.toggle("hidden", classrooms.length > 0);
  list.innerHTML = classrooms
    .map(
      (c) => `
      <a href="/teacher/classroom?id=${c.id}"
        class="group block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-swu-red/60">
        <h2 class="font-medium">${escapeHtml(c.name)}</h2>
        <p class="mt-1 text-sm text-zinc-400">${Number(c.student_count) || 0} นิสิต</p>
        <span class="mt-4 inline-block text-sm text-swu-grey transition group-hover:text-white">เข้าห้องเรียน →</span>
      </a>`
    )
    .join("");
}

async function load() {
  hideError(pageError);
  try {
    const { classrooms } = await api("/classrooms");
    render(classrooms);
  } catch (err) {
    showError(pageError, err.message);
  }
}

// POST /api/classrooms  body: { name }
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  createError.textContent = "";
  form.elements.name.removeAttribute("aria-invalid");

  const name = form.elements.name.value.trim();
  if (!name) {
    form.elements.name.setAttribute("aria-invalid", "true");
    createError.textContent = "กรุณากรอกชื่อห้องเรียน";
    return;
  }

  createBtn.disabled = true;
  try {
    await api("/classrooms", { method: "POST", body: { name } });
    form.reset();
    await load();
  } catch (err) {
    createError.textContent = err.message;
  } finally {
    createBtn.disabled = false;
  }
});

load();
