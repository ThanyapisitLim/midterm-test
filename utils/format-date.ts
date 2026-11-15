// แสดงเวลาเป็นเวลาไทยเสมอ (server บน Vercel ใช้เวลา UTC)
function thai(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", ...options });
}

export function formatDate(date: Date) {
  return thai(date, { dateStyle: "long" });
}

export function formatTime(date: Date) {
  return thai(date, { timeStyle: "short" });
}
