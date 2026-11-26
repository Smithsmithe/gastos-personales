const { randomUUID } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "on",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: "4173",
      GASTOS_DB_PATH: path.join(os.tmpdir(), `gastos-e2e-${randomUUID()}.db`),
    },
  },
});
