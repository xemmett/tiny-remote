/**
 * Tiny Remote - Electron main process
 * Spawns FastAPI backend and Express frontend, shows status/QR/copy link.
 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const fs = require('fs');

const DEFAULT_FRONTEND_PORT = 8765;
const DEFAULT_BACKEND_PORT = 8764;

let mainWindow = null;
let backendProc = null;
let frontendProc = null;
let frontendPort = DEFAULT_FRONTEND_PORT;
let backendPort = DEFAULT_BACKEND_PORT;

function getAppDir() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, '..');
}

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      findFreePort(startPort + 1).then(resolve);
    });
  });
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const family = typeof net.family === 'string' ? net.family : 'IPv' + net.family;
      if (family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function killProc(proc) {
  if (!proc) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', proc.pid, '/f', '/t'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch (_) {}
}

async function startBackend() {
  const appDir = getAppDir();
  const isDev = !app.isPackaged;
  const backendExe = isDev
    ? 'python'
    : path.join(appDir, 'backend.exe');
  const backendArgs = isDev
    ? [path.join(appDir, 'pc-control', 'main.py'), '--port', String(backendPort)]
    : ['--port', String(backendPort)];

  return new Promise((resolve, reject) => {
    backendProc = spawn(backendExe, backendArgs, {
      cwd: isDev ? path.join(appDir, 'pc-control') : appDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    backendProc.stderr.on('data', (d) => { stderr += d.toString(); });
    backendProc.on('error', (err) => reject(err));
    backendProc.on('exit', (code) => {
      if (code !== 0 && code !== null) reject(new Error(stderr || `Backend exited ${code}`));
    });
    // Give it a moment to bind
    setTimeout(resolve, 800);
  });
}

async function startFrontend() {
  const appDir = getAppDir();
  const isDev = !app.isPackaged;
  const frontendExe = isDev
    ? 'node'
    : path.join(appDir, 'frontend.exe');
  const frontendArgs = isDev
    ? [path.join(appDir, 'frontend', 'server', 'index.js')]
    : [];
  const env = {
    ...process.env,
    PORT: String(frontendPort),
    FASTAPI_URL: `http://127.0.0.1:${backendPort}`,
    NODE_ENV: 'production',
  };

  return new Promise((resolve, reject) => {
    frontendProc = spawn(frontendExe, frontendArgs, {
      cwd: isDev ? path.join(appDir, 'frontend') : appDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    frontendProc.on('error', (err) => reject(err));
    frontendProc.on('exit', (code) => {
      if (code !== 0 && code !== null) reject(new Error(`Frontend exited ${code}`));
    });
    setTimeout(resolve, 500);
  });
}

async function startServers() {
  frontendPort = await findFreePort(DEFAULT_FRONTEND_PORT);
  backendPort = frontendPort === DEFAULT_FRONTEND_PORT ? DEFAULT_BACKEND_PORT : await findFreePort(DEFAULT_BACKEND_PORT);

  await startBackend();
  await startFrontend();

  const url = `http://${getLocalIP()}:${frontendPort}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
  } catch (_) {}
  return { url, port: frontendPort, localIP: getLocalIP(), qrDataUrl };
}

function stopServers() {
  killProc(frontendProc);
  killProc(backendProc);
  frontendProc = null;
  backendProc = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.ico'),
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  createWindow();
  try {
    const info = await startServers();
    mainWindow?.webContents.send('server-status', { running: true, ...info });
  } catch (err) {
    mainWindow?.webContents.send('server-status', { running: false, error: err.message });
  }
});

app.on('window-all-closed', () => {
  stopServers();
  app.quit();
});

app.on('before-quit', () => {
  stopServers();
});

// IPC: restart backends
ipcMain.handle('restart-servers', async () => {
  stopServers();
  await new Promise((r) => setTimeout(r, 500));
  try {
    const info = await startServers();
    return { ok: true, ...info };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: get startup folder path (for "Start on boot")
ipcMain.handle('get-startup-folder', () => {
  const home = process.env.APPDATA || process.env.USERPROFILE;
  return path.join(home, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
});

// IPC: set/remove startup shortcut (Startup folder - launches on login, not boot)
ipcMain.handle('set-start-on-boot', async (_, enable) => {
  const startupFolder = path.join(
    process.env.APPDATA || process.env.USERPROFILE,
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
  );
  const shortcutPath = path.join(startupFolder, 'Tiny Remote.lnk');
  if (enable) {
    try {
      const { execSync } = require('child_process');
      const exePath = process.execPath;
      const ps = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${shortcutPath.replace(/'/g, "''")}'); $s.TargetPath = '${exePath.replace(/'/g, "''")}'; $s.Save()`;
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '`"')}"`, { stdio: 'ignore' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  } else {
    try {
      if (fs.existsSync(shortcutPath)) fs.unlinkSync(shortcutPath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
});

// IPC: check if start-on-boot is set
ipcMain.handle('get-start-on-boot', () => {
  const shortcutPath = path.join(
    process.env.APPDATA || process.env.USERPROFILE,
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
    'Tiny Remote.lnk'
  );
  return fs.existsSync(shortcutPath);
});

// IPC: open URL in default browser (e.g. open control panel on PC)
ipcMain.handle('open-in-browser', (_, url) => {
  if (url && typeof url === 'string') shell.openExternal(url);
});
