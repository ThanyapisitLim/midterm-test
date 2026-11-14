const form = document.getElementById("login-form");
const formError = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("toggle-password");
togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.setAttribute("aria-pressed", String(show));
  togglePassword.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
  document.getElementById("eye-slash").classList.toggle("hidden", !show);
});

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove("hidden");
}

function clearErrors() {
  formError.classList.add("hidden");
  for (const name of ["studentCode", "password"]) {
    form.elements[name].removeAttribute("aria-invalid");
    document.getElementById(`${name}-error`).textContent = "";
  }
}

function setFieldError(name, message) {
  form.elements[name].setAttribute("aria-invalid", "true");
  document.getElementById(`${name}-error`).textContent = message;
}

function validate(studentCode, password) {
  const errors = {};
  if (!studentCode) errors.studentCode = "กรุณากรอกรหัสนักศึกษาหรือรหัสอาจารย์";
  if (!password) errors.password = "กรุณากรอกรหัสผ่าน";
  return errors;
}

// รับเฉพาะ path ในเว็บเรา กันถูกส่งไปเว็บอื่น (open redirect)
function getNextPath() {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();

  const studentCode = form.elements.studentCode.value.trim();
  const password = form.elements.password.value;

  const errors = validate(studentCode, password);
  for (const [name, message] of Object.entries(errors)) setFieldError(name, message);
  if (Object.keys(errors).length > 0) return;

  submitBtn.disabled = true;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentCode, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showFormError(data.error ?? `เข้าสู่ระบบไม่สำเร็จ (${res.status})`);
      return;
    }

    location.href = getNextPath() ?? (data.user.role === "teacher" ? "/teacher" : "/student");
  } catch {
    showFormError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
  } finally {
    submitBtn.disabled = false;
  }
});
