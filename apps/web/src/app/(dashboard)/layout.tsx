'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Upload, FileSearch, Layers,
  BarChart3, Settings, LogOut, Bell, ChevronDown,
  GraduationCap, Users, BookOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADVISOR','COORDINATOR','ADMIN'] },
  { href: '/advances/upload', label: 'Cargar avance', icon: Upload, roles: ['STUDENT','ADVISOR','COORDINATOR','ADMIN'] },
  { href: '/advances', label: 'Avances', icon: FileSearch, roles: ['ADVISOR','COORDINATOR','ADMIN'] },
  { href: '/student/dashboard', label: 'Mis avances', icon: BookOpen, roles: ['STUDENT'] },
  { href: '/bulk-review', label: 'Revisión por lotes', icon: Layers, roles: ['COORDINATOR','ADMIN'] },
  { href: '/templates', label: 'Documentos Patrón', icon: BookOpen, roles: ['COORDINATOR','ADMIN'] },
  { href: '/stats', label: 'Estadísticas', icon: BarChart3, roles: ['COORDINATOR','ADMIN'] },
  { href: '/users', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
  { href: '/config', label: 'Configuración', icon: Settings, roles: ['COORDINATOR','ADMIN'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

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

  const visibleNav = NAV_ITEMS.filter((item) =>
    !user || item.roles.includes(user.role),
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#185FA5] flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 leading-tight">ThesisReview</div>
              <div className="text-[10px] text-gray-400">v2.0 · IA Académica</div>
            </div>
          </div>
        </div>

        {/* Nav */}
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
                    ? 'bg-[#185FA5]/8 text-[#185FA5] font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <item.icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-[#185FA5]' : 'text-gray-400')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        {user && (
          <div className="px-3 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-blue-800">
                  {user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">{user.name}</div>
                <div className="text-[10px] text-gray-400">{user.role}</div>
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
