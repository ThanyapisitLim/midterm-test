import { api, escapeHtml, hideError, initNavbar, requireLogin, showError } from "/script/common.js";

const list = document.getElementById("classroom-list");
const empty = document.getElementById("empty");
const pageError = document.getElementById("page-error");
const form = document.getElementById("join-form");
const joinError = document.getElementById("join-error");
const joinBtn = document.getElementById("join-btn");

const user = await requireLogin("student");
initNavbar(user);

function render(classrooms) {
  empty.classList.toggle("hidden", classrooms.length > 0);
  list.innerHTML = classrooms
    .map(
      (c) => `
      <a href="/student/classroom?id=${c.id}"
        class="group block rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-swu-red/60">
        <h2 class="font-medium">${escapeHtml(c.name)}</h2>
        <p class="mt-1 text-sm text-zinc-400">${escapeHtml(c.teacher_name)}</p>
        <span class="mt-4 inline-block text-sm text-swu-grey transition group-hover:text-white">สแกน QR เช็คชื่อ →</span>
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  joinError.textContent = "";
  form.elements.joinCode.removeAttribute("aria-invalid");

  const joinCode = form.elements.joinCode.value.trim().toUpperCase();
  if (!joinCode) {
    form.elements.joinCode.setAttribute("aria-invalid", "true");
    joinError.textContent = "กรุณากรอกโค้ดห้องเรียน";
    return;
  }

  joinBtn.disabled = true;
  try {
    await api("/classrooms/join", { method: "POST", body: { joinCode } });
    form.reset();
    await load();
  } catch (err) {
    form.elements.joinCode.setAttribute("aria-invalid", "true");
    joinError.textContent = err.message;
  } finally {
    joinBtn.disabled = false;
  }
});

load();
