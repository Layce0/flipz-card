import { useState, useCallback, useRef, useEffect } from 'react';
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

const PAGE_HEIGHT = 3000; // Tall enough to cover full page content

const PositioningArea = ({
  gifs,
  previewPage,
  getPageLabel,
  onSave,
}: {
  gifs: GlobalGif[];
  previewPage: string;
  getPageLabel: (path: string) => string;
  onSave: (changes: Record<string, { x?: number; y?: number; width?: number; height?: number }>) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { x?: number; y?: number; width?: number; height?: number }>>({});

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setContainerWidth(Math.round(containerRef.current.getBoundingClientRect().width));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const trackChange = (id: string, data: { x?: number; y?: number; width?: number; height?: number }) => {
    setPendingChanges(prev => ({ ...prev, [id]: { ...prev[id], ...data } }));
  };

  const getEffective = (gif: GlobalGif) => {
    const p = pendingChanges[gif.id];
    return {
      x: p?.x ?? gif.x,
      y: p?.y ?? gif.y,
      width: p?.width ?? gif.width,
      height: p?.height ?? gif.height,
    };
  };

  const hasPending = Object.keys(pendingChanges).length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {hasPending && (
        <div className="shrink-0 p-3 border-b border-border bg-card flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{Object.keys(pendingChanges).length} élément(s) modifié(s)</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingChanges({})}>Annuler</Button>
            <Button variant="default" size="sm" onClick={() => { onSave(pendingChanges); setPendingChanges({}); }}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {containerWidth > 0 && (
          <div style={{ width: containerWidth, height: PAGE_HEIGHT }} className="relative">
            <iframe
              src={`${window.location.origin}${previewPage}`}
              style={{ width: containerWidth, height: PAGE_HEIGHT }}
              className="absolute inset-0 border-0 pointer-events-none opacity-40"
              title="Aperçu de la page"
            />
            <div className="absolute inset-0 z-10" style={{ width: containerWidth, height: PAGE_HEIGHT }}>
              {gifs.map((gif, index) => {
                const eff = getEffective(gif);
                return (
                  <Rnd
                    key={gif.id}
                    position={{
                      x: (eff.x / 100) * containerWidth,
                      y: eff.y,
                    }}
                    size={{
                      width: (eff.width / 100) * containerWidth,
                      height: (eff.height / 100) * containerWidth,
                    }}
                    bounds="parent"
                    onDragStop={(_e, d) => {
                      trackChange(gif.id, {
                        x: parseFloat(((d.x / containerWidth) * 100).toFixed(2)),
                        y: Math.round(d.y),
                      });
                    }}
                    onResizeStop={(_e, _dir, ref, _delta, pos) => {
                      trackChange(gif.id, {
                        width: parseFloat(((parseInt(ref.style.width) / containerWidth) * 100).toFixed(2)),
                        height: parseFloat(((parseInt(ref.style.height) / containerWidth) * 100).toFixed(2)),
                        x: parseFloat(((pos.x / containerWidth) * 100).toFixed(2)),
                        y: Math.round(pos.y),
                      });
                    }}
                    className={`border-2 border-dashed rounded bg-black/10 ${pendingChanges[gif.id] ? 'border-yellow-400' : 'border-primary/60'}`}
                  >
                    <div className="relative w-full h-full">
                      {gif.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i) ? (
                        <video src={gif.url} className="w-full h-full object-contain pointer-events-none" muted autoPlay />
                      ) : (
                        <img src={gif.url} alt="" className="w-full h-full object-contain pointer-events-none" />
                      )}
                      <span className="absolute top-0 left-0 bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-br">
                        #{index + 1}
                      </span>
                    </div>
                  </Rnd>
                );
              })}
              {gifs.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm bg-background/80 px-4 py-2 rounded-lg">
                    Aucun GIF sur la page {getPageLabel(previewPage)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const GlobalGifsManager = () => {
  const { data: gifs = [], isLoading } = useGlobalGifs(true);
  const createGif = useCreateGif();
  const updateGif = useUpdateGif();
  const deleteGif = useDeleteGif();
  const uploadGif = useUploadGif();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState('/');
  const [dragOver, setDragOver] = useState(false);
  const [selectedPage, setSelectedPage] = useState('/');

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length === 0) {
      toast.error('Seuls les fichiers image ou vidéo sont acceptés');
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
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length === 0) {
      toast.error('Seuls les fichiers image ou vidéo sont acceptés');
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
        GIFs / Images / Vidéos ({gifs.length})
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
              Glissez des GIF, images ou vidéos ici ou
            </p>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>Parcourir</span>
              </Button>
              <input
                type="file"
                accept="image/*,video/*"
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
          {gifs.map((gif, index) => (
            <div key={gif.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <span className="text-xs font-bold text-primary min-w-[24px]">#{index + 1}</span>
              {gif.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i) ? (
                <video src={gif.url} className="w-12 h-12 object-cover rounded" muted />
              ) : (
                <img src={gif.url} alt="" className="w-12 h-12 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground truncate">
                  {gif.width}×{gif.height} — ({gif.x}, {gif.y})
                  {gif.initially_hidden && ' · Caché par défaut'}
                  {gif.auto_hide_after_ms && ` · Disparaît après ${gif.auto_hide_after_ms}ms`}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
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
                  <Select
                    value={gif.click_target_id ?? '_none'}
                    onValueChange={(v) => updateGif.mutate({ id: gif.id, click_target_id: v === '_none' ? null : v } as any)}
                  >
                    <SelectTrigger className="h-7 text-xs w-36 bg-background border-border">
                      <SelectValue placeholder="Cible clic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Aucune cible</SelectItem>
                      {gifs.filter(g => g.id !== gif.id && g.page === gif.page).map((g, gi) => (
                        <SelectItem key={g.id} value={g.id}>→ #{gifs.indexOf(g) + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gif.initially_hidden}
                      onChange={(e) => updateGif.mutate({ id: gif.id, initially_hidden: e.target.checked } as any)}
                      className="w-3 h-3"
                    />
                    Caché
                  </label>
                  <input
                    type="number"
                    placeholder="ms"
                    value={gif.auto_hide_after_ms ?? ''}
                    onChange={(e) => updateGif.mutate({ id: gif.id, auto_hide_after_ms: e.target.value ? parseInt(e.target.value) : null } as any)}
                    className="h-7 text-xs w-20 bg-background border border-border rounded px-1"
                  />
                </div>
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
        <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 flex flex-row items-center gap-4 shrink-0">
            <DialogTitle className="whitespace-nowrap">Positionner les GIFs</DialogTitle>
            <Select value={previewPage} onValueChange={setPreviewPage}>
              <SelectTrigger className="w-40 h-8 text-xs bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogHeader>
          <PositioningArea
            gifs={gifs.filter(g => g.page === previewPage)}
            previewPage={previewPage}
            getPageLabel={getPageLabel}
            onSave={(changes) => {
              Object.entries(changes).forEach(([id, data]) => updateGif.mutate({ id, ...data }));
              toast.success('Positions enregistrées !');
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
};
