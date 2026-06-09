/**
 * Type declarations for the renderer process.
 * Defines the window.api interface exposed by the preload script.
 */

import type { DeviceState, SwitchResult, AdbResult, Theme, TerminalApp, USBConnectionResult, USBConnectionStatus } from '../core/types';

export interface ElectronApi {
  listDevices: () => Promise<DeviceState[]>;
  getActiveDevice: () => Promise<DeviceState | null>;
  addDevice: (address: string, port: number, name?: string) => Promise<DeviceState>;
  removeDevice: (id: string) => Promise<{ success: boolean }>;
  switchTo: (id: string) => Promise<SwitchResult>;
  connect: (id: string) => Promise<AdbResult>;
  disconnect: (id: string) => Promise<AdbResult>;
  deactivate: () => Promise<AdbResult>;
  refreshStatus: () => Promise<DeviceState[]>;
  refreshDevices: () => Promise<DeviceState[]>;
  launchScrcpy: (id: string) => Promise<AdbResult>;
  launchAdbShell: (id: string, terminalApp: TerminalApp) => Promise<AdbResult>;
  // Theme API
  getTheme: () => Promise<Theme>;
  setTheme: (theme: Theme) => Promise<{ success: boolean }>;
  // Terminal API
  getTerminalApp: () => Promise<TerminalApp>;
  setTerminalApp: (terminalApp: TerminalApp) => Promise<{ success: boolean }>;
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
