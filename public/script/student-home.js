import { api, initNavbar } from "/script/common.js";

initNavbar();

const form = document.getElementById("join-form");
const joinError = document.getElementById("join-error");
const joinBtn = document.getElementById("join-btn");

// POST /api/classrooms/join  { joinCode } แล้วโหลดหน้าใหม่ ให้ server render รายการห้องให้
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
    location.reload();
  } catch (err) {
    form.elements.joinCode.setAttribute("aria-invalid", "true");
    joinError.textContent = err.message;
    joinBtn.disabled = false;
  }
});
