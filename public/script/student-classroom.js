import { api, initNavbar } from "/script/common.js";

initNavbar();

const id = new URLSearchParams(location.search).get("id");
const statusText = document.getElementById("checkin-status");
const form = document.getElementById("checkin-form");
const codeInput = form.elements.code;
const sendBtn = document.getElementById("send-btn");
const checkinError = document.getElementById("checkin-error");

let wasOpen = null;

// GET /api/classrooms/:id/checkin → { open, submitted }
function renderStatus({ open, submitted }) {
  // เช็คชื่อจบแล้ว โหลดหน้าใหม่ ให้ประวัติมีผลของคาบนี้
  if (wasOpen === true && !open) {
    location.reload();
    return;
  }
  wasOpen = open;

  form.classList.toggle("hidden", !(open && !submitted));

  if (!open) statusText.textContent = "ตอนนี้ยังไม่มีการเช็คชื่อ";
  else if (submitted) statusText.textContent = "ส่งรหัสแล้ว รอผลเมื่อหมดเวลาเช็คชื่อ";
  else statusText.textContent = "กำลังเช็คชื่อ กรอกรหัสที่แสดงบนจอหน้าห้อง";
}

async function loadStatus() {
  try {
    renderStatus(await api(`/classrooms/${encodeURIComponent(id)}/checkin`));
  } catch (err) {
    statusText.textContent = err.message;
  }
}

// POST /api/classrooms/:id/checkin  { code }
// ตอบ ok = รับรหัสแล้ว (ยังไม่บอกผล) / 400 = รหัสไม่ถูกต้อง / 409 = ไม่มีการเช็คชื่อแล้ว
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  checkinError.textContent = "";
  codeInput.removeAttribute("aria-invalid");

  const code = codeInput.value.trim();
  if (!/^\d+$/.test(code) || code.length !== codeInput.maxLength) {
    codeInput.setAttribute("aria-invalid", "true");
    checkinError.textContent = `รหัสต้องเป็นตัวเลข ${codeInput.maxLength} หลัก`;
    return;
  }

  sendBtn.disabled = true;
  try {
    await api(`/classrooms/${encodeURIComponent(id)}/checkin`, { method: "POST", body: { code } });
    codeInput.value = "";
    await loadStatus();
  } catch (err) {
    codeInput.setAttribute("aria-invalid", "true");
    checkinError.textContent = err.message;
    if (err.status === 409) await loadStatus();
    else codeInput.select();
  } finally {
    sendBtn.disabled = false;
  }
});

if (id) {
  await loadStatus();
  // ถามสถานะซ้ำทุก 5 วินาที ฟอร์มจะโผล่เองตอนอาจารย์เริ่มเช็คชื่อ และหน้าจะโหลดใหม่เองตอนจบ
  setInterval(loadStatus, 5000);
}
