/**
 * IPC Handlers - Bridge between Electron renderer and DeviceManager
 */

import { ipcMain } from 'electron';
import { DeviceManager } from '../core';
import type { IConfigStore } from '../core/config-store';
import type { Theme, TerminalApp } from '../core/types';

export function registerIpcHandlers(manager: DeviceManager, store: IConfigStore): void {
  ipcMain.handle('device:list', async () => {
    return manager.getDevices();
  });

  ipcMain.handle('device:active', async () => {
    return manager.getActiveDevice();
  });

  ipcMain.handle('device:add', async (_event, address: string, port: number, name?: string) => {
    return manager.addDevice(address, port, name);
  });

  ipcMain.handle('device:remove', async (_event, id: string) => {
    await manager.removeDevice(id);
    return { success: true };
  });

  ipcMain.handle('device:switch', async (_event, id: string) => {
    return manager.switchTo(id);
  });

  ipcMain.handle('device:connect', async (_event, id: string) => {
    return manager.connectDevice(id);
  });

  ipcMain.handle('device:disconnect', async (_event, id: string) => {
    return manager.disconnectDevice(id);
  });

  ipcMain.handle('device:deactivate', async () => {
    return manager.deactivate();
  });

  ipcMain.handle('device:refresh', async () => {
    await manager.refreshStatus();
    return manager.getDevices();
  });

  ipcMain.handle('device:refreshDevices', async () => {
    await manager.refreshDevices();
    return manager.getDevices();
  });

  ipcMain.handle('device:scrcpy', async (_event, id: string) => {
    return manager.launchScrcpy(id);
  });

  ipcMain.handle('device:adbShell', async (_event, id: string, terminalApp: TerminalApp) => {
    return manager.launchAdbShell(id, terminalApp);
  });

  ipcMain.handle('config:getTheme', async () => {
    const config = await store.load();
    return config.theme;
  });

  ipcMain.handle('config:setTheme', async (_event, theme: Theme) => {
    const config = await store.load();
    config.theme = theme;
    await store.save(config);
    return { success: true };
  });

  ipcMain.handle('config:getTerminalApp', async () => {
    const config = await store.load();
    return config.terminalApp;
  });

  ipcMain.handle('config:setTerminalApp', async (_event, terminalApp: TerminalApp) => {
    const config = await store.load();
    config.terminalApp = terminalApp;
    await store.save(config);
    return { success: true };
  });
}
