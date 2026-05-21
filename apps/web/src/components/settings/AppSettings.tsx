'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';

interface AppSettingsProps {
  compact?: boolean;
}

export function AppSettings({ compact = false }: AppSettingsProps) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn(compact ? 'h-16' : 'h-20')} />;
  }

  return (
    <div
      className={cn(
        'space-y-3',
        compact ? 'px-2 py-2' : 'p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
      )}
    >
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
          <Sun className="w-3 h-3" />
          {t('common.theme')}
        </div>
        <div className="flex gap-1">
          {(['light', 'dark', 'system'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                theme === value
                  ? 'bg-[#185FA5] text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
              title={t(`common.${value}` as 'common.light')}
            >
              {value === 'light' && <Sun className="w-3 h-3" />}
              {value === 'dark' && <Moon className="w-3 h-3" />}
              {value === 'system' && <Monitor className="w-3 h-3" />}
              {!compact && <span>{t(`common.${value}` as 'common.light')}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
          <Languages className="w-3 h-3" />
          {t('common.language')}
        </div>
        <div className="flex gap-1">
          {(['es', 'en'] as Locale[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocale(value)}
              className={cn(
                'flex-1 py-1.5 rounded-md text-[10px] font-medium transition-colors',
                locale === value
                  ? 'bg-[#185FA5] text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              {value === 'es' ? t('common.spanish') : t('common.english')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
