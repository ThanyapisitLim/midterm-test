// หน้า login/register: ถ้า login อยู่แล้วให้ไปหน้าของตัวเองเลย
async function currentUser() {
  try {
    let res = await fetch("/api/auth/me");
    if (res.status === 401) res = await fetch("/api/auth/refresh", { method: "POST" });
    return res.ok ? (await res.json()).user : null;
  } catch {
    return null;
  }
}

const user = await currentUser();
if (user) location.replace(user.role === "teacher" ? "/teacher" : "/student");
