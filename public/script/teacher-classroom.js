import { api, escapeHtml, initNavbar } from "/script/common.js";

initNavbar();

const id = new URLSearchParams(location.search).get("id");
const generateBtn = document.getElementById("generate-btn");
const codeError = document.getElementById("code-error");
const startBtn = document.getElementById("start-btn");
const startError = document.getElementById("start-error");

// POST /api/classrooms/:id/join-code (สร้างได้ครั้งเดียว ปุ่มนี้มีเฉพาะตอนที่ห้องยังไม่มีโค้ด) แล้วโหลดหน้าใหม่ให้โชว์โค้ด
generateBtn?.addEventListener("click", async () => {
  codeError.textContent = "";
  generateBtn.disabled = true;
  try {
    await api(`/classrooms/${encodeURIComponent(id)}/join-code`, { method: "POST" });
    location.reload();
  } catch (err) {
    codeError.textContent = err.message;
    generateBtn.disabled = false;
  }
});

// ---------- ป๊อปอัปเช็คชื่อ ----------
const modal = document.getElementById("checkin-modal");
const views = {
  waiting: document.getElementById("view-waiting"),
  showing: document.getElementById("view-showing"),
  closing: document.getElementById("view-closing"),
  result: document.getElementById("view-result"),
  error: document.getElementById("view-error"),
};
const finishBtn = document.getElementById("finish-btn");
const closeBtn = document.getElementById("close-btn");

let sessionId = null;
let pollTimer = null; // ขอข้อมูลจาก server รอบถัดไป
let tickTimer = null; // อัปเดตตัวเลขนับถอยหลังบนจอ
let endAt = 0; // เวลาที่ phase นี้จะจบ (ตามนาฬิกาเครื่องนี้)
let current = null; // ข้อมูลล่าสุดจาก /current

function showView(name) {
  for (const [key, el] of Object.entries(views)) el.classList.toggle("hidden", key !== name);
  finishBtn.classList.toggle("hidden", name === "result" || name === "error");
  closeBtn.classList.toggle("hidden", name !== "result" && name !== "error");
}

