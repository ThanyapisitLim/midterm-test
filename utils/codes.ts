import { randomInt } from "node:crypto";

// สร้างรหัสตัวเลขที่ไม่ซ้ำกัน เช่น ["048213", "771902", ...]
export function makeCheckinCodes(count: number, length: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(String(randomInt(10 ** length)).padStart(length, "0"));
  }
  return [...codes];
}
