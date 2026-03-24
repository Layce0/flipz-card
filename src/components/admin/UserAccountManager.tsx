import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, UserX, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAllProfiles } from '@/hooks/useCards';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export const UserAccountManager = () => {
  const { data: profiles = [], isLoading: profilesLoading } = useAllProfiles();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [confirmAction, setConfirmAction] = useState<'delete' | 'reset' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedProfile = profiles.find(p => p.id === selectedUserId);

  const handleAction = async () => {
    if (!confirmAction || !selectedUserId) return;

    setIsProcessing(true);
    try {
      const { data, error } = await invokeEdgeFunction('manage-user-account', {
        body: { action: confirmAction, targetUserId: selectedUserId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || 'Action effectuée');
      setSelectedUserId('');
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'opération");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section>
      <h2 className="font-display text-lg mb-4 text-foreground flex items-center gap-2">
        <UserX className="w-5 h-5 text-destructive" />
        Gestion des comptes
      </h2>

      <div className="space-y-4">
        <div className="space-y-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="bg-card border-border">
              <SelectValue placeholder="Sélectionner un utilisateur" />
            </SelectTrigger>
            <SelectContent>
              {profilesLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : profiles.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2">Aucun utilisateur</div>
              ) : (
                profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.email || profile.id}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={!selectedUserId}
            onClick={() => setConfirmAction('reset')}
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!selectedUserId}
            onClick={() => setConfirmAction('delete')}
          >
            <UserX className="w-4 h-4" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => !isProcessing && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {confirmAction === 'delete' ? 'Supprimer le compte' : 'Réinitialiser le compte'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'delete'
                ? `Êtes-vous sûr de vouloir supprimer définitivement le compte de ${selectedProfile?.email || 'cet utilisateur'} ? Cette action est irréversible.`
                : `Êtes-vous sûr de vouloir réinitialiser le compte de ${selectedProfile?.email || 'cet utilisateur'} ? Toutes ses cartes, streaks et achats seront supprimés.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleAction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                confirmAction === 'delete' ? 'Supprimer' : 'Réinitialiser'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
