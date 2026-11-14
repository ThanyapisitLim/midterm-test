// ตั้งค่า browser-sync สำหรับรันหน้าเว็บในเครื่อง: npx browser-sync start --config bs-config.js
module.exports = {
  server: {
    baseDir: "src",
    // ให้ /register เปิดไฟล์ register.html ได้ (เหมือน cleanUrls ของ Vercel ใน vercel.json)
    serveStaticOptions: { extensions: ["html"] },
  },
  files: ["src/**/*"], // ไฟล์ไหนเปลี่ยน รีเฟรชเบราว์เซอร์ให้เอง
  notify: false,
  open: false,
};
