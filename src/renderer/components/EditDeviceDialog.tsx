import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { UNCATEGORIZED } from '../../core/types';
import type { DeviceState } from '../../core/types';

interface Props {
  device: DeviceState;
  existingCategories: string[];
  onSave: (address: string, port: number, name: string, category: string) => Promise<void>;
  onClose: () => void;
}

/** 输入框清除按钮：有值时显示在右侧，点击清空内容 */
function ClearInputButton({ show, onClear, className }: { show: boolean; onClear: () => void; className?: string }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      className={`absolute top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${className || ''}`}
      title="清除"
    >
      <X size={14} />
    </button>
  );
}

const inputClass =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

export default function EditDeviceDialog({ device, existingCategories, onSave, onClose }: Props) {
  const [address, setAddress] = useState(device.address);
  const [port, setPort] = useState(String(device.port));
  const [name, setName] = useState(device.name || '');
  const [category, setCategory] = useState(device.category || '');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // 已有分类下拉选项：排除「未分类」；仅在用户输入时按内容过滤，否则展示全部
  const categoryOptions = existingCategories.filter((c) => {
    if (c === UNCATEGORIZED) return false;
    if (!isFiltering) return true;
    return c.toLowerCase().includes(category.trim().toLowerCase());
  });

  const selectCategory = (value: string) => {
    setCategory(value);
    setCategoryOpen(false);
    setIsFiltering(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!address.trim()) { setError('请输入 IP 地址'); return; }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) { setError('端口范围: 1-65535'); return; }

    setSubmitting(true);
    try {
      await onSave(address.trim(), portNum, name.trim(), category.trim());
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">编辑设备</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">IP 地址 *</label>
            <div className="relative">
              <input ref={inputRef} type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="192.168.1.100" className={`${inputClass} pr-8`} />
              <ClearInputButton show={!!address} onClear={() => setAddress('')} className="right-2.5" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">端口 *</label>
            <div className="relative">
              <input type="text" value={port} onChange={(e) => setPort(e.target.value)} placeholder="5555" className={`${inputClass} pr-8`} />
              <ClearInputButton show={!!port} onClear={() => setPort('5555')} className="right-2.5" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">别名（可选）</label>
            <div className="relative">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：测试手机 A" className={`${inputClass} pr-8`} />
              <ClearInputButton show={!!name} onClear={() => setName('')} className="right-2.5" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">分类（可选）</label>
            <div className="relative">
              <input
                type="text"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setIsFiltering(true); setCategoryOpen(true); }}
                onFocus={() => setCategoryOpen(true)}
                onClick={() => setCategoryOpen(true)}
                onBlur={() => setTimeout(() => setCategoryOpen(false), 150)}
                placeholder={`默认：${UNCATEGORIZED}`}
                className={`${inputClass} pr-12`}
              />
              <ClearInputButton show={!!category} onClear={() => { setCategory(''); setIsFiltering(false); }} className="right-8" />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              {categoryOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectCategory(UNCATEGORIZED); }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <span>{UNCATEGORIZED}</span>
                    {(!category || category === UNCATEGORIZED) && <Check size={14} className="text-primary-improved dark:text-blue-400" />}
                  </button>
                  {categoryOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectCategory(c); }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      <span>{c}</span>
                      {category === c && <Check size={14} className="text-primary-improved dark:text-blue-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">取消</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors">
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
