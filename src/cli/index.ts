#!/usr/bin/env node

/**
 * ADB Manager CLI
 *
 * Cross-platform ADB connection manager command-line interface.
 * Reuses the framework-agnostic DeviceManager from src/core/.
 *
 * Usage:
 *   adb-manager [command] [options]
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import { DeviceManager, AdbExecutor, JsonConfigStore, TERMINAL_APP_LABELS } from '../core';
import type { TerminalApp } from '../core/types';
import {
  formatDeviceList,
  formatDeviceDetail,
  formatResult,
  formatMessage,
  formatStatus,
} from './formatter';
import type { CliGlobalOptions } from './formatter';

async function main(): Promise<void> {
  // ── 初始化核心层 ──────────────────────────────────
  const adb = new AdbExecutor();
  const store = new JsonConfigStore();
  const manager = new DeviceManager(adb, store);
  await manager.init();

  // ── 全局选项 ─────────────────────────────────────
  const globalOptions: CliGlobalOptions = {};

  // ── 构建 CLI ─────────────────────────────────────
  const program = new Command();

  program
    .name('adb-manager')
    .description('跨平台 ADB 连接管理器 CLI')
    .version('0.0.1')
    .option('--json', '以 JSON 格式输出（适合脚本管道）', () => { globalOptions.json = true; });

  // ── list: 列出所有设备 ─────────────────────────────
  program
    .command('list')
    .description('交互式浏览设备列表，上下键移动，回车选中后自动连接')
    .action(async () => {
      const devices = manager.getDevices();

      if (!globalOptions.json) {
        // 交互模式：箭头键选择设备
        const choices: inquirer.DistinctChoice[] = devices.map((d) => {
          const icon = d.connectionStatus === 'connected' ? '🟢' :
                       d.connectionStatus === 'error' ? '🔴' :
                       d.connectionStatus === 'disconnected' ? '⚪' : '🟡';
          const typeTag = d.type === 'usb' ? 'USB' : 'NET';
          const active = d.isActive ? ' ★' : '';
          return {
            name: `${icon} [${typeTag}] ${d.name}${active}  (${d.id})  ${d.connectionStatus}`,
            value: d,
            short: d.id,
          };
        });

        choices.unshift(new inquirer.Separator(`共 ${devices.length} 个设备`));
        choices.push(new inquirer.Separator('↑↓ 移动  Enter 选中  Esc 退出'));

        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'device',
          message: '选择一个设备:',
          choices,
          pageSize: 20,
          loop: true,
        }]);

        const selected = answer.device as import('../core/types').DeviceState;

        // 选中后自动连接（如果是未连接的网络设备）
        let deviceId = selected.id;
        if (selected.type === 'network' && selected.connectionStatus !== 'connected') {
          console.log(formatMessage(`正在连接 ${selected.name}...`, 'info', globalOptions));
          const connResult = await manager.connectDevice(selected.id);
          console.log(formatResult(connResult, globalOptions));
          if (!connResult.success) {
            return;
          }
          // 刷新状态
          await manager.refreshStatus();
          const updated = manager.getDevices().find(d => d.id === selected.id);
          if (updated) deviceId = updated.id;
        }

        // 连接成功后显示操作选项
        const config = await store.load();
        const actionAnswer = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: `设备 ${selected.name} 已就绪，选择操作:`,// 设备 ${selected.name} 已就绪
          choices: [
            { name: '1) 使用终端连接 (adb shell)', value: 'shell' },
            { name: '2) 使用 scrcpy 投屏', value: 'scrcpy' },
            { name: '3) 同时使用终端 + scrcpy', value: 'both' },
            { name: '4) 断开连接', value: 'disconnect' },
            { name: '5) 仅查看设备详情', value: 'detail' },
          ],
          pageSize: 10,
          loop: false,
        }]);

        switch (actionAnswer.action) {
          case 'shell': {
            const result = await manager.launchAdbShell(deviceId, config.terminalApp);
            console.log(formatResult(result, globalOptions));
            break;
          }
          case 'scrcpy': {
            const result = await manager.launchScrcpy(deviceId);
            console.log(formatResult(result, globalOptions));
            break;
          }
          case 'both': {
            const shellResult = await manager.launchAdbShell(deviceId, config.terminalApp);
            console.log(formatResult(shellResult, globalOptions));
            const scrcpyResult = await manager.launchScrcpy(deviceId);
            console.log(formatResult(scrcpyResult, globalOptions));
            break;
          }
          case 'disconnect': {
            const result = await manager.disconnectDevice(deviceId);
            console.log(formatResult(result, globalOptions));
            break;
          }
          case 'detail': {
            console.log(formatDeviceDetail(
              manager.getDevices().find(d => d.id === deviceId) || selected,
              globalOptions,
            ));
            break;
          }
        }
        return;
      }

      // 非交互模式：原有输出逻辑
      console.log(formatDeviceList(devices, globalOptions));
    });

  // ── active: 显示当前活跃设备 ─────────────────────────
  program
    .command('active')
    .description('显示当前正在使用的活跃设备')
    .action(async () => {
      const device = manager.getActiveDevice();
      console.log(formatDeviceDetail(device, globalOptions));
    });

  // ── add: 添加网络设备 ──────────────────────────────
  program
    .command('add')
    .description('添加一个网络 ADB 设备')
    .argument('<address>', 'IP 地址')
    .argument('[port]', 'ADB 端口号', '5555')
    .argument('[name]', '设备别名（默认使用 address:port）')
    .action(async (address: string, port: string, name: string | undefined) => {
      try {
        const portNum = parseInt(port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
          console.log(formatMessage('端口号必须为 1-65535 之间的数字', 'error', globalOptions));
          process.exit(1);
        }
        const device = await manager.addDevice(address, portNum, name);
        console.log(formatMessage(`设备已添加: ${device.name} (${device.id})`, 'success', globalOptions));
      } catch (err: any) {
        console.log(formatMessage(err.message, 'error', globalOptions));
        process.exit(1);
      }
    });

  // ── remove: 删除设备 ──────────────────────────────
  program
    .command('remove')
    .description('删除一个网络设备（使用设备 ID）')
    .argument('<id>', '设备 ID（如 192.168.1.100:5555）')
    .action(async (id: string) => {
      try {
        await manager.removeDevice(id);
        console.log(formatMessage(`设备已删除: ${id}`, 'success', globalOptions));
      } catch (err: any) {
        console.log(formatMessage(err.message, 'error', globalOptions));
        process.exit(1);
      }
    });

  // ── connect: 连接设备 ─────────────────────────────
  program
    .command('connect')
    .description('连接已添加的网络设备')
    .argument('<id>', '设备 ID')
    .action(async (id: string) => {
      const result = await manager.connectDevice(id);
      console.log(formatResult(result, globalOptions));
      if (!result.success) process.exit(1);
    });

  // ── disconnect: 断开设备 ──────────────────────────
  program
    .command('disconnect')
    .description('断开已连接的网络设备')
    .argument('<id>', '设备 ID')
    .action(async (id: string) => {
      const result = await manager.disconnectDevice(id);
      console.log(formatResult(result, globalOptions));
      if (!result.success) process.exit(1);
    });

  // ── disconnect-all: 断开所有网络设备 ──────────────────
  program
    .command('disconnect-all')
    .description('断开所有已连接的网络设备')
    .action(async () => {
      const result = await manager.disconnectAll();
      console.log(formatResult(result, globalOptions));
      if (!result.success) process.exit(1);
    });

  // ── switch: 切换到指定设备 ──────────────────────────
  program
    .command('switch')
    .description('切换到指定设备（自动断开当前设备，连接新设备）')
    .argument('<id>', '目标设备 ID')
    .action(async (id: string) => {
      try {
        const result = await manager.switchTo(id);
        console.log(formatResult(result, globalOptions));
      } catch (err: any) {
        console.log(formatMessage(err.message, 'error', globalOptions));
        process.exit(1);
      }
    });

  // ── deactivate: 取消激活 ──────────────────────────
  program
    .command('deactivate')
    .description('取消当前活跃设备（不删除，仅取消选择）')
    .action(async () => {
      const result = await manager.deactivate();
      console.log(formatResult(result, globalOptions));
    });

  // ── switch-to: 重新激活当前活跃设备 ─────────────────────
  program
    .command('switch-to-active')
    .description('重新连接当前活跃设备（如果已掉线）')
    .action(async () => {
      const result = await manager.switchToActive();
      console.log(formatResult(result, globalOptions));
    });

  // ── scrcpy: 启动 Scrcpy ───────────────────────────
  program
    .command('scrcpy')
    .description('启动 scrcpy 屏幕镜像（可指定设备，默认使用当前活跃设备）')
    .argument('[id]', '设备 ID（默认当前活跃设备）')
    .action(async (id?: string) => {
      const targetId = id || manager.getActiveDevice()?.id;
      if (!targetId) {
        console.log(formatMessage('没有活跃设备。请指定设备 ID 或先切换到某设备。', 'error', globalOptions));
        process.exit(1);
      }
      const result = await manager.launchScrcpy(targetId);
      console.log(formatResult(result, globalOptions));
      if (!result.success) process.exit(1);
    });

  // ── shell: 打开 adb shell ─────────────────────────
  program
    .command('shell')
    .description('在终端中打开 adb shell（可指定设备，默认使用当前活跃设备）')
    .argument('[id]', '设备 ID（默认当前活跃设备）')
    .option('-t, --terminal <app>', `终端应用: ${Object.keys(TERMINAL_APP_LABELS).join(', ')}`)
    .action(async (id?: string, opts?: { terminal?: string }) => {
      const targetId = id || manager.getActiveDevice()?.id;
      if (!targetId) {
        console.log(formatMessage('没有活跃设备。请指定设备 ID 或先切换到某设备。', 'error', globalOptions));
        process.exit(1);
      }

      const config = await store.load();
      let terminalApp: TerminalApp = config.terminalApp;
      if (opts?.terminal) {
        if (!(opts.terminal in TERMINAL_APP_LABELS)) {
          console.log(formatMessage(
            `不支持的终端: ${opts.terminal}。可选: ${Object.keys(TERMINAL_APP_LABELS).join(', ')}`,
            'error', globalOptions,
          ));
          process.exit(1);
        }
        terminalApp = opts.terminal as TerminalApp;
      }

      const result = await manager.launchAdbShell(targetId, terminalApp);
      console.log(formatResult(result, globalOptions));
      if (!result.success) process.exit(1);
    });

  // ── refresh: 刷新设备状态 ──────────────────────────
  program
    .command('refresh')
    .description('刷新设备连接状态（重新运行 adb devices）')
    .action(async () => {
      await manager.refreshStatus();
      console.log(formatMessage('设备状态已刷新', 'success', globalOptions));
    });

  // ── status: 查看全局概览 ───────────────────────────
  program
    .command('status')
    .description('查看 ADB Manager 全局状态概览')
    .action(async () => {
      const devices = manager.getDevices();
      const activeDevice = manager.getActiveDevice();
      const config = await store.load();
      console.log(formatStatus(devices, activeDevice, config, globalOptions));
    });

  // ── 解析命令行参数 ─────────────────────────────────
  // 如果没有任何子命令，显示帮助
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('\x1b[31m✗ 意外错误:\x1b[0m', err.message);
  process.exit(1);
});
