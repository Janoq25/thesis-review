'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, RefreshCw, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface OrcidProfileCardProps {
  userId: string;
}

export function OrcidProfileCard({ userId }: OrcidProfileCardProps) {
  const { data: profile, refetch } = useQuery({
    queryKey: ['orcid-profile', userId],
    queryFn: () =>
      apiClient.get(`/orcid/profile/${userId}`).then((r) => r.data),
    retry: false,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post(`/orcid/sync/${userId}`),
    onSuccess: () => {
      toast.success('Publicaciones sincronizadas desde ORCID');
      refetch();
    },
  });

  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-green-800 font-bold text-sm">iD</span>
        </div>
        <p className="text-sm font-medium text-gray-900 mb-1">Vincular perfil ORCID</p>
        <p className="text-xs text-gray-500 mb-4">
          Conecte su ORCID para auto-poblar sus publicaciones y verificar compatibilidad con tesis.
        </p>
        <Button
          size="sm"
          onClick={() => {
            window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/orcid/connect`;
          }}
          className="bg-[#A6CE39] hover:bg-[#7EA82D] text-white border-0"
        >
          Conectar con ORCID
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#A6CE39] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">iD</span>
            </div>
            <span className="text-xs font-mono text-gray-600">{profile.orcidId}</span>
            <Badge className="bg-green-50 text-green-800 border-green-200 text-[10px]">
              Verificado
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
              
                href={`https://orcid.org/${profile.orcidId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Ver perfil
              </a>
            </Button>
          </div>
        </div>

        {/* Keywords */}
        {profile.keywords?.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] text-gray-500 mb-1.5">Áreas de expertise</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.keywords.map((kw: string) => (
                <span
                  key={kw}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Publicaciones */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900">
            Publicaciones ({profile.publications?.length ?? 0})
          </p>
          <p className="text-xs text-gray-400">
            Última sincronización:{' '}
            {profile.lastSyncedAt
              ? new Date(profile.lastSyncedAt).toLocaleDateString('es-PE')
              : 'Nunca'}
          </p>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {(profile.publications ?? []).map((pub: any) => (
            <div key={pub.id} className="flex gap-3">
              <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <BookOpen className="h-3.5 w-3.5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 leading-snug">{pub.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {pub.journal ?? pub.workType} · {pub.year}
                </p>
                {pub.doi && (
                  
                    href={`https://doi.org/${pub.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    DOI: {pub.doi}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
