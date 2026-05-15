import { CheckCircle, XCircle, Info } from 'lucide-react';

interface Props {
  type: 'success' | 'error' | 'info';
  message: string;
}

const config = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30', text: 'text-red-700 dark:text-red-300', iconColor: 'text-red-600 dark:text-red-400' },
  info: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30', text: 'text-blue-700 dark:text-blue-300', iconColor: 'text-blue-600 dark:text-blue-400' },
};

export default function Toast({ type, message }: Props) {
  const { icon: Icon, bg, text, iconColor } = config[type];
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border shadow-sm ${bg}`}>
      <Icon size={16} className={iconColor} />
      <span className={`text-sm ${text}`}>{message}</span>
    </div>
  );
}
