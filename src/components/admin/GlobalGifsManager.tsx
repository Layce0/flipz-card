import { useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useGlobalGifs, useCreateGif, useUpdateGif, useDeleteGif, useUploadGif, GlobalGif } from '@/hooks/useGlobalGifs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, Upload, Image, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PAGES = [
  { value: '/', label: 'Accueil' },
  { value: '/collection', label: 'Collection' },
  { value: '/packs', label: 'Packs' },
  { value: '/shop', label: 'Boutique' },
  { value: '/profile', label: 'Profil' },
];

export const GlobalGifsManager = () => {
  const { data: gifs = [], isLoading } = useGlobalGifs(true);
  const createGif = useCreateGif();
  const updateGif = useUpdateGif();
  const deleteGif = useDeleteGif();
  const uploadGif = useUploadGif();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedPage, setSelectedPage] = useState('/');

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'image/gif');
    if (files.length === 0) {
      toast.error('Seuls les fichiers GIF sont acceptés');
      return;
    }
    for (const file of files) {
      try {
        const url = await uploadGif.mutateAsync(file);
        await createGif.mutateAsync({ url, page: selectedPage });
        toast.success('GIF ajouté !');
      } catch {
        toast.error("Erreur lors de l'upload");
      }
    }
  }, [uploadGif, createGif, selectedPage]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type === 'image/gif');
    if (files.length === 0) {
      toast.error('Seuls les fichiers GIF sont acceptés');
      return;
    }
    for (const file of files) {
      try {
        const url = await uploadGif.mutateAsync(file);
        await createGif.mutateAsync({ url, page: selectedPage });
        toast.success('GIF ajouté !');
      } catch {
        toast.error("Erreur lors de l'upload");
      }
    }
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce GIF ?')) return;
    try {
      await deleteGif.mutateAsync(id);
      toast.success('GIF supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleVisibility = async (gif: GlobalGif) => {
    try {
      await updateGif.mutateAsync({ id: gif.id, visible: !gif.visible });
    } catch {
      toast.error('Erreur');
    }
  };

  const handlePageChange = async (gif: GlobalGif, page: string) => {
    try {
      await updateGif.mutateAsync({ id: gif.id, page });
    } catch {
      toast.error('Erreur');
    }
  };

  const getPageLabel = (path: string) => PAGES.find(p => p.value === path)?.label ?? path;

  return (
    <section>
      <h2 className="font-display text-lg mb-4 text-foreground flex items-center gap-2">
        <Image className="w-5 h-5 text-primary" />
        GIFs Globaux ({gifs.length})
      </h2>

      {/* Page selector for new uploads */}
      <div className="mb-3">
        <Label className="text-sm mb-1 block">Page cible pour les nouveaux GIFs</Label>
        <Select value={selectedPage} onValueChange={setSelectedPage}>
          <SelectTrigger className="bg-card border-border w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGES.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-4 ${
          dragOver ? 'border-primary bg-primary/10' : 'border-border'
        }`}
      >
        {uploadGif.isPending || createGif.isPending ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Glissez des GIF ici ou
            </p>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>Parcourir</span>
              </Button>
              <input
                type="file"
                accept="image/gif"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </>
        )}
      </div>

      {/* Preview / position button */}
      {gifs.length > 0 && (
        <Button variant="mystical" size="sm" className="mb-4" onClick={() => setPreviewOpen(true)}>
          Positionner les GIFs
        </Button>
      )}

      {/* GIF list */}
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
      ) : gifs.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center">Aucun GIF</p>
      ) : (
        <div className="space-y-2">
          {gifs.map((gif) => (
            <div key={gif.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <img src={gif.url} alt="" className="w-12 h-12 object-cover rounded" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground truncate">
                  {gif.width}×{gif.height} — ({gif.x}, {gif.y})
                </p>
                <Select value={gif.page} onValueChange={(v) => handlePageChange(gif, v)}>
                  <SelectTrigger className="h-7 text-xs w-32 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={() => handleToggleVisibility(gif)}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                {gif.visible ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              </button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(gif.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Positioning dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Positionner les GIFs (drag & resize)</DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 h-full bg-background/50" style={{ minHeight: '60vh' }}>
            {gifs.map((gif) => (
              <Rnd
                key={gif.id}
                default={{
                  x: gif.x,
                  y: gif.y,
                  width: gif.width,
                  height: gif.height,
                }}
                bounds="parent"
                onDragStop={(_e, d) => {
                  updateGif.mutate({ id: gif.id, x: Math.round(d.x), y: Math.round(d.y) });
                }}
                onResizeStop={(_e, _dir, ref, _delta, pos) => {
                  updateGif.mutate({
                    id: gif.id,
                    width: parseInt(ref.style.width),
                    height: parseInt(ref.style.height),
                    x: Math.round(pos.x),
                    y: Math.round(pos.y),
                  });
                }}
                className="border border-dashed border-primary/50 rounded"
              >
                <div className="relative w-full h-full">
                  <img src={gif.url} alt="" className="w-full h-full object-contain pointer-events-none" />
                  <span className="absolute bottom-0 left-0 bg-background/80 text-[10px] px-1 rounded-tr text-foreground">
                    {getPageLabel(gif.page)}
                  </span>
                </div>
              </Rnd>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
