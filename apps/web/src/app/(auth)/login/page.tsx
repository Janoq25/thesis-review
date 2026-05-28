'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { AppSettings } from '@/components/settings/AppSettings';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const loginMutation = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiClient.post('/auth/login', creds).then((r) => r.data),
    onSuccess: (data) => {
      sessionStorage.setItem('accessToken', data.accessToken);
      sessionStorage.setItem('refreshToken', data.refreshToken);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;

      const roleRoutes: Record<string, string> = {
        STUDENT: '/student/dashboard',
        ADVISOR: '/dashboard',
        COORDINATOR: '/dashboard',
        ADMIN: '/dashboard',
      };
      router.push(roleRoutes[data.user.role] ?? '/dashboard');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? t('auth.invalidCredentials'));
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 w-56">
        <AppSettings />
      </div>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#185FA5] flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-medium text-lg">T</span>
          </div>
          <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100">{t('auth.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('auth.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 px-3 text-sm
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]"
                onKeyDown={(e) => e.key === 'Enter' && loginMutation.mutate({ email, password })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-600 px-3 pr-10 text-sm
                             text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]"
                  onKeyDown={(e) => e.key === 'Enter' && loginMutation.mutate({ email, password })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => loginMutation.mutate({ email, password })}
              disabled={loginMutation.isPending || !email || !password}
              className="w-full h-10 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] disabled:opacity-50
                         text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('auth.login')}
            </button>
          </div>

          <div className="mt-4 text-center">
            <a href="/forgot-password" className="text-xs text-[#185FA5] dark:text-blue-400 hover:underline">
              {t('auth.forgotPassword')}
            </a>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-100 dark:border-blue-900">
          <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
            {t('auth.demoCredentials')}
          </p>
          <div className="space-y-0.5 text-xs text-blue-700 dark:text-blue-400">
            <div>
              {t('auth.coordinator')}: coordinadora@universidad.edu.pe
            </div>
            <div>{t('auth.advisor')}: jperez@universidad.edu.pe</div>
            <div>{t('auth.student')}: ktorres@estudiante.edu.pe, aquirozr@unitru.edu.pe, lzavaletacar@unitru.edu.pe</div>
            <div>Password: ThesisReview2025!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
