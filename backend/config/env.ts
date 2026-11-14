if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error("ต้องตั้ง JWT_ACCESS_SECRET และ JWT_REFRESH_SECRET ใน backend/.env.local");
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 8000),
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
};
