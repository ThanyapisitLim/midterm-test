// escape ข้อความจากผู้ใช้ก่อนใส่ innerHTML เสมอ กัน XSS
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

// refresh token ใช้ได้ครั้งเดียว จึงต้องใช้ request เดียวร่วมกันถ้ามีหลายที่ขอพร้อมกัน
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

// 401 → ขอ token ใหม่แล้วลองอีกครั้ง ถ้ายังไม่ได้ก็กลับไปหน้า login
export async function api(path, { method = "GET", body } = {}) {
  let res = await request(path, { method, body });

  if (res.status === 401 && (await refreshSession())) {
    res = await request(path, { method, body });
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    location.href = `/?next=${encodeURIComponent(location.pathname + location.search)}`;
    return new Promise(() => {});
  }
  if (!res.ok) {
    throw Object.assign(new Error(data.error ?? `เกิดข้อผิดพลาด (${res.status})`), {
      status: res.status,
      details: data.details,
    });
  }
  return data;
}

// ผูกปุ่มออกจากระบบ (ชื่อผู้ใช้ server ใส่ในหน้าให้แล้ว)
export function initNavbar() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      location.href = "/";
    }
  });
}
