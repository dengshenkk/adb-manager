/**
 * ADB Executor - Low-level ADB command execution
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import type { AdbResult, AdbDeviceRaw, TerminalApp } from './types';

const execAsync = promisify(exec);

export interface IAdbExecutor {
  connect(address: string, port: number): Promise<AdbResult>;
  disconnect(address: string, port: number): Promise<AdbResult>;
  disconnectAll(): Promise<AdbResult>;
  listDevices(): Promise<AdbDeviceRaw[]>;
  getAdbPath(): string;
  launchScrcpy(deviceId: string): Promise<AdbResult>;
  launchAdbShell(deviceId: string, terminalApp: TerminalApp): Promise<AdbResult>;
  setAdbPath(path: string): void;
}

export class AdbExecutor implements IAdbExecutor {
  private adbPath: string;
  private env: NodeJS.ProcessEnv;

  constructor(adbPath?: string, resourcesPath?: string) {
    // 优先级: 1. 自定义路径 2. 打包路径 3. 系统路径
    this.adbPath = adbPath || this.getBundledAdbPath(resourcesPath) || 'adb';

    // 确保 PATH 包含常见位置
    const extraPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      `${process.env.HOME}/Library/Android/sdk/platform-tools`,
    ];

    // 如果使用打包的 ADB，将其目录加入 PATH
    if (this.adbPath !== 'adb' && existsSync(this.adbPath)) {
      const adbDir = join(this.adbPath, '..');
      extraPaths.unshift(adbDir);
    }

    const currentPath = process.env.PATH || '';
    const newPath = [...extraPaths, currentPath].join(':');
    this.env = { ...process.env, PATH: newPath };
  }

  /**
   * 获取打包在应用内的 ADB 工具路径
   * @param resourcesPath - Electron app.getPath('resources') 或自定义资源路径
   * @returns ADB 可执行文件的完整路径，如果不存在则返回 null
   */
  private getBundledAdbPath(resourcesPath?: string): string | null {
    if (!resourcesPath) {
      return null;
    }

    // 根据平台确定 ADB 可执行文件名
    const platform = process.platform;
    let adbBinary = 'adb';

    if (platform === 'win32') {
      adbBinary = 'adb.exe';
    }

    // 尝试多个可能的路径
    const possiblePaths = [
      join(resourcesPath, 'bin', adbBinary),           // resources/bin/adb
      join(resourcesPath, 'platform-tools', adbBinary), // resources/platform-tools/adb
      join(resourcesPath, 'tools', adbBinary),         // resources/tools/adb
      join(resourcesPath, adbBinary),                  // resources/adb
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`Found bundled ADB at: ${path}`);
        return path;
      }
    }

    console.log(`No bundled ADB found in resources: ${resourcesPath}`);
    return null;
  }

  getAdbPath(): string {
    return this.adbPath;
  }

  setAdbPath(path: string): void {
    this.adbPath = path;
  }

  async connect(address: string, port: number): Promise<AdbResult> {
    const target = `${address}:${port}`;
    try {
      const { stdout, stderr } = await this.exec(`connect ${target}`);
      const output = stdout + stderr;
      const success = output.includes('connected') || output.includes('already connected');
      return {
        success,
        message: success ? `已连接到 ${target}` : `连接失败: ${output.trim()}`,
        raw: output,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `连接出错: ${err.message}`,
        raw: err.stderr || err.stdout || '',
      };
    }
  }

  async disconnect(address: string, port: number): Promise<AdbResult> {
    const target = `${address}:${port}`;
    try {
      const { stdout, stderr } = await this.exec(`disconnect ${target}`);
      const output = stdout + stderr;
      return {
        success: true,
        message: `已断开 ${target}`,
        raw: output,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `断开出错: ${err.message}`,
        raw: err.stderr || err.stdout || '',
      };
    }
  }

  async disconnectAll(): Promise<AdbResult> {
    try {
      const { stdout, stderr } = await this.exec('disconnect');
      return {
        success: true,
        message: '已断开所有连接',
        raw: stdout + stderr,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `断开出错: ${err.message}`,
        raw: err.stderr || err.stdout || '',
      };
    }
  }

  async listDevices(): Promise<AdbDeviceRaw[]> {
    try {
      const { stdout } = await this.exec('devices');
      const lines = stdout.trim().split('\n').slice(1);
      return lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2 && parts[0] !== '') {
            const serial = parts[0];
            const status = parts[1];
            const type = serial.includes(':') ? 'network' : 'usb';
            return { serial, status, type };
          }
          return null;
        })
        .filter((d): d is AdbDeviceRaw => d !== null);
    } catch {
      return [];
    }
  }

  async launchScrcpy(deviceId: string): Promise<AdbResult> {
    try {
      const { stdout, stderr } = await this.exec(`-s ${deviceId} shell echo test`);
      const testOutput = stdout + stderr;
      if (testOutput.includes("error") || testOutput.includes("not found")) {
        return {
          success: false,
          message: `设备 ${deviceId} 不可用`,
          raw: testOutput,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `设备检查失败: ${err.message}`,
        raw: err.stderr || err.stdout || "",
      };
    }

    const scrcpy = spawn('scrcpy', ["-s", deviceId], {
      detached: true,
      stdio: "ignore",
      env: this.env,
    });
    scrcpy.unref();

    return {
      success: true,
      message: `已启动 scrcpy 显示设备 ${deviceId}`,
    };
  }

  async launchAdbShell(deviceId: string, terminalApp: TerminalApp): Promise<AdbResult> {
    const shellCmd = `${this.adbPath} -s ${deviceId} shell`;
    const escapedCmd = shellCmd.replace(/"/g, '\\"');

    try {
      switch (terminalApp) {
        case 'terminal': {
          spawn('osascript', [
            '-e',
            `tell application "Terminal" to activate`,
            '-e',
            `tell application "Terminal" to do script "${escapedCmd}"`,
          ], { detached: true, stdio: 'ignore' }).unref();
          break;
        }
        case 'iterm2': {
          spawn('osascript', [
            '-e',
            'tell application "iTerm"\n' +
            '  activate\n' +
            '  set newWindow to (create window with default profile)\n' +
            `  tell current session of newWindow to write text "${escapedCmd}"\n` +
            'end tell',
          ], { detached: true, stdio: 'ignore' }).unref();
          break;
        }
        case 'ghostty': {
          spawn('open', ['-n', '-a', 'Ghostty', '--args', '-e', 'sh', '-c', `${shellCmd}; exec $SHELL`], {
            detached: true, stdio: 'ignore',
          }).unref();
          break;
        }
        case 'warp': {
          spawn('open', ['-n', '-a', 'Warp', '--args', '-e', 'sh', '-c', `${shellCmd}; exec $SHELL`], {
            detached: true, stdio: 'ignore',
          }).unref();
          break;
        }
        case 'kitty': {
          spawn('open', ['-n', '-a', 'kitty', '--args', 'sh', '-c', `${shellCmd}; exec $SHELL`], {
            detached: true, stdio: 'ignore',
          }).unref();
          break;
        }
        case 'alacritty': {
          spawn('open', ['-n', '-a', 'Alacritty', '--args', '-e', 'sh', '-c', `${shellCmd}; exec $SHELL`], {
            detached: true, stdio: 'ignore',
          }).unref();
          break;
        }
      }

      return {
        success: true,
        message: `已在 ${terminalApp === 'terminal' ? 'Terminal' : terminalApp} 中打开 adb shell`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `打开终端失败: ${err.message}`,
      };
    }
  }

  private async exec(command: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(`${this.adbPath} ${command}`, {
      timeout: 10000,
      env: this.env,
    });
  }
}
