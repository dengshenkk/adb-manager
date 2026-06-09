/**
 * Electron Main Process
 */

import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'path';
import { existsSync } from 'fs';
import { createConnection } from 'net';
import { DeviceManager, AdbExecutor, JsonConfigStore } from '../core';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let deviceManager: DeviceManager | null = null;
let configStore: JsonConfigStore | null = null;

const isDev = !app.isPackaged;

function isPortOpen(port: number, timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    const done = (result: boolean) => { socket.destroy(); resolve(result); };
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
    socket.on('timeout', () => done(false));
    socket.setTimeout(timeout);
  });
}

async function loadRenderer(win: BrowserWindow): Promise<void> {
  if (isDev && await isPortOpen(5173)) {
    console.log('Loading from dev server: http://localhost:5173');
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const builtFile = path.join(__dirname, '../renderer/index.html');
  if (existsSync(builtFile)) {
    console.log('Loading from file:', builtFile);
    await win.loadFile(builtFile);
    return;
  }

  await win.loadURL(
    'data:text/html,<h2 style="color:#f87171;font-family:sans-serif;padding:2rem">' +
    '请先运行: npm run build:renderer 或 npm run dev</h2>'
  );
}

async function createWindow(): Promise<void> {
  const config = configStore ? await configStore.load() : null;
  const theme = config?.theme || 'system';

  let backgroundColor = '#0f172a';
  if (theme === 'light') {
    backgroundColor = '#f8fafc';
  } else if (theme === 'system') {
    backgroundColor = nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc';
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'ADB Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor,
  });

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'];
    console.log(`[RENDERER ${levels[level] || level}] ${message}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details);
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });

  mainWindow.on('focus', async () => {
    console.log('Window focused, reloading config...');
    if (deviceManager) {
      try {
        await deviceManager.refreshDevices();
        console.log('Config reloaded on focus');
      } catch (err) {
        console.error('Failed to reload config on focus:', err);
      }
    }
  });

  await loadRenderer(mainWindow);
  console.log('Window loaded successfully');
}

async function initApp(): Promise<void> {
  console.log('App ready, initializing...');

  const adb = new AdbExecutor();
  configStore = new JsonConfigStore();
  deviceManager = new DeviceManager(adb, configStore);

  console.log('DeviceManager init...');
  await deviceManager.init();
  console.log('DeviceManager ready');

  registerIpcHandlers(deviceManager, configStore);
  console.log('IPC handlers registered');

  await createWindow();
}

app.whenReady().then(initApp).catch((e) => {
  console.error('Init failed:', e);
  app.quit();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) await createWindow();
});
