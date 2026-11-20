const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const children = [];
let closing = false;

function start(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (!closing) shutdown(code || 0);
  });
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

start("node", ["server/index.js"]);
start("npm", ["run", "dev", "--prefix", "frontend"]);
