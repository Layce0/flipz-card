import { useState, useCallback, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useGlobalGifs, useCreateGif, useUpdateGif, useDeleteGif, useUploadGif, GlobalGif } from '@/hooks/useGlobalGifs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Trash2, Upload, Image as ImageIcon, Film, Video, Type, Percent, Shield, Send, RotateCcw, Grid, Move, Palette } from 'lucide-react';
import { toast } from 'sonner';

const PAGES = [
  { value: '/', label: 'Accueil' },
  { value: '/collection', label: 'Collection' },
  { value: '/packs', label: 'Packs' },
  { value: '/shop', label: 'Boutique' },
  { value: '/profile', label: 'Profil' },
];

const PositioningArea = ({
  gifs,
  previewPage,
  getPageLabel,
  onSave,
  gridSnap,
  allowOverlap,
  onSelectElement,
  selectedId
}: {
  gifs: GlobalGif[];
  previewPage: string;
  getPageLabel: (path: string) => string;
  onSave: (changes: Record<string, { x?: number; y?: number; width?: number; height?: number }>) => Promise<void>;
  gridSnap: boolean;
  allowOverlap: boolean;
  onSelectElement: (id: string) => void;
  selectedId: string | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<Record<string, { x?: number; y?: number; width?: number; height?: number }>>({});
  const [saving, setSaving] = useState(false);

  const syncPageHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const body = doc.body;
      const html = doc.documentElement;
      const next = Math.max(
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        html?.scrollHeight ?? 0,
        html?.offsetHeight ?? 0,
        iframe.clientHeight
      );

      if (next > 0) setPageHeightPx(next);
    } catch {
      // Ignore cross-origin transient load failures
    }
  }, []);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setContainerWidth(Math.round(containerRef.current.getBoundingClientRect().width));
    };

    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);

    const t1 = window.setTimeout(syncPageHeight, 120);
    const t2 = window.setTimeout(syncPageHeight, 600);
    const interval = window.setInterval(syncPageHeight, 1500);

    return () => {
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearInterval(interval);
    };
  }, [previewPage, gifs.length, syncPageHeight]);

  const trackChange = (id: string, data: { x?: number; y?: number; width?: number; height?: number }) => {
    let finalX = data.x;
    let finalY = data.y;
    let finalW = data.width;
    let finalH = data.height;

    // Apply 20px grid snap if enabled
    if (gridSnap) {
      if (finalX !== undefined) finalX = Math.round(finalX / 20) * 20;
      if (finalY !== undefined) finalY = Math.round(finalY / 20) * 20;
      if (finalW !== undefined) finalW = Math.round(finalW / 20) * 20;
      if (finalH !== undefined) finalH = Math.round(finalH / 20) * 20;
    }

    setPendingChanges(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...(finalX !== undefined && { x: finalX }),
        ...(finalY !== undefined && { y: finalY }),
        ...(finalW !== undefined && { width: finalW }),
        ...(finalH !== undefined && { height: finalH })
      }
    }));
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
  const canvasHeight = Math.max(pageHeightPx || 800, 800);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border border-border rounded-2xl bg-card shadow-lg">
      {/* Draft Status & Push Deployment Bar */}
      <div className="shrink-0 p-3 border-b border-border bg-card/90 backdrop-blur flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${hasPending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-xs font-bold">
            {hasPending ? `${Object.keys(pendingChanges).length} modification(s) en brouillon` : 'Modifications publiées'}
          </span>
        </div>

        {hasPending && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingChanges({})} disabled={saving} className="text-xs">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Annuler
            </Button>
            <Button size="sm" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs" onClick={async () => {
              setSaving(true);
              try {
                await onSave(pendingChanges);
                setPendingChanges({});
                toast.success('🚀 Modifications pushées & déployées sur tous les appareils !');
              } catch {
                toast.error("Erreur lors de l'enregistrement");
              } finally {
                setSaving(false);
              }
            }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              Push les modifications
            </Button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {containerWidth > 0 && (
          <div
            style={{ width: containerWidth, height: canvasHeight }}
            className={`relative ${gridSnap ? 'bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:20px_20px]' : ''}`}
          >
            <iframe
              ref={iframeRef}
              src={`${window.location.origin}${previewPage}`}
              onLoad={syncPageHeight}
              style={{ width: containerWidth, height: canvasHeight }}
              className="absolute inset-0 border-0 pointer-events-none opacity-40"
              title="Aperçu de la page"
            />
            <div className="absolute inset-0 z-10" style={{ width: containerWidth, height: canvasHeight }}>
              {gifs.map((gif, index) => {
                const eff = getEffective(gif);
                const isSelected = selectedId === gif.id;
                const isVideo = gif.url && gif.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i);

                return (
                  <Rnd
                    key={gif.id}
                    position={{ x: eff.x, y: eff.y }}
                    size={{ width: eff.width, height: eff.height }}
                    bounds="parent"
                    dragGrid={gridSnap ? [20, 20] : [1, 1]}
                    resizeGrid={gridSnap ? [20, 20] : [1, 1]}
                    onDragStart={() => onSelectElement(gif.id)}
                    onDragStop={(_e, d) => {
                      trackChange(gif.id, {
                        x: Math.round(d.x),
                        y: Math.round(d.y),
                      });
                    }}
                    onResizeStop={(_e, _dir, ref, _delta, pos) => {
                      trackChange(gif.id, {
                        width: Math.round(parseInt(ref.style.width)),
                        height: Math.round(parseInt(ref.style.height)),
                        x: Math.round(pos.x),
                        y: Math.round(pos.y),
                      });
                    }}
                    className={`border-2 rounded transition-colors ${isSelected ? 'border-primary shadow-lg shadow-primary/30 z-50' : pendingChanges[gif.id] ? 'border-amber-400' : 'border-dashed border-primary/50'}`}
                  >
                    <div className="relative w-full h-full p-1" onClick={() => onSelectElement(gif.id)}>
                      {gif.element_type === 'title' || gif.element_type === 'text' ? (
                        <div style={{ color: gif.font_color || '#ffffff', fontSize: `${gif.font_size || 16}px`, fontWeight: gif.element_type === 'title' ? 800 : 500 }} className="w-full h-full flex items-center justify-center text-center">
                          {gif.content_text || 'Texte'}
                        </div>
                      ) : gif.element_type === 'badge' ? (
                        <div style={{ backgroundColor: gif.bg_color || '#6366f1', color: gif.font_color || '#ffffff' }} className="w-full h-full rounded-full flex items-center justify-center font-bold text-xs">
                          {gif.content_text || 'Badge'}
                        </div>
                      ) : gif.element_type === 'stat' ? (
                        <div className="w-full h-full flex flex-col justify-center p-2 bg-black/40 rounded-lg">
                          <div className="flex justify-between text-xs font-bold text-white">
                            <span>{gif.content_text || 'Stat'}</span>
                            <span>{gif.percentage_val || 0}%</span>
                          </div>
                          <div className="w-full h-2 bg-white/20 rounded-full mt-1">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${gif.percentage_val || 0}%` }} />
                          </div>
                        </div>
                      ) : isVideo ? (
                        <video src={gif.url} className="w-full h-full object-contain pointer-events-none" muted autoPlay loop />
                      ) : (
                        <img src={gif.url} alt="" className="w-full h-full object-contain pointer-events-none" />
                      )}

                      <span className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] font-bold px-1 py-0.5 rounded-br">
                        #{index + 1} ({gif.element_type || 'media'})
                      </span>
                    </div>
                  </Rnd>
                );
              })}

              {gifs.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground text-sm bg-background/80 px-4 py-2 rounded-lg">
                    Aucun élément sur la page {getPageLabel(previewPage)}
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

  const [previewPage, setPreviewPage] = useState('/');
  const [gridSnap, setGridSnap] = useState(true);
  const [allowOverlap, setAllowOverlap] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Inspector form states
  const selectedGif = gifs.find(g => g.id === selectedId);

  const getMediaAspectRatio = (file: File) => new Promise<number>((resolve) => {
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 1;
        URL.revokeObjectURL(url);
        resolve(ratio);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(1);
      };
      video.src = url;
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      URL.revokeObjectURL(url);
      resolve(ratio);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(1);
    };
    img.src = url;
  });

  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const aspectRatio = await getMediaAspectRatio(file);
        const width = file.type.startsWith('video/') ? 180 : 140;
        const height = Math.round(width / (aspectRatio || 1));
        const url = await uploadGif.mutateAsync(file);
        await createGif.mutateAsync({
          url,
          page: previewPage,
          width,
          height,
          aspectRatio,
          element_type: 'media'
        });
        toast.success('Média ajouté avec succès !');
      } catch {
        toast.error("Erreur lors de l'upload");
      }
    }
    e.target.value = '';
  };

  const handleAddCustomElement = async (type: 'title' | 'text' | 'badge' | 'stat') => {
    let content_text = 'Nouveau Titre';
    let width = 240, height = 50;
    let font_size = 20;

    if (type === 'text') { content_text = 'Paragraphe de texte explicatif'; height = 70; font_size = 14; }
    if (type === 'badge') { content_text = '🔥 Badge Récompense'; width = 160; height = 40; font_size = 14; }
    if (type === 'stat') { content_text = 'Progression'; width = 240; height = 80; font_size = 14; }

    try {
      await createGif.mutateAsync({
        url: '',
        page: previewPage,
        width,
        height,
        element_type: type,
        content_text,
        font_size,
        font_color: '#ffffff',
        bg_color: type === 'badge' ? '#6366f1' : 'transparent',
        percentage_val: 75
      });
      toast.success('Élément créé avec succès !');
    } catch {
      toast.error('Erreur lors de la création de l\'élément');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet élément ?')) return;
    try {
      await deleteGif.mutateAsync(id);
      setSelectedId(null);
      toast.success('Élément supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleBatchSavePositions = async (changes: Record<string, { x?: number; y?: number; width?: number; height?: number }>) => {
    for (const [id, data] of Object.entries(changes)) {
      await updateGif.mutateAsync({ id, ...data });
    }
  };

  const pageGifs = gifs.filter(g => g.page === previewPage);
  const getPageLabel = (path: string) => PAGES.find(p => p.value === path)?.label || path;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 bg-card p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Admin Replica Studio & Modération
          </h2>
          <p className="text-xs text-muted-foreground">Éditez les médias, titres, badges, stats et fonds d'écran de chaque page</p>
        </div>

        {/* Page Switcher */}
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold">Écran :</Label>
          <Select value={previewPage} onValueChange={(val) => { setPreviewPage(val); setSelectedId(null); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Toolbar: Add Elements & Toggles */}
      <div className="bg-card p-4 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ajouter sur la page ({getPageLabel(previewPage)})</span>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="cursor-pointer">
              <input type="file" multiple accept="image/*,video/*" onChange={handleAddMedia} className="hidden" />
              <Button size="sm" variant="default" asChild>
                <span><ImageIcon className="w-4 h-4 mr-1" /> + Média (GIF/Image/Vidéo)</span>
              </Button>
            </label>

            <Button size="sm" variant="outline" onClick={() => handleAddCustomElement('title')}>
              <Type className="w-4 h-4 mr-1 text-primary" /> + Titre
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddCustomElement('text')}>
              <Type className="w-4 h-4 mr-1 text-muted-foreground" /> + Paragraphe
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddCustomElement('badge')}>
              <Shield className="w-4 h-4 mr-1 text-red-400" /> + Badge
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleAddCustomElement('stat')}>
              <Percent className="w-4 h-4 mr-1 text-yellow-400" /> + Stat %
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium">Grille 20px (Snap)</span>
            </div>
            <Switch checked={gridSnap} onCheckedChange={setGridSnap} />
          </div>

          <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium">Chevauchement</span>
            </div>
            <Switch checked={allowOverlap} onCheckedChange={setAllowOverlap} />
          </div>
        </div>
      </div>

      {/* Main Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[720px]">
        {/* Canvas Replica View (2 cols) */}
        <div className="lg:col-span-2 h-full flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <PositioningArea
              gifs={pageGifs}
              previewPage={previewPage}
              getPageLabel={getPageLabel}
              onSave={handleBatchSavePositions}
              gridSnap={gridSnap}
              allowOverlap={allowOverlap}
              onSelectElement={setSelectedId}
              selectedId={selectedId}
            />
          )}
        </div>

        {/* Inspector Side Panel (1 col) */}
        <div className="bg-card p-4 rounded-2xl border border-border h-full flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-sm">⚙️ Inspecteur d'Élément</h3>
            {selectedGif && (
              <Button size="sm" variant="destructive" onClick={() => handleDelete(selectedGif.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {selectedGif ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Type d'élément</Label>
                <div className="font-bold text-primary text-sm uppercase">{selectedGif.element_type || 'media'}</div>
              </div>

              {(selectedGif.element_type === 'title' || selectedGif.element_type === 'text' || selectedGif.element_type === 'badge' || selectedGif.element_type === 'stat') && (
                <div>
                  <Label className="text-xs">Texte / Libellé</Label>
                  <Input
                    value={selectedGif.content_text || ''}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, content_text: e.target.value })}
                  />
                </div>
              )}

              {selectedGif.element_type === 'stat' && (
                <div>
                  <Label className="text-xs">Pourcentage (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={selectedGif.percentage_val || 0}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, percentage_val: parseInt(e.target.value) || 0 })}
                  />
                </div>
              )}

              {selectedGif.element_type === 'media' && (
                <div>
                  <Label className="text-xs">URL Média</Label>
                  <Input
                    value={selectedGif.url}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, url: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Couleur Texte</Label>
                  <Input
                    type="color"
                    value={selectedGif.font_color || '#ffffff'}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, font_color: e.target.value })}
                    className="h-10 cursor-pointer"
                  />
                </div>
                <div>
                  <Label className="text-xs">Couleur Fond</Label>
                  <Input
                    type="color"
                    value={selectedGif.bg_color || '#6366f1'}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, bg_color: e.target.value })}
                    className="h-10 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Position X (px)</Label>
                  <Input
                    type="number"
                    value={selectedGif.x}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, x: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Position Y (px)</Label>
                  <Input
                    type="number"
                    value={selectedGif.y}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, y: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Largeur (px)</Label>
                  <Input
                    type="number"
                    value={selectedGif.width}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, width: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Hauteur (px)</Label>
                  <Input
                    type="number"
                    value={selectedGif.height}
                    onChange={(e) => updateGif.mutate({ id: selectedGif.id, height: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-10">
              Cliquez sur un élément sur le Canvas Replica pour le sélectionner et modifier ses propriétés.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
