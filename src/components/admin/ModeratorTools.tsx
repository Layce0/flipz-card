import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Timer, Flame, Users, RotateCcw, Plus } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type ActionKey =
  | 'skip_my_daily_timer'
  | 'skip_all_daily_timers'
  | 'increment_my_streak'
  | 'set_my_streak'
  | 'reset_my_streak';

export const ModeratorTools = () => {
  const queryClient = useQueryClient();
  const [loadingKey, setLoadingKey] = useState<ActionKey | null>(null);
  const [streakValue, setStreakValue] = useState<string>('7');

  const run = async (action: ActionKey, extra: Record<string, unknown> = {}) => {
    setLoadingKey(action);
    try {
      const { data, error } = await invokeEdgeFunction('manage-user-account', {
        body: { action, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || 'OK');
      queryClient.invalidateQueries({ queryKey: ['userStreak'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['dailyCardCooldown'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoadingKey(null);
    }
  };

  const Btn = ({ k, icon, label, variant = 'outline' as const, onClick }: any) => (
    <Button variant={variant} className="w-full justify-start" disabled={loadingKey !== null} onClick={onClick}>
      {loadingKey === k ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  return (
    <section>
      <h2 className="font-display text-lg mb-4 text-foreground flex items-center gap-2">
        <Timer className="w-5 h-5 text-primary" />
        Outils modérateur
      </h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Carte quotidienne</Label>
          <Btn
            k="skip_my_daily_timer"
            icon={<Timer className="w-4 h-4" />}
            label="Skip mon timer quotidien"
            onClick={() => run('skip_my_daily_timer')}
          />
          <Btn
            k="skip_all_daily_timers"
            icon={<Users className="w-4 h-4" />}
            label="Skip les timers de TOUS les utilisateurs"
            variant="destructive"
            onClick={() => {
              if (confirm('Reset les timers quotidiens pour tous les utilisateurs ?')) {
                run('skip_all_daily_timers');
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Tester la winstreak</Label>
          <Btn
            k="increment_my_streak"
            icon={<Plus className="w-4 h-4" />}
            label="+1 à ma winstreak"
            onClick={() => run('increment_my_streak')}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              max={1000}
              value={streakValue}
              onChange={(e) => setStreakValue(e.target.value)}
              className="bg-card border-border"
              placeholder="Jour"
            />
            <Button
              variant="outline"
              disabled={loadingKey !== null}
              onClick={() => run('set_my_streak', { streakValue: Number(streakValue) })}
            >
              {loadingKey === 'set_my_streak' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
              Régler
            </Button>
          </div>
          <Btn
            k="reset_my_streak"
            icon={<RotateCcw className="w-4 h-4" />}
            label="Reset ma winstreak à 0"
            onClick={() => run('reset_my_streak')}
          />
        </div>
      </div>
    </section>
  );
};
