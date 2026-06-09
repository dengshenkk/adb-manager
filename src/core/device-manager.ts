/**
 * Device Manager - High-level device management logic
 */

import type {
  DeviceInfo,
  DeviceState,
  SwitchResult,
  AdbResult,
  DeviceManagerEvent,
  DeviceManagerEventHandler,
  TerminalApp,
} from './types';
import type { IAdbExecutor } from './adb-executor';
import type { IConfigStore } from './config-store';
import { JsonConfigStore } from './config-store';

export class DeviceManager {
  private devices: DeviceState[] = [];
  private activeDeviceId: string | null = null;
  private listeners: Map<DeviceManagerEvent, Set<DeviceManagerEventHandler>> = new Map();

  constructor(
    private adb: IAdbExecutor,
    private store: IConfigStore,
  ) {}

  async init(): Promise<void> {
    const config = await this.store.load();
    this.adb.setAdbPath(config.adbPath);
    this.activeDeviceId = config.activeDeviceId;

    this.devices = config.devices.map((info) => ({
      ...info,
      type: info.type || 'network',
      connectionStatus: 'unknown',
      isActive: info.id === this.activeDeviceId,
    }));

    await this.refreshStatus();
  }

  getDevices(): DeviceState[] {
    return [...this.devices];
  }

  getActiveDevice(): DeviceState | null {
    return this.devices.find((d) => d.isActive) || null;
  }

  async addDevice(address: string, port: number, name?: string): Promise<DeviceState> {
    const info = JsonConfigStore.createDevice(address, port, name);

    if (this.devices.some((d) => d.id === info.id)) {
      throw new Error(`设备 ${info.id} 已存在`);
    }

    const state: DeviceState = {
      ...info,
      type: 'network',
      connectionStatus: 'disconnected',
      isActive: false,
    };

    this.devices.push(state);
    await this.persist();
    this.emit('devices-changed', this.devices);
    return state;
  }

  async removeDevice(id: string): Promise<void> {
    const device = this.devices.find((d) => d.id === id);
    if (!device) throw new Error(`设备 ${id} 不存在`);
    if (device.type === 'usb') throw new Error('USB 设备不能删除');

    if (this.activeDeviceId === id) {
      await this.deactivate();
    }

    this.devices = this.devices.filter((d) => d.id !== id);
    await this.persist();
    this.emit('devices-changed', this.devices);
  }

  /** Connect a network device without switching to it */
  async connectDevice(id: string): Promise<AdbResult> {
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      return { success: false, message: `设备 ${id} 不存在` };
    }
    if (device.type === 'usb') {
      return { success: false, message: 'USB 设备无需连接' };
    }

    const result = await this.adb.connect(device.address, device.port);
    
    if (result.success) {
      device.connectionStatus = 'connected';
      device.lastConnected = new Date().toISOString();
    } else {
      device.connectionStatus = 'error';
    }

