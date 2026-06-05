'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { AppSettings } from '@/components/settings/AppSettings';
import {
  LayoutDashboard, Upload, FileSearch, Layers,
  BarChart3, Settings, LogOut,
  GraduationCap, Users, BookOpen, Menu, X, User,
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const NAV_ITEMS = useMemo(
    () => [
      { href: '/dashboard', labelKey: 'nav.dashboard' as const, icon: LayoutDashboard, roles: ['ADVISOR', 'COORDINATOR', 'ADMIN'] },
      { href: '/advisor/assignments', labelKey: 'nav.assignments' as const, icon: Layers, roles: ['ADVISOR'] },
      { href: '/advances/upload', labelKey: 'nav.uploadAdvance' as const, icon: Upload, roles: ['STUDENT', 'COORDINATOR', 'ADMIN'] },
      { href: '/advances', labelKey: 'nav.advances' as const, icon: FileSearch, roles: ['COORDINATOR', 'ADMIN'] },
      { href: '/student/dashboard', labelKey: 'nav.myAdvances' as const, icon: BookOpen, roles: ['STUDENT'] },
      { href: '/bulk-review', labelKey: 'nav.bulkReview' as const, icon: Layers, roles: ['COORDINATOR', 'ADMIN'] },
      { href: '/templates', labelKey: 'nav.templates' as const, icon: BookOpen, roles: ['COORDINATOR', 'ADMIN'] },
      { href: '/stats', labelKey: 'nav.stats' as const, icon: BarChart3, roles: ['COORDINATOR', 'ADMIN'] },
      { href: '/users', labelKey: 'nav.users' as const, icon: Users, roles: ['ADMIN'] },
      { href: '/config', labelKey: 'nav.config' as const, icon: Settings, roles: ['COORDINATOR', 'ADMIN'] },
      { href: '/profile', labelKey: 'nav.profile' as const, icon: User, roles: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] },
    ],
    [],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem('user');
    if (!stored) {
      router.replace('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const refreshToken = sessionStorage.getItem('refreshToken');
    try {
      const { apiClient } = await import('@/lib/api-client');
      await apiClient.post('/auth/logout', { refreshToken });
    } finally {
      sessionStorage.clear();
      router.replace('/login');
    }
  };

  const visibleNav = NAV_ITEMS.filter((item) => !user || item.roles.includes(user.role));

  const SidebarContent = () => (
    <>
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#185FA5] flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">
              {t('auth.title')}
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('nav.tagline')}</div>
          </div>
          {/* Close button on mobile */}
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-[#185FA5]/10 text-[#185FA5] dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
              )}
            >
              <item.icon
                className={cn(
                  'w-4 h-4 flex-shrink-0',
                  active ? 'text-[#185FA5] dark:text-blue-400' : 'text-gray-400 dark:text-gray-500',
                )}
              />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-2">
        <AppSettings compact />
      </div>

      {user && (
        <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                {user.name}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                {t(`roles.${user.role}` as 'roles.STUDENT')}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={t('common.logout')}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: static, mobile: slide-in drawer) ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[240px] flex-shrink-0 bg-white dark:bg-gray-900',
          'border-r border-gray-100 dark:border-gray-800 flex flex-col',
          'transition-transform duration-200 ease-in-out',
          'lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#185FA5] flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t('auth.title')}
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">{children}</main>
      </div>
    </div>
  );
}
