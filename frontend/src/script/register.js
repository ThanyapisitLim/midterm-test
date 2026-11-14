const form = document.getElementById("register-form");
const formError = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const FIELDS = ["fullName", "studentCode", "password", "confirmPassword"];

const codeLabel = document.getElementById("code-label");
function updateRoleUi() {
  const isTeacher = form.elements.role.value === "teacher";
  codeLabel.textContent = isTeacher ? "รหัสอาจารย์" : "รหัสนักศึกษา";
  form.elements.studentCode.inputMode = isTeacher ? "text" : "numeric";
}
form.elements.role.forEach((radio) => radio.addEventListener("change", updateRoleUi));

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove("hidden");
}

function clearErrors() {
  formError.classList.add("hidden");
  for (const name of FIELDS) {
    form.elements[name].removeAttribute("aria-invalid");
    document.getElementById(`${name}-error`).textContent = "";
  }
}

function setFieldError(name, message) {
  form.elements[name]?.setAttribute("aria-invalid", "true");
  const slot = document.getElementById(`${name}-error`);
  if (slot) slot.textContent = message;
}

function validate(v) {
  const errors = {};

  if (!v.fullName) errors.fullName = "กรุณากรอกชื่อ-นามสกุล";
  else if (v.fullName.length > 100) errors.fullName = "ชื่อยาวเกิน 100 ตัวอักษร";

  if (v.role === "teacher") {
    if (!v.studentCode) errors.studentCode = "กรุณากรอกรหัสอาจารย์";
    else if (!/^[A-Za-z0-9]{3,20}$/.test(v.studentCode)) errors.studentCode = "รหัสอาจารย์ใช้ตัวอักษรหรือตัวเลข 3-20 ตัว";
  } else {
    if (!v.studentCode) errors.studentCode = "กรุณากรอกรหัสนักศึกษา";
    else if (!/^\d{8,12}$/.test(v.studentCode)) errors.studentCode = "รหัสนักศึกษาต้องเป็นตัวเลข 8-12 หลัก";
  }

  if (!v.password) errors.password = "กรุณากรอกรหัสผ่าน";
  else if (v.password.length < 8) errors.password = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว";
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errors.password = "ต้องมีทั้งตัวอักษรและตัวเลข";

  if (!v.confirmPassword) errors.confirmPassword = "กรุณายืนยันรหัสผ่าน";
  else if (v.confirmPassword !== v.password) errors.confirmPassword = "รหัสผ่านไม่ตรงกัน";

  return errors;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();

  const values = {
    role: form.elements.role.value,
    fullName: form.elements.fullName.value.trim(),
    studentCode: form.elements.studentCode.value.trim(),
    password: form.elements.password.value,
    confirmPassword: form.elements.confirmPassword.value,
  };

  const errors = validate(values);
  for (const [name, message] of Object.entries(errors)) setFieldError(name, message);
  if (Object.keys(errors).length > 0) return;

  submitBtn.disabled = true;
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.details && typeof data.details === "object") {
        for (const [name, message] of Object.entries(data.details)) setFieldError(name, message);
      } else {
        showFormError(data.error ?? `สมัครสมาชิกไม่สำเร็จ (${res.status})`);
      }
      return;
    }

    const role = data.user?.role ?? values.role;
    location.href = role === "teacher" ? "/teacher" : "/student";
  } catch {
    showFormError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
  } finally {
    submitBtn.disabled = false;
  }
});
