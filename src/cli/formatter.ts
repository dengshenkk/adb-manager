/**
 * CLI 输出格式化工具
 *
 * 提供两种输出模式：
 * - 默认：彩色人类可读表格
 * - --json：JSON 格式，适合管道/脚本
 */

import type { DeviceState, AdbResult, SwitchResult, AppConfig } from '../core/types';

/** 全局选项（由 CLI 入口解析） */
export interface CliGlobalOptions {
  json?: boolean;
}

/**
 * 格式化为表格行
 */
function formatRow(label: string, value: string, _json?: boolean): string {
  if (_json) return '';
  const colorLabel = `\x1b[36m${label}\x1b[0m`;  // cyan
  const colorValue = `\x1b[37m${value}\x1b[0m`;   // white
  return `  ${colorLabel}: ${colorValue}`;
}

/**
 * 状态图标
 */
function statusIcon(status: string): string {
  switch (status) {
    case 'connected':    return '\x1b[32m●\x1b[0m';  // green
    case 'disconnected': return '\x1b[90m○\x1b[0m';  // gray
    case 'error':        return '\x1b[31m●\x1b[0m';  // red
    case 'unknown':      return '\x1b[33m◌\x1b[0m';  // yellow
    default:             return '\x1b[90m?\x1b[0m';   // gray
  }
}

/**
 * 类型标签
 */
function typeTag(type: string): string {
  return type === 'usb'
    ? '\x1b[34mUSB\x1b[0m'
    : '\x1b[35mNET\x1b[0m';
}

function activeTag(isActive: boolean): string {
  return isActive ? '\x1b[33m★ 活跃\x1b[0m' : '';
}

/**
 * 格式化设备列表输出
 */
export function formatDeviceList(
  devices: DeviceState[],
  options: CliGlobalOptions = {},
): string {
  if (options.json) {
    return JSON.stringify(devices, null, 2);
  }

  if (devices.length === 0) {
    return '\x1b[33m没有找到设备。使用 adb-manager add <address> [port] 添加网络设备。\x1b[0m\n';
  }

  const lines: string[] = [];
  lines.push(`\x1b[1m共 ${devices.length} 个设备\x1b[0m\n`);

  for (const device of devices) {
    const icon = statusIcon(device.connectionStatus);
    const tag = typeTag(device.type);
    const active = activeTag(device.isActive);

    // 设备标题行
    const title = `${icon} ${tag} \x1b[1m${device.name}\x1b[0m ${active}`;
    lines.push(`  ${title}`);
    lines.push(`    ID: ${device.id}`);
    if (device.type === 'network') {
      lines.push(`    地址: ${device.address}:${device.port}`);
    }
    lines.push(`    状态: ${device.connectionStatus}`);
    if (device.lastConnected) {
      lines.push(`    上次连接: ${device.lastConnected}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 格式化单个设备详情
 */
export function formatDeviceDetail(
  device: DeviceState | null,
  options: CliGlobalOptions = {},
): string {
  if (options.json) {
    return JSON.stringify(device, null, 2);
  }

  if (!device) {
    return '\x1b[33m没有活跃设备。使用 adb-manager switch <id> 切换设备。\x1b[0m\n';
  }

  const lines: string[] = [];
  const icon = statusIcon(device.connectionStatus);
  const tag = typeTag(device.type);
  const active = activeTag(device.isActive);

  lines.push(`${icon} ${tag} \x1b[1m${device.name}\x1b[0m ${active}`);
  lines.push(`  ID: ${device.id}`);
  if (device.type === 'network') {
    lines.push(`  地址: ${device.address}:${device.port}`);
  }
  lines.push(`  状态: ${device.connectionStatus}`);
  if (device.lastConnected) {
    lines.push(`  上次连接: ${device.lastConnected}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * 格式化操作结果
 */
export function formatResult(
  result: AdbResult | SwitchResult,
  options: CliGlobalOptions = {},
): string {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  const icon = result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  return `${icon} ${result.message}\n`;
}

/**
 * 格式化简单消息
 */
export function formatMessage(
  message: string,
  type: 'info' | 'success' | 'error' | 'warning' = 'info',
  options: CliGlobalOptions = {},
): string {
  if (options.json) {
    return JSON.stringify({ type, message }, null, 2);
  }

  let icon: string;
  switch (type) {
    case 'success': icon = '\x1b[32m✓\x1b[0m'; break;
    case 'error':   icon = '\x1b[31m✗\x1b[0m'; break;
    case 'warning': icon = '\x1b[33m⚠\x1b[0m'; break;
    default:        icon = '\x1b[36mi\x1b[0m'; break;
  }
  return `${icon} ${message}\n`;
}

/**
 * 格式化全局状态概览
 */
export function formatStatus(
  devices: DeviceState[],
  activeDevice: DeviceState | null,
  config: AppConfig,
  options: CliGlobalOptions = {},
): string {
  if (options.json) {
    return JSON.stringify({ devices, activeDevice, config }, null, 2);
  }

  const lines: string[] = [];

  lines.push('\x1b[1mADB Manager - 状态概览\x1b[0m');
  lines.push(formatRow('ADB 路径', config.adbPath));
  lines.push(formatRow('终端应用', config.terminalApp));
  lines.push(formatRow('主题', config.theme));
  lines.push('');

  const connected = devices.filter(d => d.connectionStatus === 'connected').length;
  const total = devices.length;
  lines.push(formatRow('设备总数', `${total}`));
  lines.push(formatRow('已连接', `${connected}`));
  lines.push(formatRow('活跃设备', activeDevice ? activeDevice.name : '无'));
  lines.push('');

  return lines.join('\n');
}
