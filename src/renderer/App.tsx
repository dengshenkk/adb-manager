import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, Wifi, WifiOff, Sun, Moon, Monitor, RotateCcw, Terminal, ChevronDown, Power, Target } from 'lucide-react';
import DeviceCard from './components/DeviceCard';
import AddDeviceDialog from './components/AddDeviceDialog';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';
import type { DeviceState, SwitchResult, Theme, TerminalApp } from '../core/types';
import { TERMINAL_APP_LABELS } from '../core/types';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger: boolean;
  onConfirm: () => void;
}

export default function App() {
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme>('system');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [terminalApp, setTerminalAppState] = useState<TerminalApp>('terminal');
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: '',
    message: '',
    danger: false,
    onConfirm: () => {},
  });

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const applyTheme = useCallback((theme: Theme) => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    async function initTheme() {
      try {
        const savedTheme = await window.api.getTheme();
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } catch {
        applyTheme('system');
      }
    }
    initTheme();
  }, [applyTheme]);

  useEffect(() => {
    async function initTerminal() {
      try {
        const saved = await window.api.getTerminalApp();
        setTerminalAppState(saved);
      } catch {
        setTerminalAppState('terminal');
      }
    }
    initTerminal();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  const handleThemeChange = useCallback(async (newTheme: Theme) => {
    try {
      await window.api.setTheme(newTheme);
      setThemeState(newTheme);
      applyTheme(newTheme);
      setShowThemeMenu(false);
    } catch (err: any) {
      addToast('error', `设置主题失败: ${err.message}`);
    }
  }, [applyTheme, addToast]);

  const handleTerminalAppChange = useCallback(async (newTerminal: TerminalApp) => {
    try {
      await window.api.setTerminalApp(newTerminal);
      setTerminalAppState(newTerminal);
      setShowTerminalMenu(false);
      addToast('success', `终端已切换为 ${TERMINAL_APP_LABELS[newTerminal]}`);
    } catch (err: any) {
      addToast('error', `设置终端失败: ${err.message}`);
    }
  }, [addToast]);

  const loadDevices = useCallback(async () => {
    try {
      const list = await window.api.listDevices();
      setDevices(list);
    } catch (err: any) {
      addToast('error', `加载设备失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // 窗口获得焦点时重新加载配置
  useEffect(() => {
    const handleFocus = async () => {
      console.log('[Renderer] Window focused, reloading config...');
      try {
        await window.api.reloadConfig();
        await loadDevices();
        console.log('[Renderer] Config reloaded on focus');
      } catch (err) {
        console.error('[Renderer] Failed to reload config on focus:', err);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadDevices]);

  // 监听配置文件变更（来自 CLI 的修改）
  useEffect(() => {
    const unsubscribe = window.api.onConfigChanged(async () => {
      console.log('[Renderer] Config changed externally, reloading...');
      try {
        await window.api.reloadConfig();
        await loadDevices();
      } catch (err) {
        console.error('[Renderer] Failed to reload after config change:', err);
      }
    });
    return unsubscribe;
  }, [loadDevices]);

  // USB 设备排在最前面
  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      if (a.type === 'usb' && b.type !== 'usb') return -1;
      if (a.type !== 'usb' && b.type === 'usb') return 1;
      return 0;
    });
  }, [devices]);

  const handleSwitch = useCallback(async (id: string) => {
    setSwitching(id);
    try {
      const result: SwitchResult = await window.api.switchTo(id);
      addToast(result.success ? 'success' : 'error', result.message);
      await loadDevices();
    } catch (err: any) {
      addToast('error', `切换失败: ${err.message}`);
    } finally {
      setSwitching(null);
    }
  }, [loadDevices, addToast]);

  const handleConnect = useCallback(async (id: string) => {
    setConnecting(id);
    try {
      const result = await window.api.connect(id);
      addToast(result.success ? 'success' : 'error', result.message);
      await loadDevices();
    } catch (err: any) {
      addToast('error', `连接失败: ${err.message}`);
    } finally {
      setConnecting(null);
    }
  }, [loadDevices, addToast]);

  const handleAdd = useCallback(async (address: string, port: number, name: string) => {
    try {
      await window.api.addDevice(address, port, name || undefined);
      addToast('success', `已添加 ${address}:${port}`);
      await loadDevices();
    } catch (err: any) {
      addToast('error', err.message);
    }
  }, [loadDevices, addToast]);

  const handleRemove = useCallback((id: string) => {
    const device = devices.find(d => d.id === id);
    setConfirm({
      open: true,
      title: '删除设备',
      message: `确定要删除设备 "${device?.name || id}" 吗？`,
      danger: true,
      onConfirm: async () => {
        try {
          await window.api.removeDevice(id);
          addToast('info', '设备已删除');
          await loadDevices();
        } catch (err: any) {
          addToast('error', err.message);
        }
        setConfirm(prev => ({ ...prev, open: false }));
      },
    });
  }, [devices, loadDevices, addToast]);

  const handleRefresh = useCallback(async () => {
    try {
      await window.api.refreshStatus();
      await loadDevices();
      addToast('success', '状态已刷新');
    } catch (err: any) {
      addToast('error', err.message);
    }
  }, [loadDevices, addToast]);

  const handleRefreshDevices = useCallback(async () => {
    try {
      await window.api.refreshDevices();
      await loadDevices();
      addToast('success', '设备列表已刷新');
    } catch (err: any) {
      addToast('error', err.message);
    }
  }, [loadDevices, addToast]);

  const handleLaunchScrcpy = useCallback(async (id: string) => {
    try {
      const result = await window.api.launchScrcpy(id);
      if (result.success) {
        addToast('success', result.message);
      } else {
        addToast('error', result.message);
      }
    } catch (err: any) {
      addToast('error', `启动 scrcpy 失败: ${err.message}`);
    }
  }, [addToast]);

  const handleLaunchAdbShell = useCallback(async (id: string) => {
    try {
      const result = await window.api.launchAdbShell(id, terminalApp);
      if (result.success) {
        addToast('success', result.message);
      } else {
        addToast('error', result.message);
      }
    } catch (err: any) {
      addToast('error', `打开 adb shell 失败: ${err.message}`);
    }
  }, [addToast, terminalApp]);

  const handleDisconnect = useCallback((id: string) => {
    const device = devices.find(d => d.id === id);
    setConfirm({
      open: true,
      title: '断开连接',
      message: `确定要断开设备 "${device?.name || id}" 的连接吗？`,
      danger: false,
      onConfirm: async () => {
        try {
          const result = await window.api.disconnect(id);
          addToast(result.success ? 'success' : 'error', result.message);
          await loadDevices();
        } catch (err: any) {
          addToast('error', err.message);
        }
        setConfirm(prev => ({ ...prev, open: false }));
      },
    });
  }, [devices, loadDevices, addToast]);

  const handleDisconnectAll = useCallback(() => {
    setConfirm({
      open: true,
      title: '断开所有连接',
      message: '确定要断开所有设备的连接吗？',
      danger: true,
      onConfirm: async () => {
        try {
          const result = await window.api.disconnectAll();
          addToast(result.success ? 'success' : 'error', result.message);
          await loadDevices();
        } catch (err: any) {
          addToast('error', err.message);
        }
        setConfirm(prev => ({ ...prev, open: false }));
      },
    });
  }, [loadDevices, addToast]);

  const handleSwitchToActive = useCallback(async () => {
    try {
      const result = await window.api.switchToActive();
      addToast(result.success ? 'success' : 'error', result.message);
      await loadDevices();

      // 滚动到活跃设备位置
      if (result.success) {
        setTimeout(() => {
          // 重新查找活跃设备
          const activeDeviceEl = document.querySelector('[data-is-active="true"]');
          if (activeDeviceEl) {
            activeDeviceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 添加高亮效果
            activeDeviceEl.classList.add('ring-2', 'ring-green-500', 'ring-offset-2');
            setTimeout(() => {
              activeDeviceEl.classList.remove('ring-2', 'ring-green-500', 'ring-offset-2');
            }, 2000);
          }
        }, 300);
      }
    } catch (err: any) {
      addToast('error', err.message);
    }
  }, [loadDevices, addToast]);

  const activeDevice = devices.find((d) => d.isActive);
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-light dark:bg-slate-950">
      <div className="drag-region h-8 flex-shrink-0" />

      <header className="px-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-improved flex items-center justify-center">
            <Wifi size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-text-primary-light dark:text-white">ADB Manager</h1>
            <p className="text-xs text-text-secondary-light dark:text-slate-400">
              {activeDevice ? `当前: ${activeDevice.name}` : '未选择设备'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={handleSwitchToActive}
            disabled={!activeDevice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            title="切换到活跃设备"
          >
            <Target size={14} /> 活跃设备
          </button>
          <button
            onClick={handleDisconnectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
            title="断开所有连接"
          >
            <Power size={14} /> 断开所有
          </button>
          <div className="relative">
            <button
              onClick={() => { setShowTerminalMenu(!showTerminalMenu); setShowThemeMenu(false); }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-secondary-light dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
              title="选择终端"
            >
              <Terminal size={16} />
              <ChevronDown size={12} />
            </button>
            {showTerminalMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                {(Object.entries(TERMINAL_APP_LABELS) as [TerminalApp, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleTerminalAppChange(key)}
                    className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${terminalApp === key ? 'text-primary-improved dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowThemeMenu(!showThemeMenu); setShowTerminalMenu(false); }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-secondary-light dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="切换主题"
            >
              <ThemeIcon size={16} />
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg z-50">
                <button onClick={() => handleThemeChange('light')} className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${theme === 'light' ? 'text-primary-improved dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  <Sun size={14} /> 浅色
                </button>
                <button onClick={() => handleThemeChange('dark')} className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${theme === 'dark' ? 'text-primary-improved dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  <Moon size={14} /> 深色
                </button>
                <button onClick={() => handleThemeChange('system')} className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${theme === 'system' ? 'text-primary-improved dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  <Monitor size={14} /> 跟随系统
                </button>
              </div>
            )}
          </div>
          <button onClick={handleRefresh} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-secondary-light dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="刷新状态">
            <RefreshCw size={16} />
          </button>
          <button onClick={handleRefreshDevices} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-secondary-light dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="刷新设备列表">
            <RotateCcw size={16} />
          </button>
          <button onClick={() => setShowAddDialog(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-improved hover:bg-primary-improved-dark text-white text-sm font-medium transition-colors">
            <Plus size={14} /> 添加设备
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">加载中...</div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-3">
            <WifiOff size={40} strokeWidth={1.5} />
            <p className="text-sm">还没有设备连接</p>
            <button onClick={() => setShowAddDialog(true)} className="text-primary-improved dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm underline underline-offset-2">
              添加第一个设备
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {sortedDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                switching={switching === device.id}
                connecting={connecting === device.id}
                onSwitch={handleSwitch}
                onConnect={handleConnect}
                onRemove={handleRemove}
                onLaunchScrcpy={handleLaunchScrcpy}
                onLaunchAdbShell={handleLaunchAdbShell}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </main>

      {showAddDialog && <AddDeviceDialog onAdd={handleAdd} onClose={() => setShowAddDialog(false)} />}
      {confirm.open && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(prev => ({ ...prev, open: false }))}
        />
      )}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map((toast) => <Toast key={toast.id} type={toast.type} message={toast.message} />)}
      </div>
    </div>
  );
}
