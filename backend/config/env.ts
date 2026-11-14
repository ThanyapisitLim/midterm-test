// ค่าตั้งค่าที่ต้องมีเสมอ ถ้าขาดจะ error ตั้งแต่ตอนเริ่ม server ไม่ปล่อยให้ไปพังกลางทาง
// local: backend/.env.local   |   Vercel: Project Settings → Environment Variables

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}. Put it in backend/.env.local (local) or Vercel Environment Variables (prod).`);
  }
  return value;
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 3000),
  // คนละ secret กัน: เอา refresh token มาใช้เป็น access token ไม่ได้ และกลับกัน
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
};
