import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

const StreakRestored = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const [restored, setRestored] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = params.get('session_id');
    if (!sessionId) {
      setStatus('error');
      setMessage('Session invalide');
      return;
    }
    (async () => {
      try {
        const { data, error } = await invokeEdgeFunction('verify-streak-restore', {
          body: { session_id: sessionId },
        });
        if (error || data?.error) {
          throw new Error(data?.error || 'Vérification impossible');
        }
        setRestored(data.restored_streak ?? null);
        setStatus('success');
        queryClient.invalidateQueries({ queryKey: ['user-streak'] });
      } catch (e: unknown) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Erreur');
      }
    })();
  }, [params, queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center bg-card/80 border border-border/50 rounded-2xl p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-foreground/80">Vérification du paiement…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-xl font-display font-semibold mb-2">Série restaurée</h1>
            {restored !== null && (
              <p className="text-muted-foreground text-sm mb-6">
                Ta série de {restored} jour{restored > 1 ? 's' : ''} est de retour.
              </p>
            )}
            <Button onClick={() => navigate('/')} className="w-full">
              Retour
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-display font-semibold mb-2">Échec</h1>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Button onClick={() => navigate('/')} className="w-full" variant="secondary">
              Retour
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default StreakRestored;
