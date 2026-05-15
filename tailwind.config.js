/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    extend: {
      colors: {
        // 改进的浅色主题颜色
        'surface-light': '#f8fafc',
        'surface-card': '#ffffff',
        'surface-card-hover': '#f1f5f9',
        'border-light': '#e2e8f0',

        // 改进的深色主题颜色
        'surface-dark': '#0f172a',
        'surface-card-dark': '#1e293b',
        'surface-card-hover-dark': '#334155',
        'border-dark': '#475569',

        // 改进的文字颜色
        'text-primary-light': '#1e293b',
        'text-secondary-light': '#475569',
        'text-tertiary-light': '#64748b',

        'text-primary-dark': '#f1f5f9',
        'text-secondary-dark': '#cbd5e1',
        'text-tertiary-dark': '#94a3b8',

        // 改进的功能颜色
        'primary-improved': '#2563eb',
        'primary-improved-dark': '#3b82f6',
        'success-improved': '#059669',
        'success-improved-dark': '#10b981',
        'warning-improved': '#d97706',
        'warning-improved-dark': '#f59e0b',
        'danger-improved': '#dc2626',
        'danger-improved-dark': '#ef4444',
        'danger': '#dc2626',
      },
    },
  },
  plugins: [],
};