function stopTimers() {
  clearTimeout(pollTimer);
  clearInterval(tickTimer);
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// อัปเดตตัวเลขนับถอยหลังและแท่งที่ลดลง (เรียกทุก 100ms)
function tick() {
  if (!current) return;
  const left = Math.max(0, endAt - Date.now());

  if (current.phase === "waiting") {
    document.getElementById("waiting-left").textContent = Math.ceil(left / 1000);
  } else if (current.phase === "showing") {
    const codeMs = current.code_seconds * 1000;
    document.getElementById("code-left").textContent = Math.ceil(left / 1000);
    document.getElementById("bar").style.width = `${Math.min(100, (left / codeMs) * 100)}%`;
    const roundsAfter = current.total - current.round;
    document.getElementById("total-left").textContent = formatTime(left + roundsAfter * codeMs);
  } else if (current.phase === "closing") {
    document.getElementById("closing-left").textContent = Math.ceil(left / 1000);
  }
}

// รหัส 6 หลักแสดงเป็น 2 กลุ่มให้อ่านง่าย
function groupCode(code) {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

function renderCurrent(d) {
  showView(d.phase);
  if (d.phase === "showing") {
    document.getElementById("code").textContent = groupCode(d.code);
    document.getElementById("round").textContent = d.round;
    document.getElementById("total").textContent = d.total;
    document.getElementById("submitted").textContent = d.submitted_count;
    document.getElementById("students").textContent = d.student_count;
  }
}

// ขอ "ตอนนี้ควรแสดงอะไร" จาก server แล้วนับถอยหลังเอง ขอใหม่ตอนหมดเวลาของ phase (หรืออย่างน้อยทุก 3 วินาที)
// GET /api/checkin-sessions/:id/current → { phase, ms, code?, round?, total, code_seconds, submitted_count, student_count }
async function poll() {
  try {
    const d = await api(`/checkin-sessions/${sessionId}/current`);
    if (d.phase === "finished") {
      await showResult();
      return;
    }
    current = d;
    endAt = Date.now() + d.ms;
    renderCurrent(d);
    tick();
    pollTimer = setTimeout(poll, Math.min(d.ms + 60, 3000));
  } catch (err) {
    stopTimers();
    document.getElementById("error-text").textContent = err.message;
    showView("error");
  }
}

const STATUS = {
  present: { text: "มาเรียน", cls: "bg-emerald-100 text-emerald-700" },
  suspicious: { text: "ส่งเลท", cls: "bg-amber-100 text-amber-700" },
  absent: { text: "ขาด", cls: "bg-zinc-100 text-zinc-600" },
};
const ORDER = { suspicious: 0, absent: 1, present: 2 };

// GET /api/checkin-sessions/:id/result → { summary, students: [{ student_code, full_name, status, flag_reason }] }
async function showResult() {
  stopTimers();
  try {
    const { summary, students } = await api(`/checkin-sessions/${sessionId}/result`);
    document.getElementById("sum-present").textContent = summary.present;
    document.getElementById("sum-suspicious").textContent = summary.suspicious;
    document.getElementById("sum-absent").textContent = summary.absent;
    document.getElementById("result-empty").classList.toggle("hidden", students.length > 0);

    const sorted = [...students].sort(
      (a, b) => ORDER[a.status] - ORDER[b.status] || a.student_code.localeCompare(b.student_code)
    );
    document.getElementById("result-rows").innerHTML = sorted
      .map((s) => {
        const status = STATUS[s.status];
        const reason = s.flag_reason ? `<p class="mt-1 text-xs text-zinc-500">${escapeHtml(s.flag_reason)}</p>` : "";
        return `
        <tr>
          <td class="px-4 py-3 font-mono">${escapeHtml(s.student_code)}</td>
          <td class="px-4 py-3">${escapeHtml(s.full_name)}</td>
          <td class="px-4 py-3"><span class="rounded-full px-2.5 py-0.5 text-xs ${status.cls}">${status.text}</span>${reason}</td>
        </tr>`;
      })
      .join("");
    showView("result");
  } catch (err) {
    document.getElementById("error-text").textContent = err.message;
    showView("error");
  }
}

function openModal() {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeModal() {
  stopTimers();
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

// POST /api/classrooms/:id/checkin-sessions → { session: { id } }
// ถ้าคาบเดิมยังเปิดอยู่ จะได้คาบเดิมกลับมา กดซ้ำเพื่อเปิดป๊อปอัปต่อได้ (เช่นรีเฟรชหน้าระหว่างเช็คชื่อ)
startBtn.addEventListener("click", async () => {
  startError.textContent = "";
  startBtn.disabled = true;
  try {
    const { session } = await api(`/classrooms/${encodeURIComponent(id)}/checkin-sessions`, { method: "POST" });
    sessionId = session.id;
    current = null;
    showView("waiting");
    openModal();
    tickTimer = setInterval(tick, 100);
    poll();
  } catch (err) {
    startError.textContent = err.message;
  } finally {
    startBtn.disabled = false;
  }
});

// POST /api/checkin-sessions/:id/finish
finishBtn.addEventListener("click", async () => {
  if (!confirm("จบเช็คชื่อตอนนี้เลยไหม? รหัสที่เหลือจะไม่ถูกแสดงอีก")) return;
  stopTimers();
  try {
    await api(`/checkin-sessions/${sessionId}/finish`, { method: "POST" });
    await showResult();
  } catch (err) {
    document.getElementById("error-text").textContent = err.message;
    showView("error");
  }
});

// ปิดแล้วโหลดหน้าใหม่ เพื่อให้รายชื่อและจำนวนนิสิตเป็นปัจจุบัน
closeBtn.addEventListener("click", () => {
  closeModal();
  location.reload();
});
