/**
 * ADB Manager - Core Types
 *
 * This file defines all shared types for the ADB Manager.
 * Framework-agnostic: no dependency on Electron, React, or any UI framework.
 */

/** Raw connection info persisted to config file */
export interface DeviceInfo {
  id: string;           // Unique identifier: "ip:port" for network, serial for USB
  name: string;         // User-friendly alias
  address: string;      // IP address (empty for USB devices)
  port: number;         // ADB port (0 for USB devices)
  type: 'usb' | 'network';  // Device connection type
  category?: string;    // 分类，空值/缺省 = 未分类
}

/** USB设备连接状态 */
export interface USBConnectionStatus {
  id: string;
  connected: boolean;
  lastConnectionTime?: number;
  error?: string;
}

/** USB连接操作结果 */
export interface USBConnectionResult {
  success: boolean;
  message: string;
  deviceId: string;
  connected: boolean;
}

/** 扩展DeviceState以支持USB状态 */
export interface DeviceState extends DeviceInfo {
  connectionStatus: ConnectionStatus;
  isActive: boolean;
  lastConnected?: string;  // ISO timestamp
  // USB设备特定字段
  usbStatus?: USBConnectionStatus;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

/** Result of an ADB operation */
export interface AdbResult {
  success: boolean;
  message: string;
  raw?: string;          // Raw stdout/stderr from adb
}

/** Result of switching active device */
export interface SwitchResult extends AdbResult {
  previousDeviceId: string | null;
  newDeviceId: string;
}

/** Status reported by `adb devices` */
export interface AdbDeviceRaw {
  serial: string;        // e.g. "192.168.1.100:5555" or "ABC123" for USB
  status: string;        // "device", "offline", "unauthorized"
  type: 'usb' | 'network';  // Determined by whether serial contains ":"
}

/** 未分类的显示标签（category 为空/缺省时归入此类） */
export const UNCATEGORIZED = '未分类';

/** Theme setting */
export type Theme = 'light' | 'dark' | 'system';

/** Terminal app setting
 * macOS terminal emulators for opening adb shell sessions
 */
export type TerminalApp = 'terminal' | 'iterm2' | 'ghostty' | 'warp' | 'kitty' | 'alacritty';

export const TERMINAL_APP_LABELS: Record<TerminalApp, string> = {
  terminal: 'Terminal',
  iterm2: 'iTerm2',
  ghostty: 'Ghostty',
  warp: 'Warp',
  kitty: 'Kitty',
  alacritty: 'Alacritty',
};

/** Persistent app configuration stored on disk */
export interface AppConfig {
  devices: DeviceInfo[];  // Only network devices are persisted
  activeDeviceId: string | null;
  adbPath: string;       // Path to adb binary, defaults to "adb"
  theme: Theme;
  terminalApp: TerminalApp;  // Preferred terminal for adb shell
}

/** Events emitted by DeviceManager */
export type DeviceManagerEvent =
  | 'devices-changed'
  | 'switching'
  | 'switch-complete'
  | 'switch-error'
  | 'status-refreshed'
  | 'error';

export type DeviceManagerEventHandler = (...args: any[]) => void;
