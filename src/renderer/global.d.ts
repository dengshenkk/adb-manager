/**
 * Type declarations for the renderer process.
 * Defines the window.api interface exposed by the preload script.
 */

import type { DeviceState, SwitchResult, AdbResult, Theme, TerminalApp, USBConnectionResult, USBConnectionStatus } from '../core/types';

export interface ElectronApi {
  listDevices: () => Promise<DeviceState[]>;
  getActiveDevice: () => Promise<DeviceState | null>;
  addDevice: (address: string, port: number, name?: string, category?: string) => Promise<DeviceState>;
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
  // Theme API
  getTheme: () => Promise<Theme>;
  setTheme: (theme: Theme) => Promise<{ success: boolean }>;
  // Terminal API
  getTerminalApp: () => Promise<TerminalApp>;
  setTerminalApp: (terminalApp: TerminalApp) => Promise<{ success: boolean }>;
  // 配置文件变更监听（CLI 修改后自动刷新）
  onConfigChanged: (callback: () => void) => () => void;
  // USB设备管理API
  connectUSBDevice: (id: string) => Promise<USBConnectionResult>;
  disconnectUSBDevice: (id: string) => Promise<USBConnectionResult>;
  getUSBConnectionStatus: (id: string) => Promise<USBConnectionStatus>;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}
