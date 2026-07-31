const { app, BrowserWindow, dialog, utilityProcess } = require("electron");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");

const DEFAULT_PORT = 3210;
let serverPort = DEFAULT_PORT;
let mainWindow;
let nextServer;
let nextServerFailure;
let logFile;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function writeLog(message, error) {
  const detail = error ? `\n${error.stack || error}` : "";
  const line = `[${new Date().toISOString()}] ${message}${detail}\n`;
  console.log(line.trim());
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line, "utf8");
    } catch (writeError) {
      console.error("Could not write startup log:", writeError);
    }
  }
}

function serverDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");
}

function findAvailablePort(startPort = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    const probe = (port) => {
      const server = net.createServer();
      server.once("error", () => probe(port + 1));
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };
    probe(startPort);
    setTimeout(() => reject(new Error("Could not find an available local port")), 5000);
  });
}

function startNextServer() {
  const root = serverDirectory();
  const serverFile = path.join(root, "server.js");
  writeLog(`Starting Next.js server. packaged=${app.isPackaged} root=${root} port=${serverPort}`);

  if (!fs.existsSync(serverFile)) {
    throw new Error(`Packaged server was not found at: ${serverFile}`);
  }
  const runtimeDeps = path.join(root, "runtime-deps");
  for (const moduleName of ["next", "react", "react-dom"]) {
    const modulePackage = path.join(runtimeDeps, moduleName, "package.json");
    if (!fs.existsSync(modulePackage)) {
      throw new Error(`Packaged runtime is missing ${moduleName}: ${modulePackage}`);
    }
  }

  writeLog(`Found server entry: ${serverFile}`);
  const wrapperFile = app.isPackaged
    ? path.join(process.resourcesPath, "next-server-wrapper.cjs")
    : path.join(__dirname, "next-server-wrapper.cjs");
  nextServer = utilityProcess.fork(wrapperFile, [serverFile], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(serverPort),
      NODE_PATH: runtimeDeps,
      NEXT_TELEMETRY_DISABLED: "1",
      OBSIDIAN_STARTUP_LOG: logFile,
    },
    stdio: "pipe",
  });

  nextServer.stdout?.on("data", (data) => writeLog(`[Next stdout] ${data.toString().trim()}`));
  nextServer.stderr?.on("data", (data) => writeLog(`[Next stderr] ${data.toString().trim()}`));
  nextServer.on("spawn", () => writeLog("Next.js utility process started"));
  nextServer.on("spawn-error", (error) => writeLog("Next.js utility process spawn error", error));
  nextServer.on("exit", (code, signal) => {
    const message = `Next.js server exited with code ${code}, signal ${signal}`;
    writeLog(message);
    if (code !== 0 && !app.isQuitting) nextServerFailure = new Error(message);
  });
}

function waitForServer(attempts = 80) {
  return new Promise((resolve, reject) => {
    let lastError;
    const check = () => {
      if (nextServerFailure) {
        reject(nextServerFailure);
        return;
      }
      const request = http.get(`http://127.0.0.1:${serverPort}`, (response) => {
        response.resume();
        writeLog(`Next.js server responded with HTTP ${response.statusCode}`);
        resolve();
      });
      request.on("error", (error) => {
        lastError = error;
        if (attempts-- <= 0) {
          reject(new Error(`Next.js server did not start in time: ${lastError.message}`));
          return;
        }
        setTimeout(check, 250);
      });
    };
    check();
  });
}

async function createWindow() {
  logFile = path.join(app.getPath("userData"), "startup.log");
  writeLog("Application startup");

  try {
    serverPort = await findAvailablePort();
    writeLog(`Selected local port ${serverPort}`);
    startNextServer();
    await waitForServer();
  } catch (error) {
    writeLog("Application server startup failed", error);
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      "Obsidian Gym Manager",
      `The local application server could not start.\n\n${message}\n\nA diagnostic log was saved here:\n${logFile}`
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0d0d0d",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  writeLog(`Loading http://127.0.0.1:${serverPort}`);
  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  writeLog("Application window loaded");
}

if (hasSingleInstanceLock) {
  app.whenReady().then(createWindow).catch((error) => {
    writeLog("Unhandled startup error", error);
  });
}

app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  writeLog("Application shutting down");
  if (nextServer) nextServer.kill();
});
