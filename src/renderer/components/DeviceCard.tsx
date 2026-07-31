import { Wifi, WifiOff, Trash2, Loader2, Usb, Monitor, Unplug, Link, Terminal, Pencil } from 'lucide-react';
import type { DeviceState } from '../../core/types';

interface Props {
  device: DeviceState;
  switching: boolean;
  connecting?: boolean;
  onSwitch: (id: string) => void;
  onConnect?: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
  onLaunchScrcpy?: (id: string) => void;
  onLaunchAdbShell?: (id: string) => void;
  onDisconnect?: (id: string) => void;
}

const statusConfig = {
  connected: {
    color: 'text-success-improved dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-400/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    label: '已连接',
  },
  disconnected: {
    color: 'text-text-tertiary-light dark:text-slate-500',
    bg: 'bg-surface-card-hover dark:bg-slate-800',
    border: 'border-border-light dark:border-slate-700',
    label: '未连接',
  },
  error: {
    color: 'text-danger dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-400/10',
    border: 'border-red-200 dark:border-red-500/30',
    label: '异常',
  },
  unknown: {
    color: 'text-text-tertiary-light dark:text-slate-500',
    bg: 'bg-surface-card-hover dark:bg-slate-800',
    border: 'border-border-light dark:border-slate-700',
    label: '未知',
  },
};

export default function DeviceCard({
  device,
  switching,
  connecting,
  onSwitch,
  onConnect,
  onRemove,
  onEdit,
  onLaunchScrcpy,
  onLaunchAdbShell,
  onDisconnect,
}: Props) {
  const status = statusConfig[device.connectionStatus];
  const isActive = device.isActive;
  const isUsb = device.type === 'usb';
  const isConnected = device.connectionStatus === 'connected';
  const isClickable = !isActive && !switching && !connecting;

  const cardStyle = isActive
    ? 'border-primary-improved/50 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/5 shadow-sm dark:shadow-lg dark:shadow-blue-500/5'
    : isUsb
      ? 'border-warning-improved/40 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 hover:border-warning-improved dark:hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-500/10'
      : `${status.border} bg-surface-card dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-surface-card-hover dark:hover:bg-slate-800/50`;

  const typeIconColor = isUsb ? 'text-warning-improved dark:text-amber-400' : status.color;
  const typeBgColor = isUsb ? 'bg-amber-100 dark:bg-amber-500/15' : status.bg;

  return (
    <div
      data-is-active={isActive.toString()}
      onClick={() => isClickable && onSwitch(device.id)}
      className={`
        group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200
        ${cardStyle}
        ${isClickable ? 'cursor-pointer' : ''}
      `}
    >
      {/* Type indicator */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${typeBgColor} flex items-center justify-center`}>
        {switching || connecting ? (
          <Loader2 size={20} className="text-primary-improved dark:text-blue-400 animate-spin" />
        ) : isUsb ? (
          <Usb size={20} className={typeIconColor} />
        ) : isConnected ? (
          <Wifi size={20} className={typeIconColor} />
        ) : (
          <WifiOff size={20} className={typeIconColor} />
        )}
      </div>

      {/* Device info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate text-text-primary-light dark:text-slate-100">
            {device.name}
          </span>
          {isActive && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-improved/10 text-primary-improved dark:bg-blue-500/20 dark:text-blue-300">
              当前
            </span>
          )}
          {isUsb && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning-improved/10 text-warning-improved dark:bg-amber-500/20 dark:text-amber-300">
              USB
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary-light dark:text-slate-400 mt-0.5 font-mono">
          {isUsb ? device.id : `${device.address}:${device.port}`}
        </p>
      </div>

      {/* Status label */}
      <span className={`text-xs flex-shrink-0 font-medium ${isUsb ? 'text-warning-improved dark:text-amber-400' : status.color}`}>
        {switching ? '切换中...' : connecting ? '连接中...' : isUsb ? 'USB' : status.label}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Connect button (disconnected network devices) */}
        {!isUsb && !isConnected && onConnect && (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect(device.id); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary-improved/10 dark:hover:bg-blue-500/10 text-text-tertiary-light dark:text-slate-500 hover:text-primary-improved dark:hover:text-blue-400 transition-all"
            title="连接设备"
          >
            <Link size={14} />
          </button>
        )}

        {/* Scrcpy button (connected devices) */}
        {isConnected && onLaunchScrcpy && (
          <button
            onClick={(e) => { e.stopPropagation(); onLaunchScrcpy(device.id); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-success-improved/10 dark:hover:bg-emerald-500/10 text-text-tertiary-light dark:text-slate-500 hover:text-success-improved dark:hover:text-emerald-400 transition-all"
            title="显示设备屏幕 (scrcpy)"
          >
            <Monitor size={14} />
          </button>
        )}

        {/* ADB Shell button (connected devices) */}
        {isConnected && onLaunchAdbShell && (
          <button
            onClick={(e) => { e.stopPropagation(); onLaunchAdbShell(device.id); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary-improved/10 dark:hover:bg-blue-500/10 text-text-tertiary-light dark:text-slate-500 hover:text-primary-improved dark:hover:text-blue-400 transition-all"
            title="打开 ADB Shell 终端"
          >
            <Terminal size={14} />
          </button>
        )}

        {/* Disconnect button (connected devices) */}
        {isConnected && onDisconnect && (
          <button
            onClick={(e) => { e.stopPropagation(); onDisconnect(device.id); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-warning-improved/10 dark:hover:bg-orange-500/10 text-text-tertiary-light dark:text-slate-500 hover:text-warning-improved dark:hover:text-orange-400 transition-all"
            title="断开连接"
          >
            <Unplug size={14} />
          </button>
        )}

        {/* Edit button (network devices only) */}
        {!isUsb && onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(device.id); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary-improved/10 dark:hover:bg-blue-500/10 text-text-tertiary-light dark:text-slate-500 hover:text-primary-improved dark:hover:text-blue-400 transition-all"
            title="编辑设备"
          >
            <Pencil size={14} />
          </button>
        )}

        {/* Remove button (network devices only) */}
        {!isUsb && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(device.id); }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger/10 dark:hover:bg-red-500/10 text-text-tertiary-light dark:text-slate-500 hover:text-danger dark:hover:text-red-400 transition-all"
            title="删除设备"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
