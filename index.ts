import app from "./app";
import { env } from "./config/env";

// บน Vercel ไม่ต้อง listen Vercel เรียก app ที่ export ออกไปเอง
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`http://localhost:${env.port}`);
  });
}

export default app;
