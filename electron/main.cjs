const { app, BrowserWindow, dialog, utilityProcess } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3210;
let mainWindow;
let nextServer;

function serverDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");
}

function startNextServer() {
  const root = serverDirectory();
  const serverFile = path.join(root, "server.js");

  if (!fs.existsSync(serverFile)) {
    throw new Error(`Packaged server was not found at: ${serverFile}`);
  }

  // utilityProcess.fork uses Electron's bundled Node runtime directly. This
  // is more reliable on Windows than spawning the packaged Electron exe with
  // ELECTRON_RUN_AS_NODE.
  nextServer = utilityProcess.fork(serverFile, [], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(PORT),
    },
  });

  nextServer.on("exit", (code, signal) => {
    if (code !== 0 && !app.isQuitting) {
      console.error(`Next.js server exited with code ${code}, signal ${signal}`);
    }
  });
}

function waitForServer(attempts = 80) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`http://127.0.0.1:${PORT}`, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (attempts-- <= 0) return reject(new Error("Next.js server did not start in time"));
        setTimeout(check, 250);
      });
    };
    check();
  });
}

async function createWindow() {
  try {
    startNextServer();
    await waitForServer();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      "Obsidian Gym Manager",
      `The local application server could not start.\n\n${message}`
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

  await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (nextServer) nextServer.kill();
});
