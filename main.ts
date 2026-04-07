import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let backendProcess: any;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
  });

  mainWindow.loadURL("http://localhost:3000");
  mainWindow.webContents.openDevTools();
}

function waitForServer(url: string, callback: () => void) {
  const check = () => {
    http.get(url, () => callback()).on("error", () => {
      setTimeout(check, 500);
    });
  };
  check();
}

app.whenReady().then(() => {
  backendProcess = spawn("npx", ["ts-node", "--esm", "adapters/web/back/server.ts"], {
    cwd: __dirname,
    shell: false,
    env: { ...process.env, NODE_ENV: 'production' }
  });
  backendProcess.stdout.on("data", (data: any) => {
    console.log(`[BACKEND]: ${data}`);
  });

  backendProcess.stderr.on("data", (data: any) => {
    console.error(`[BACKEND ERROR]: ${data}`);
  });

  waitForServer("http://localhost:3000", () => {
    createWindow();
  });
});

ipcMain.handle('select-download-folder', async () => {
  console.log('IPC select-download-folder called');
  if (!mainWindow) {
    console.log('No mainWindow');
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Sélectionner un dossier de téléchargement'
  });

  console.log('Dialog result:', result);
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    console.log('Canceled or no paths');
    return null;
  }

  console.log('Selected folder:', result.filePaths[0]);
  return result.filePaths[0];
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});