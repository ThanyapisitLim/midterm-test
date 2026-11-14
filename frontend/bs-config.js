// npx browser-sync start --config bs-config.js  (ต้องรัน backend ที่พอร์ต 8000 ค้างไว้ด้วย)
module.exports = {
  proxy: "localhost:8000",
  files: ["src/**/*"],
  notify: false,
  open: false,
};
