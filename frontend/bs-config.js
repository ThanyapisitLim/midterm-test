// npx browser-sync start --config bs-config.js
module.exports = {
  server: {
    baseDir: "src",
    serveStaticOptions: { extensions: ["html"] },
  },
  files: ["src/**/*"],
  notify: false,
  open: false,
};
