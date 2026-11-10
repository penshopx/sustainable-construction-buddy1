const { spawn } = require("node:child_process");

const intervalMinutes = Math.max(15, Number(process.env.CONTENT_AGENT_INTERVAL_MINUTES || 60));
let running = false;

function runAgent() {
  if (running) return;
  running = true;
  const child = spawn(process.execPath, ["scripts/content-agent.cjs"], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    running = false;
    if (code !== 0) console.error(`[content-agent-watch] runner selesai dengan kode ${code}`);
  });
}

console.log(`[content-agent-watch] aktif setiap ${intervalMinutes} menit.`);
runAgent();
const timer = setInterval(runAgent, intervalMinutes * 60 * 1000);

function shutdown() {
  clearInterval(timer);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);