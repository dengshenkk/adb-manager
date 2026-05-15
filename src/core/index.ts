/**
 * ADB Manager - Core Module
 *
 * Framework-agnostic business logic layer.
 * This is the ONLY public entry point for consumers.
 *
 * Usage:
 *   import { DeviceManager, AdbExecutor, JsonConfigStore } from '@core';
 *   const manager = new DeviceManager(new AdbExecutor(), new JsonConfigStore());
 *   await manager.init();
 */

export { DeviceManager } from './device-manager';
export { AdbExecutor } from './adb-executor';
export type { IAdbExecutor } from './adb-executor';
export { JsonConfigStore } from './config-store';
export type { IConfigStore } from './config-store';
export type {
  DeviceInfo,
  DeviceState,
  ConnectionStatus,
  AdbResult,
  SwitchResult,
  AdbDeviceRaw,
  AppConfig,
  DeviceManagerEvent,
  DeviceManagerEventHandler,
} from './types';
