/**
 * Config Store - Persistent configuration management
 *
 * Reads/writes app config as JSON to a local file.
 * Framework-agnostic: only depends on Node.js `fs` and `path`.
 * Replace for other runtimes (e.g., SharedPreferences on Android, NSUserDefaults on macOS).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import type { AppConfig, DeviceInfo, Theme } from './types';

export interface IConfigStore {
  load(): Promise<AppConfig>;
  save(config: AppConfig): Promise<void>;
  getConfigPath(): string;
}

const DEFAULT_CONFIG: AppConfig = {
  devices: [],
  activeDeviceId: null,
  adbPath: 'adb',
  theme: 'system',
};

export class JsonConfigStore implements IConfigStore {
  private configPath: string;

  constructor(configDir?: string) {
    const dir = configDir || this.getDefaultConfigDir();
    this.configPath = join(dir, 'adb-manager.json');
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async load(): Promise<AppConfig> {
    try {
      const raw = await readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        devices: Array.isArray(parsed.devices) ? parsed.devices : [],
        theme: parsed.theme || DEFAULT_CONFIG.theme,
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  async save(config: AppConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /** Create a new DeviceInfo with auto-generated id (always network type) */
  static createDevice(address: string, port: number, name?: string): DeviceInfo {
    const id = `${address}:${port}`;
    return {
      id,
      name: name || id,
      address,
      port,
      type: 'network',
    };
  }

  private getDefaultConfigDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '.';
    if (process.platform === 'darwin') {
      return join(home, 'Library', 'Application Support', 'adb-manager');
    }
    if (process.platform === 'win32') {
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'adb-manager');
    }
    return join(home, '.config', 'adb-manager');
  }
}
