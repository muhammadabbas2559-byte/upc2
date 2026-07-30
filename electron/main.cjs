const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

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
  nextServer = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(PORT),
    },
    windowsHide: true,
  });

  nextServer.on("error", (error) => console.error("Next.js server error:", error));
  nextServer.stderr.on("data", (data) => console.error(`[Next] ${data}`));
}

function waitForServer(attempts = 60) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(`http://127.0.0.1:${PORT}`, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (attempts-- <= 0) return reject(new Error("Next.js server did not start"));
        setTimeout(check, 250);
      });
    };
    check();
  });
}

async function createWindow() {
  startNextServer();
  try {
    await waitForServer();
  } catch (error) {
    dialog.showErrorBox(
      "Obsidian Gym Manager",
      "The application could not start its local server. Please reinstall the application."
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
  if (nextServer) nextServer.kill();
});
