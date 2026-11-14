import app from "./app";
import { env } from "./config/env";

// ในเครื่อง: เปิด server เอง   |   บน Vercel: Vercel เรียก app ที่ export ออกไปให้เอง ไม่ต้อง listen
if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`http://localhost:${env.port}`);
  });
}

export default app;
