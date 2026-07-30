const fs = require("fs");

const logFile = process.env.OBSIDIAN_STARTUP_LOG;
function log(message, error) {
  const detail = error ? `\n${error.stack || error}` : "";
  const line = `[${new Date().toISOString()}] [Next wrapper] ${message}${detail}\n`;
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line, "utf8");
    } catch {}
  }
  console.error(line.trim());
}

process.on("uncaughtException", (error) => {
  log("Unhandled exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log("Unhandled promise rejection", reason instanceof Error ? reason : String(reason));
  process.exit(1);
});

const serverFile = process.argv[2];
if (!serverFile) {
  log("No Next.js server file was provided");
  process.exit(1);
}

log(`Loading Next.js server: ${serverFile}`);
try {
  require(serverFile);
} catch (error) {
  log("Next.js server require failed", error);
  process.exit(1);
}
