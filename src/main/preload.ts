/**
 * Preload Script - Safe bridge between renderer and main process
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { DeviceState, SwitchResult, AdbResult, Theme, TerminalApp } from '../core/types';

export interface ElectronApi {
  listDevices: () => Promise<DeviceState[]>;
  getActiveDevice: () => Promise<DeviceState | null>;
  addDevice: (address: string, port: number, name?: string) => Promise<DeviceState>;
  removeDevice: (id: string) => Promise<{ success: boolean }>;
  switchTo: (id: string) => Promise<SwitchResult>;
  connect: (id: string) => Promise<AdbResult>;
  disconnect: (id: string) => Promise<AdbResult>;
  disconnectAll: () => Promise<AdbResult>;
  switchToActive: () => Promise<AdbResult>;
  deactivate: () => Promise<AdbResult>;
  refreshStatus: () => Promise<DeviceState[]>;
  refreshDevices: () => Promise<DeviceState[]>;
  reloadConfig: () => Promise<{ success: boolean }>;
  launchScrcpy: (id: string) => Promise<AdbResult>;
  launchAdbShell: (id: string, terminalApp: TerminalApp) => Promise<AdbResult>;
  getTheme: () => Promise<Theme>;
  setTheme: (theme: Theme) => Promise<{ success: boolean }>;
  getTerminalApp: () => Promise<TerminalApp>;
  setTerminalApp: (terminalApp: TerminalApp) => Promise<{ success: boolean }>;
  /** 注册配置文件变更监听（CLI 修改后自动刷新） */
  onConfigChanged: (callback: () => void) => () => void;
}

const api: ElectronApi = {
  listDevices: () => ipcRenderer.invoke('device:list'),
  getActiveDevice: () => ipcRenderer.invoke('device:active'),
  addDevice: (address, port, name) => ipcRenderer.invoke('device:add', address, port, name),
  removeDevice: (id) => ipcRenderer.invoke('device:remove', id),
  switchTo: (id) => ipcRenderer.invoke('device:switch', id),
  connect: (id) => ipcRenderer.invoke('device:connect', id),
  disconnect: (id) => ipcRenderer.invoke('device:disconnect', id),
  disconnectAll: () => ipcRenderer.invoke('device:disconnectAll'),
  switchToActive: () => ipcRenderer.invoke('device:switchToActive'),
  deactivate: () => ipcRenderer.invoke('device:deactivate'),
  refreshStatus: () => ipcRenderer.invoke('device:refresh'),
  refreshDevices: () => ipcRenderer.invoke('device:refreshDevices'),
  reloadConfig: () => ipcRenderer.invoke('config:reload'),
  launchScrcpy: (id) => ipcRenderer.invoke('device:scrcpy', id),
  launchAdbShell: (id, terminalApp) => ipcRenderer.invoke('device:adbShell', id, terminalApp),
  getTheme: () => ipcRenderer.invoke('config:getTheme'),
  setTheme: (theme) => ipcRenderer.invoke('config:setTheme', theme),
  getTerminalApp: () => ipcRenderer.invoke('config:getTerminalApp'),
  setTerminalApp: (terminalApp) => ipcRenderer.invoke('config:setTerminalApp', terminalApp),
  onConfigChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('config:changed', handler);
    return () => ipcRenderer.removeListener('config:changed', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
