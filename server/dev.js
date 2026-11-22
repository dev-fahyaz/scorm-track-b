"use strict";

const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const children = [];
let closing = false;

function start(label, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (closing) return;
    const status = signal ? `signal ${signal}` : `code ${code == null ? 0 : code}`;
    console.error(`[dev] ${label} exited (${status}). Other processes keep running. Press Ctrl+C to stop.`);
    if (label === "api" && code && code !== 0) {
      console.error(
        "[dev] If you saw EADDRINUSE on port 3001, an API is already running — keep using it, or stop that process and restart."
      );
      console.error("[dev] Dashboard (Vite) should still be available at http://localhost:5173/ (check the Vite line if the port changed).");
    }
  });
  return child;
}

function shutdown(code) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev] Starting Track B API (http://127.0.0.1:3001) and optional dashboard (http://localhost:5173/).");
console.log("[dev] API-only: npm start · Dashboard-only (API already up): npm run dev:ui");

start("api", "node", ["server/index.js"]);
start("ui", "npm", ["run", "dev", "--prefix", "frontend"]);
