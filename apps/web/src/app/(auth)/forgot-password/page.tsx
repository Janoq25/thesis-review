'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: (email: string) =>
      apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),
    onSuccess: () => setSent(true),
    onError: () => toast.error('Error al enviar el correo'),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-base font-medium text-gray-900 mb-2">Correo enviado</h2>
              <p className="text-sm text-gray-500">
                Si el email existe, recibirás un enlace para restablecer tu contraseña.
              </p>
              <Link href="/login" className="block mt-4 text-sm text-[#185FA5] hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <Link href="/login" className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <h2 className="text-base font-medium text-gray-900">Recuperar contraseña</h2>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Ingresa tu correo institucional y te enviaremos un enlace de recuperación.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@universidad.edu.pe"
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm mb-4"
              />
              <button
                onClick={() => mutation.mutate(email)}
                disabled={mutation.isPending || !email}
                className="w-full h-10 rounded-lg bg-[#185FA5] text-white text-sm font-medium disabled:opacity-50"
              >
                {mutation.isPending ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
