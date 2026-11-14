import { api, initNavbar } from "/script/common.js";

initNavbar();

const form = document.getElementById("create-form");
const createError = document.getElementById("create-error");
const createBtn = document.getElementById("create-btn");

// POST /api/classrooms  { name } แล้วโหลดหน้าใหม่ ให้ server render รายการห้องให้
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
    location.reload();
  } catch (err) {
    createError.textContent = err.message;
    createBtn.disabled = false;
  }
});