    this.emit('devices-changed', this.devices);
    return result;
  }

  /** Disconnect a specific network device */
  async disconnectDevice(id: string): Promise<AdbResult> {
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      return { success: false, message: `设备 ${id} 不存在` };
    }
    if (device.type === 'usb') {
      return { success: false, message: 'USB 设备请直接拔出' };
    }

    const result = await this.adb.disconnect(device.address, device.port);
    
    if (result.success) {
      device.connectionStatus = 'disconnected';
      if (this.activeDeviceId === id) {
        device.isActive = false;
        this.activeDeviceId = null;
      }
    }

    await this.persist();
    this.emit('devices-changed', this.devices);
    return result;
  }

  async switchTo(id: string): Promise<SwitchResult> {
    const target = this.devices.find((d) => d.id === id);
    if (!target) throw new Error(`设备 ${id} 不存在`);

    const previousId = this.activeDeviceId;
    this.emit('switching', { from: previousId, to: id });

    if (previousId && previousId !== id) {
      const prevDevice = this.devices.find((d) => d.id === previousId);
      if (prevDevice && prevDevice.type === 'network') {
        await this.adb.disconnect(prevDevice.address, prevDevice.port);
      }
      if (prevDevice) {
        prevDevice.isActive = false;
        if (prevDevice.type === 'network') {
          prevDevice.connectionStatus = 'disconnected';
        }
      }
    }

    if (target.type === 'usb') {
      this.activeDeviceId = id;
      target.isActive = true;
      target.connectionStatus = 'connected';
      target.lastConnected = new Date().toISOString();

      await this.persist();
      this.emit('devices-changed', this.devices);

      const switchResult: SwitchResult = {
        success: true,
        message: `已切换到 USB 设备 ${target.name}`,
        previousDeviceId: previousId,
        newDeviceId: id,
      };

      this.emit('switch-complete', switchResult);
      return switchResult;
    }

    const result = await this.adb.connect(target.address, target.port);

    if (result.success) {
      this.activeDeviceId = id;
      target.isActive = true;
      target.connectionStatus = 'connected';
      target.lastConnected = new Date().toISOString();
    } else {
      target.connectionStatus = 'error';
    }

    await this.persist();
    this.emit('devices-changed', this.devices);

    const switchResult: SwitchResult = {
      ...result,
      previousDeviceId: previousId,
      newDeviceId: id,
    };

    this.emit(result.success ? 'switch-complete' : 'switch-error', switchResult);
    return switchResult;
  }

  async deactivate(): Promise<AdbResult> {
    if (!this.activeDeviceId) {
      return { success: true, message: '没有活跃设备' };
    }

    const device = this.devices.find((d) => d.id === this.activeDeviceId);
    const result = device && device.type === 'network'
      ? await this.adb.disconnect(device.address, device.port)
      : { success: true, message: 'USB 设备已取消选择' };

    if (device) {
      device.isActive = false;
      if (device.type === 'network') {
        device.connectionStatus = 'disconnected';
      }
    }
    this.activeDeviceId = null;
    await this.persist();
    this.emit('devices-changed', this.devices);
    return result;
  }

  /** Disconnect all network devices */
  async disconnectAll(): Promise<AdbResult> {
    const result = await this.adb.disconnectAll();

    if (result.success) {
      for (const device of this.devices) {
        if (device.type === 'network') {
          device.connectionStatus = 'disconnected';
          device.isActive = false;
        }
      }
      this.activeDeviceId = null;
      await this.persist();
      this.emit('devices-changed', this.devices);
    }

    return result;
  }

  /** Switch to the active device (reconnect if needed) */
  async switchToActive(): Promise<AdbResult> {
    if (!this.activeDeviceId) {
      return { success: false, message: '没有活跃设备' };
    }

    const device = this.devices.find((d) => d.id === this.activeDeviceId);
    if (!device) {
      return { success: false, message: '活跃设备不存在' };
    }

    if (device.type === 'usb') {
      return { success: true, message: `当前活跃设备: ${device.name} (USB)` };
    }

    if (device.connectionStatus === 'connected') {
      return { success: true, message: `当前活跃设备: ${device.name} (已连接)` };
    }

    const result = await this.adb.connect(device.address, device.port);
    if (result.success) {
      device.connectionStatus = 'connected';
      device.lastConnected = new Date().toISOString();
      this.emit('devices-changed', this.devices);
    }

    return result;
  }

  async launchScrcpy(id: string): Promise<AdbResult> {
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      return { success: false, message: `设备 ${id} 不存在` };
    }
    if (device.connectionStatus !== 'connected') {
      return { success: false, message: '设备未连接，请先连接设备' };
    }
    return this.adb.launchScrcpy(id);
  }

  async launchAdbShell(id: string, terminalApp: TerminalApp): Promise<AdbResult> {
    const device = this.devices.find((d) => d.id === id);
    if (!device) {
      return { success: false, message: `设备 ${id} 不存在` };
    }
    if (device.connectionStatus !== 'connected') {
      return { success: false, message: '设备未连接，请先连接设备' };
    }
    return this.adb.launchAdbShell(id, terminalApp);
  }

  async refreshStatus(): Promise<void> {
    const liveDevices = await this.adb.listDevices();
    const liveMap = new Map(liveDevices.map((d) => [d.serial, d.status]));

    for (const device of this.devices) {
      if (device.type === 'usb') continue;
      const serial = `${device.address}:${device.port}`;
      const liveStatus = liveMap.get(serial);

      if (liveStatus === 'device') {
        device.connectionStatus = 'connected';
      } else if (liveStatus === 'offline' || liveStatus === 'unauthorized') {
        device.connectionStatus = 'error';
      } else {
        device.connectionStatus = 'disconnected';
      }

      device.isActive = device.id === this.activeDeviceId;
    }

    this.devices = this.devices.filter((d) => d.type !== 'usb');

    for (const raw of liveDevices) {
      if (raw.type !== 'usb') continue;
      if (raw.status !== 'device') continue;

      const usbDevice: DeviceState = {
        id: raw.serial,
        name: `USB: ${raw.serial}`,
        address: '',
        port: 0,
        type: 'usb',
        connectionStatus: 'connected',
        isActive: raw.serial === this.activeDeviceId,
      };

      this.devices.push(usbDevice);
    }

    this.emit('status-refreshed', this.devices);
    this.emit('devices-changed', this.devices);
  }

  /** Refresh devices list - reload from config and refresh status */
  async refreshDevices(): Promise<void> {
    const config = await this.store.load();
    this.adb.setAdbPath(config.adbPath);
    
    // Keep USB devices, reload network devices from config
    const usbDevices = this.devices.filter(d => d.type === 'usb');
    
    this.devices = config.devices.map((info) => ({
      ...info,
      type: info.type || 'network',
      connectionStatus: 'unknown' as const,
      isActive: info.id === this.activeDeviceId,
    }));
    
    // Restore USB devices
    this.devices.push(...usbDevices);
    
    await this.refreshStatus();
  }

  on(event: DeviceManagerEvent, handler: DeviceManagerEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit(event: DeviceManagerEvent, ...args: any[]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(...args); } catch { }
    });
  }

  private async persist(): Promise<void> {
    const networkDevices = this.devices
      .filter((d) => d.type === 'network')
      .map(({ id, name, address, port, type }) => ({ id, name, address, port, type }));

    const config = await this.store.load();
    await this.store.save({
      devices: networkDevices,
      activeDeviceId: this.activeDeviceId,
      adbPath: this.adb.getAdbPath(),
      theme: config.theme,
      terminalApp: config.terminalApp,
    });
  }
}
