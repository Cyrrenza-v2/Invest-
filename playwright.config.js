const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  timeout: 15_000,
  retries: 0,
});
