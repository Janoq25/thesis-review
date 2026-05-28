'use client';

import { useMemo } from 'react';
import { useI18n } from './context';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  AI_PROCESSING: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  AI_COMPLETE: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  HUMAN_REVIEW: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  OBSERVED: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  APPROVED: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const STATUS_KEYS = [
  'PENDING',
  'AI_PROCESSING',
  'AI_COMPLETE',
  'HUMAN_REVIEW',
  'OBSERVED',
  'APPROVED',
  'REJECTED',
] as const;

export function useStatusConfig() {
  const { t } = useI18n();

  return useMemo(() => {
    const config: Record<string, { label: string; className: string }> = {};
    for (const key of STATUS_KEYS) {
      config[key] = {
        label: t(`status.${key}` as 'status.PENDING'),
        className: STATUS_STYLES[key],
      };
    }
    return { config, statuses: ['', ...STATUS_KEYS] as string[] };
  }, [t]);
}
