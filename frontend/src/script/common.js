// ฟังก์ชันที่หน้าหลังจาก login ใช้ร่วมกัน (โหลดด้วย <script type="module">)

// ข้อความที่มาจากผู้ใช้ (เช่นชื่อห้องเรียน) ต้อง escape ก่อนใส่ innerHTML เสมอ กัน XSS
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

async function request(path, { method, body }) {
  try {
    return await fetch(`/api${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
  }
}

// ขอ access token ใหม่ด้วย refresh token (อยู่ใน httpOnly cookie ฝั่งนี้อ่านไม่ได้ แค่เรียก endpoint)
// เรียกพร้อมกันหลายที่ให้ใช้ request เดียวร่วมกัน เพราะ refresh token ใช้ได้ครั้งเดียว
// ถ้ายิงซ้อนกัน อันที่สองจะถูกมองว่าเป็นการเอา token เก่ามาใช้ซ้ำ แล้วโดนเพิกถอนทั้งหมด
let refreshing = null;
function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// เรียก backend ที่ /api (โดเมนเดียวกับหน้าเว็บ เบราว์เซอร์แนบ cookie ไปให้เอง)
// - 401 (access token หมดอายุ) → ขอ token ใหม่แล้วลองอีกครั้งโดยผู้ใช้ไม่รู้ตัว
// - ขอใหม่ไม่ได้ (refresh หมดอายุ/ถูกเพิกถอน) → ส่งกลับหน้า login แล้วกลับมาหน้าเดิมหลัง login (?next=)
// - error อื่นโยนเป็น Error ที่มี message ภาษาไทยจาก server ให้หน้าเว็บเอาไปแสดงเอง
export async function api(path, { method = "GET", body } = {}) {
  let res = await request(path, { method, body });

  if (res.status === 401 && (await refreshSession())) {
    res = await request(path, { method, body });
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    location.href = `/?next=${encodeURIComponent(location.pathname + location.search)}`;
    return new Promise(() => {}); // หยุดโค้ดที่เหลือระหว่างรอเปลี่ยนหน้า
  }
  if (!res.ok) {
    throw Object.assign(new Error(data.error ?? `เกิดข้อผิดพลาด (${res.status})`), {
      status: res.status,
      details: data.details,
    });
  }
  return data;
}

// แถบด้านบน: ใส่ชื่อผู้ใช้ และผูกปุ่มออกจากระบบ
export async function initNavbar() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      location.href = "/";
    }
  });

  try {
    const { user } = await api("/auth/me");
    const name = document.getElementById("nav-name");
    name.textContent = user.full_name;
    name.classList.remove("hidden");
  } catch {
    // ยังไม่มี backend หรือโหลดชื่อไม่ได้ ก็ใช้งานหน้าต่อได้ แค่ไม่แสดงชื่อ
  }
}

export function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

export function hideError(el) {
  el.textContent = "";
  el.classList.add("hidden");
}
