import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePackProbabilities,
  useUpdatePackProbability,
  PACK_TYPES,
  LUCK_MULTIPLIERS,
  PackProbabilityRow,
} from '@/hooks/usePackProbabilities';
import { RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';

const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;

export const PackProbabilitiesManager = () => {
  const { data: rows = [], isLoading } = usePackProbabilities();
  const updateProb = useUpdatePackProbability();
  const [activePackType, setActivePackType] = useState('standard');
  const [editedRows, setEditedRows] = useState<
    Record<string, { common_rate: number; rare_rate: number; epic_rate: number; legendary_rate: number }>
  >({});

  // Group rows by pack_type
  const grouped = useMemo(() => {
    const map: Record<string, PackProbabilityRow[]> = {};
    rows.forEach((r) => {
      if (!map[r.pack_type]) map[r.pack_type] = [];
      map[r.pack_type].push(r);
    });
    // Sort each group by luck_multiplier
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.luck_multiplier - b.luck_multiplier));
    return map;
  }, [rows]);

  const activeRows = grouped[activePackType] || [];

  const getEditedValue = (row: PackProbabilityRow, field: keyof typeof editedRows[string]) => {
    return editedRows[row.id]?.[field] ?? row[field];
  };

  const setField = (rowId: string, row: PackProbabilityRow, field: string, value: number) => {
    setEditedRows((prev) => ({
      ...prev,
      [rowId]: {
        common_rate: prev[rowId]?.common_rate ?? row.common_rate,
        rare_rate: prev[rowId]?.rare_rate ?? row.rare_rate,
        epic_rate: prev[rowId]?.epic_rate ?? row.epic_rate,
        legendary_rate: prev[rowId]?.legendary_rate ?? row.legendary_rate,
        [field]: value,
      },
    }));
  };

  const handleSave = async (row: PackProbabilityRow) => {
    const edited = editedRows[row.id];
    if (!edited) return;

    const total = edited.common_rate + edited.rare_rate + edited.epic_rate + edited.legendary_rate;
    if (Math.abs(total - 100) > 0.5) {
      toast.error(`Le total doit être 100% (actuellement ${total.toFixed(1)}%)`);
      return;
    }

    try {
      await updateProb.mutateAsync({ id: row.id, ...edited });
      setEditedRows((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      toast.success('Probabilités mises à jour !');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (isLoading) {
    return (
      <section>
        <h2 className="font-display text-lg mb-4 text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Probabilités des packs
        </h2>
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-display text-lg mb-4 text-foreground flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        Probabilités des packs
      </h2>

      {/* Pack type tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {PACK_TYPES.map((pt) => (
          <Button
            key={pt.value}
            variant={activePackType === pt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePackType(pt.value)}
            className="whitespace-nowrap"
          >
            {pt.label}
          </Button>
        ))}
      </div>

      {/* Probability table */}
      <div className="space-y-3">
        {activeRows.map((row) => {
          const hasEdits = !!editedRows[row.id];
          const total = RARITIES.reduce(
            (sum, r) => sum + (getEditedValue(row, `${r}_rate` as any) as number),
            0
          );
          const totalOk = Math.abs(total - 100) <= 0.5;

          return (
            <div
              key={row.id}
              className="p-4 rounded-xl bg-card border border-border space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Boost ×{row.luck_multiplier}
                </span>
                <span
                  className={cn(
                    'text-xs font-mono',
                    totalOk ? 'text-muted-foreground' : 'text-destructive font-bold'
                  )}
                >
                  Total: {total.toFixed(1)}%
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {RARITIES.map((rarity) => {
                  const config = RARITY_CONFIG[rarity];
                  const field = `${rarity}_rate` as keyof PackProbabilityRow;
                  const value = getEditedValue(row, field as any) as number;

                  return (
                    <div key={rarity} className="space-y-1">
                      <Label
                        className="text-[10px] uppercase font-bold"
                        style={{ color: config.color }}
                      >
                        {config.label}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.05"
                          min={0}
                          max={100}
                          value={value}
                          onChange={(e) =>
                            setField(row.id, row, field as string, parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-xs bg-background px-2"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasEdits && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSave(row)}
                  disabled={updateProb.isPending || !totalOk}
                >
                  {updateProb.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Sauvegarder
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}

        {activeRows.length === 0 && (
          <p className="text-muted-foreground text-center py-4">
            Aucune configuration pour ce type de pack
          </p>
        )}
      </div>
    </section>
  );
};
