import { useState, useCallback, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { useGlobalGifs, useCreateGif, useUpdateGif, useDeleteGif, useUploadGif, GlobalGif } from '@/hooks/useGlobalGifs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Loader2, Trash2, Image as ImageIcon, Type, Percent, Shield, Send,
  RotateCcw, Grid, Move, Eye, EyeOff, Layers, ChevronUp, ChevronDown,
  MousePointer, AlignLeft, Square, Wand2, Smartphone, Monitor, ExternalLink, Link as LinkIcon,
  Copy, Upload, Timer, CornerDownRight, AlignCenterHorizontal, AlignCenterVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// --- Scanned DOM element from the live iframe ---
type PageElement = {
  uid: string;
  tag: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  src?: string;
};

const TAG_PRIORITY = [
  { sel: 'h1,h2,h3', label: 'Titre', color: '#facc15' },
  { sel: 'p,span,label', label: 'Texte', color: '#a3a3a3' },
  { sel: 'button,a[role="button"]', label: 'Bouton', color: '#a78bfa' },
  { sel: 'img,video', label: 'Media', color: '#60a5fa' },
  { sel: 'input,textarea,select', label: 'Champ', color: '#34d399' },
  { sel: 'nav,header,footer', label: 'Section', color: '#fb923c' },
];

function scanIframeElements(iframe: HTMLIFrameElement): PageElement[] {
  try {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return [];
    const iRect = iframe.getBoundingClientRect();
    const results: PageElement[] = [];
    const seen = new Set<Element>();
    TAG_PRIORITY.forEach(({ sel, label, color }) => {
      doc.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
        if (seen.has(el)) return;
        const r = el.getBoundingClientRect();
        // Skip tiny/invisible elements
        if (r.width < 10 || r.height < 10) return;
        // Position relative to iframe top-left
        const x = Math.round(r.left + (iframe.contentWindow?.scrollX ?? 0));
        const y = Math.round(r.top + (iframe.contentWindow?.scrollY ?? 0));
        const text = (el.textContent || el.getAttribute('alt') || el.getAttribute('placeholder') || '').trim().slice(0, 40);
        const src = (el.tagName.toLowerCase() === 'img' || el.tagName.toLowerCase() === 'video') ? (el as any).src : undefined;
        const uid = `page-${label}-${i}-${x}-${y}`;
        el.setAttribute('data-editor-uid', uid);
        results.push({
          uid,
          tag: el.tagName.toLowerCase(),
          label,
          x,
          y,
          width: Math.round(r.width),
          height: Math.round(r.height),
          text,
          color,
          src,
        });
        seen.add(el);
      });
    });
    // Deduplicate very similar positions
    return results.filter((el, i, arr) =>
      !arr.slice(0, i).some(prev =>
        Math.abs(prev.x - el.x) < 5 &&
        Math.abs(prev.y - el.y) < 5 &&
        Math.abs(prev.width - el.width) < 10
      )
    ).slice(0, 60);
  } catch { return []; }
}

const PAGES = [
  { value: '/', label: 'Accueil' },
  { value: '/collection', label: 'Collection' },
  { value: '/packs', label: 'Packs' },
  { value: '/shop', label: 'Boutique' },
  { value: '/profile', label: 'Profil' },
];

const ELEMENT_TYPES = [
  { value: 'media', label: 'Media', icon: ImageIcon, color: 'text-blue-400' },
  { value: 'title', label: 'Titre', icon: Type, color: 'text-yellow-400' },
  { value: 'text', label: 'Texte', icon: AlignLeft, color: 'text-gray-300' },
  { value: 'badge', label: 'Badge', icon: Shield, color: 'text-red-400' },
  { value: 'stat', label: 'Stat %', icon: Percent, color: 'text-emerald-400' },
  { value: 'button', label: 'Bouton', icon: MousePointer, color: 'text-purple-400' },
  { value: 'background', label: 'Fond', icon: Square, color: 'text-orange-400' },
  { value: 'dom_transform', label: 'Déplacer original', icon: Move, color: 'text-pink-400' },
] as const;

type ElementType = typeof ELEMENT_TYPES[number]['value'];

function getElementInfo(type?: string) {
  return ELEMENT_TYPES.find(e => e.value === type) ?? ELEMENT_TYPES[0];
}

// --- Canvas Positioning Area ---
const PositioningArea = ({
  gifs,
  previewPage,
  getPageLabel,
  onSave,
  gridSnap,
  onSelectElement,
  selectedId,
  pageElements,
  onScannedElements,
  onSelectPageElement,
  editForm,
  setEditForm,
  previewDevice,
  setPreviewDevice,
  pendingChanges,
  setPendingChanges,
  saving,
  setSaving,
}: {
  gifs: GlobalGif[];
  previewPage: string;
  getPageLabel: (path: string) => string;
  onSave: (changes: Record<string, { x?: number; y?: number; width?: number; height?: number }>) => Promise<void>;
  gridSnap: boolean;
  onSelectElement: (id: string | null) => void;
  selectedId: string | null;
  pageElements: PageElement[];
  onScannedElements: (els: PageElement[]) => void;
  onSelectPageElement: (uid: string) => void;
  editForm: Record<string, any>;
  setEditForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  previewDevice: 'desktop' | 'mobile';
  setPreviewDevice: React.Dispatch<React.SetStateAction<'desktop' | 'mobile'>>;
  pendingChanges: Record<string, any>;
  setPendingChanges: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [scanning, setScanning] = useState(false);

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
    } catch { /* cross-origin */ }
  }, []);

  const scanElements = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setScanning(true);
    // Retry scan multiple times — the SPA inside the iframe needs time to render
    let attempts = 0;
    const maxAttempts = 8;
    const tryScan = () => {
      attempts++;
      const els = scanIframeElements(iframe);
      if (els.length > 0 || attempts >= maxAttempts) {
        onScannedElements(els);
        setScanning(false);
        if (els.length > 0) console.log(`[CanvasStudio] Scanned ${els.length} elements after ${attempts} attempts`);
        else console.warn(`[CanvasStudio] No elements found after ${maxAttempts} attempts`);
      } else {
        // Retry with exponential backoff: 500, 1000, 1500, 2000...
        setTimeout(tryScan, 500 * attempts);
      }
    };
    // Initial delay to let the iframe load
    setTimeout(tryScan, 1000);
  }, [onScannedElements]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;
    let style = iframe.contentDocument.getElementById('canvas-editor-style');
    if (!style) {
      style = iframe.contentDocument.createElement('style');
      style.id = 'canvas-editor-style';
      iframe.contentDocument.head.appendChild(style);
    }
    let css = '';
    
    // Inject CSS transforms for 'dom_transform' elements in real-time
    gifs.forEach(g => {
      const gif = getEffective(g);
      if (gif.element_type === 'dom_transform' && gif.hide_selector && gif.content_text) {
        try {
          const orig = JSON.parse(gif.content_text);
          if (orig.origW && orig.origH) {
            const scaleX = gif.width / orig.origW;
            const scaleY = gif.height / orig.origH;
            const tx = gif.x - orig.origX;
            const ty = gif.y - orig.origY;
            css += `${gif.hide_selector} {
              transform: translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY}) !important;
              transform-origin: top left !important;
              z-index: 9999 !important;
              position: relative !important;
              pointer-events: none !important;
            }\n`;
          }
        } catch(e) {}
      }
    });
    
    style.textContent = css;
  }, [gifs, pendingChanges]);

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
    // Reset page elements when page changes
    onScannedElements([]);
    return () => { ro.disconnect(); clearTimeout(t1); clearTimeout(t2); clearInterval(interval); };
  }, [previewPage, gifs.length, syncPageHeight, onScannedElements]);

  const snap = (v: number) => gridSnap ? Math.round(v / 20) * 20 : v;

  const trackChange = (id: string, data: { x?: number; y?: number; width?: number; height?: number }, forceExact = false) => {
    setPendingChanges(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...(data.x !== undefined && { x: forceExact ? Math.round(data.x) : snap(data.x) }),
        ...(data.y !== undefined && { y: forceExact ? Math.round(data.y) : snap(data.y) }),
        ...(data.width !== undefined && { width: forceExact ? Math.round(data.width) : snap(data.width) }),
        ...(data.height !== undefined && { height: forceExact ? Math.round(data.height) : snap(data.height) }),
      }
    }));
  };

  const getEffective = (gif: GlobalGif) => {
    const p = pendingChanges[gif.id];
    return p ? { ...gif, ...p } : gif;
  };

  const hasPending = Object.keys(pendingChanges).length > 0;
  const canvasHeight = Math.max(pageHeightPx || 800, 800);
  const canvasWidth = previewDevice === 'mobile' ? Math.min(containerWidth, 420) : containerWidth;

  const backgrounds = gifs.filter(g => g.element_type === 'background');
  const elements = gifs.filter(g => g.element_type !== 'background');

  const [activeGuides, setActiveGuides] = useState<{
    x: number | null;
    y: number | null;
    labelX?: string;
    labelY?: string;
  }>({ x: null, y: null });

  const SNAP_THRESHOLD = 8;

  const getGuideMatches = useCallback((
    dragX: number,
    dragY: number,
    width: number,
    height: number,
    currentId: string
  ) => {
    const currentCenterX = dragX + width / 2;
    const currentCenterY = dragY + height / 2;

    const canvasCenterX = Math.round(canvasWidth / 2);
    const canvasCenterY = Math.round(canvasHeight / 2);

    let guideX: number | null = null;
    let guideY: number | null = null;
    let snapX: number | null = null;
    let snapY: number | null = null;
    let labelX: string | undefined = undefined;
    let labelY: string | undefined = undefined;

    // 1. Horizontal Center (Trait jaune vertical au milieu)
    if (Math.abs(currentCenterX - canvasCenterX) <= SNAP_THRESHOLD) {
      guideX = canvasCenterX;
      snapX = Math.round(canvasCenterX - width / 2);
      labelX = 'Milieu';
    } else {
      // Alignement avec les autres éléments sur l'axe X
      for (const g of elements) {
        if (g.id === currentId || !g.visible) continue;
        const otherEff = getEffective(g);
        const otherCenterX = Math.round(otherEff.x + otherEff.width / 2);
        if (Math.abs(currentCenterX - otherCenterX) <= SNAP_THRESHOLD) {
          guideX = otherCenterX;
          snapX = Math.round(otherCenterX - width / 2);
          labelX = 'Aligné';
          break;
        }
      }
    }

    // 2. Vertical Center (Trait jaune horizontal au milieu)
    if (Math.abs(currentCenterY - canvasCenterY) <= SNAP_THRESHOLD) {
      guideY = canvasCenterY;
      snapY = Math.round(canvasCenterY - height / 2);
      labelY = 'Milieu';
    } else {
      // Alignement avec les autres éléments sur l'axe Y
      for (const g of elements) {
        if (g.id === currentId || !g.visible) continue;
        const otherEff = getEffective(g);
        const otherCenterY = Math.round(otherEff.y + otherEff.height / 2);
        if (Math.abs(currentCenterY - otherCenterY) <= SNAP_THRESHOLD) {
          guideY = otherCenterY;
          snapY = Math.round(otherCenterY - height / 2);
          labelY = 'Aligné';
          break;
        }
      }
    }

    return { guideX, guideY, snapX, snapY, labelX, labelY };
  }, [canvasWidth, canvasHeight, elements, pendingChanges]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border border-border rounded-2xl bg-card shadow-lg">
      {/* Draft & Device Bar */}
      <div className="shrink-0 p-3 border-b border-border bg-card/90 backdrop-blur flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${hasPending ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-xs font-bold">
              {hasPending ? `${Object.keys(pendingChanges).length} modification(s) en brouillon` : 'Tout est publié'}
            </span>
          </div>

          {/* Device Switcher */}
          <div className="flex items-center bg-muted/50 p-0.5 rounded-xl border border-border/50">
            <Button
              size="sm"
              variant={previewDevice === 'mobile' ? 'default' : 'ghost'}
              className="h-6 text-[11px] px-2 gap-1 rounded-lg"
              onClick={() => setPreviewDevice('mobile')}
            >
              <Smartphone className="w-3 h-3" /> Mobile (420px)
            </Button>
            <Button
              size="sm"
              variant={previewDevice === 'desktop' ? 'default' : 'ghost'}
              className="h-6 text-[11px] px-2 gap-1 rounded-lg"
              onClick={() => setPreviewDevice('desktop')}
            >
              <Monitor className="w-3 h-3" /> Plein écran
            </Button>
          </div>
        </div>

        {hasPending && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingChanges({})} disabled={saving} className="text-xs">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Annuler
            </Button>
            <Button size="sm" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave(pendingChanges);
                  setPendingChanges({});
                  toast.success('Poussé en direct sur tous les appareils !');
                } catch {
                  toast.error("Erreur lors de l'enregistrement");
                }
                finally { setSaving(false); }
              }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              Publier
            </Button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative flex justify-center bg-muted/10 p-2">
        {canvasWidth > 0 && (
          <div
            style={{ width: canvasWidth, height: canvasHeight }}
            className={cn(
              'relative transition-all',
              previewDevice === 'mobile' && 'border-2 border-border/80 rounded-2xl shadow-2xl bg-background overflow-hidden',
              gridSnap && 'bg-[radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:20px_20px]'
            )}
          >

            {/* Background layers */}
            {backgrounds.filter(b => b.visible).map(bg => (
              <div key={bg.id}
                className="absolute inset-0 transition-opacity"
                style={{ backgroundColor: bg.bg_color || 'transparent', zIndex: 0 }}
              />
            ))}

            {/* Live page iframe */}
            <iframe ref={iframeRef}
              src={`${window.location.origin}${previewPage}`}
              onLoad={() => { syncPageHeight(); scanElements(); }}
              className="absolute inset-0 border-0 pointer-events-none z-[1]"
              style={{ width: canvasWidth, height: canvasHeight, opacity: pageElements.length > 0 ? 0.9 : 0.6 }}
              title="Apercu de la page" />

            {/* Clickable Page Elements Overlays */}
            {pageElements.map(el => (
              <div
                key={el.uid}
                onClick={() => onSelectPageElement(el.uid)}
                className="absolute z-[5] cursor-pointer border-2 border-dashed border-primary/40 hover:bg-primary/20 hover:border-primary transition-colors"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height }}
                title={`Editer ${el.label} (${el.tag})`}
              />
            ))}

            {/* Movable Rnd for selected page element removed, elements directly enter dom_transform mode now */}

            {/* Overlay elements */}
            <div className="absolute inset-0 z-[10] pointer-events-none" style={{ width: canvasWidth, height: canvasHeight }}>
              {elements.map((gif, index) => {
                const eff = getEffective(gif);
                const isSelected = selectedId === gif.id;
                const isVideo = gif.url?.match(/\.(mp4|webm|mov|avi)(\?|$)/i);
                const elInfo = getElementInfo(gif.element_type);

                if (!gif.visible) return (
                  <div key={gif.id}
                    className="absolute flex items-center gap-1 px-2 py-1 bg-muted/60 rounded text-xs text-muted-foreground cursor-pointer border border-dashed border-muted"
                    style={{ left: eff.x, top: eff.y, zIndex: 5 }}
                    onClick={() => onSelectElement(gif.id)}>
                    <EyeOff className="w-3 h-3" />
                    <span>{gif.content_text || gif.url?.split('/').pop()?.slice(0, 20) || 'Cache'}</span>
                  </div>
                );

                return (
                  <Rnd key={gif.id}
                    position={{ x: eff.x, y: eff.y }}
                    size={{ width: eff.width, height: eff.height }}
                    bounds="parent"
                    dragGrid={gridSnap ? [20, 20] : [1, 1]}
                    resizeGrid={gridSnap ? [20, 20] : [1, 1]}
                    onDragStart={() => onSelectElement(gif.id)}
                    onDrag={(_e, d) => {
                      const matches = getGuideMatches(d.x, d.y, eff.width, eff.height, gif.id);
                      setActiveGuides(prev => {
                        if (prev.x === matches.guideX && prev.y === matches.guideY && prev.labelX === matches.labelX && prev.labelY === matches.labelY) {
                          return prev;
                        }
                        return {
                          x: matches.guideX,
                          y: matches.guideY,
                          labelX: matches.labelX,
                          labelY: matches.labelY,
                        };
                      });
                    }}
                    onDragStop={(_e, d) => {
                      const matches = getGuideMatches(d.x, d.y, eff.width, eff.height, gif.id);
                      setActiveGuides({ x: null, y: null });
                      const finalX = matches.snapX !== null ? matches.snapX : Math.round(d.x);
                      const finalY = matches.snapY !== null ? matches.snapY : Math.round(d.y);
                      const forceExact = matches.snapX !== null || matches.snapY !== null;
                      trackChange(gif.id, { x: finalX, y: finalY }, forceExact);
                    }}
                    onResize={(_e, _dir, ref, _delta, pos) => {
                      const w = parseInt(ref.style.width);
                      const h = parseInt(ref.style.height);
                      const matches = getGuideMatches(pos.x, pos.y, w, h, gif.id);
                      setActiveGuides(prev => {
                        if (prev.x === matches.guideX && prev.y === matches.guideY && prev.labelX === matches.labelX && prev.labelY === matches.labelY) {
                          return prev;
                        }
                        return {
                          x: matches.guideX,
                          y: matches.guideY,
                          labelX: matches.labelX,
                          labelY: matches.labelY,
                        };
                      });
                    }}
                    onResizeStop={(_e, _dir, ref, _delta, pos) => {
                      setActiveGuides({ x: null, y: null });
                      const w = Math.round(parseInt(ref.style.width));
                      const h = Math.round(parseInt(ref.style.height));
                      const matches = getGuideMatches(pos.x, pos.y, w, h, gif.id);
                      const finalX = matches.snapX !== null ? matches.snapX : Math.round(pos.x);
                      const finalY = matches.snapY !== null ? matches.snapY : Math.round(pos.y);
                      const forceExact = matches.snapX !== null || matches.snapY !== null;
                      trackChange(gif.id, {
                        width: w,
                        height: h,
                        x: finalX,
                        y: finalY,
                      }, forceExact);
                    }}
                    className={cn(
                      'border-2 rounded transition-all pointer-events-auto',
                      isSelected ? 'border-primary shadow-lg shadow-primary/40 !z-[999]' :
                        pendingChanges[gif.id] ? 'border-amber-400 z-20' : 'border-dashed border-white/30 z-10'
                    )}>
                    <div className="relative w-full h-full p-1 cursor-move" onClick={() => onSelectElement(gif.id)}>
                      {gif.element_type === 'title' || gif.element_type === 'text' ? (
                        <div style={{ color: gif.font_color || '#ffffff', fontSize: `${gif.font_size || 16}px`, fontWeight: gif.element_type === 'title' ? 800 : 400 }}
                          className="w-full h-full flex items-center justify-center text-center break-words overflow-hidden">
                          {gif.content_text || 'Texte'}
                        </div>
                      ) : gif.element_type === 'badge' ? (
                        <div style={{ backgroundColor: gif.bg_color || '#6366f1', color: gif.font_color || '#ffffff', fontSize: `${gif.font_size || 12}px` }}
                          className="w-full h-full rounded-full flex items-center justify-center font-bold">
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
                      ) : gif.element_type === 'button' ? (
                        <div style={{ backgroundColor: gif.bg_color || '#6366f1', color: gif.font_color || '#ffffff', fontSize: `${gif.font_size || 14}px` }}
                          className="w-full h-full rounded-xl flex items-center justify-center font-bold shadow-lg">
                          {gif.content_text || 'Bouton'}
                        </div>
                      ) : gif.element_type === 'dom_transform' ? (
                        <div className="w-full h-full bg-transparent">
                          {/* Transparent area for dragging the original DOM element */}
                        </div>
                      ) : isVideo ? (
                        <video src={gif.url} className="w-full h-full object-contain pointer-events-none" muted autoPlay loop />
                      ) : (
                        <img src={gif.url} alt="" className="w-full h-full object-contain pointer-events-none" />
                      )}

                      <span className={cn(
                        'absolute top-0 left-0 text-[9px] font-bold px-1 py-0.5 rounded-br flex items-center gap-0.5',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-black/70 text-white'
                      )}>
                        #{index + 1} {elInfo.label}
                      </span>
                    </div>
                  </Rnd>
                );
              })}

              {elements.length === 0 && pageElements.length === 0 && (
                <div className="flex items-center justify-center h-32 pointer-events-none">
                  <p className="text-muted-foreground text-sm bg-background/80 px-4 py-2 rounded-lg">
                    Chargement des elements...
                  </p>
                </div>
              )}
            </div>

            {/* Traits de guidage jaunes style Canva (Milieu horizontal & vertical) */}
            {activeGuides.x !== null && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-[1000] flex flex-col items-center"
                style={{ left: `${activeGuides.x}px`, transform: 'translateX(-50%)' }}
              >
                {/* Trait jaune avec lueur Canva */}
                <div className="w-[2px] h-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.95),0_0_2px_rgba(250,204,21,1)]" />
                {/* Badge d'indication en haut */}
                <div className="absolute top-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1 select-none whitespace-nowrap animate-in fade-in duration-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                  {activeGuides.labelX || 'Milieu'}
                </div>
              </div>
            )}

            {activeGuides.y !== null && (
              <div
                className="absolute left-0 right-0 pointer-events-none z-[1000] flex items-center"
                style={{ top: `${activeGuides.y}px`, transform: 'translateY(-50%)' }}
              >
                {/* Trait jaune avec lueur Canva */}
                <div className="h-[2px] w-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.95),0_0_2px_rgba(250,204,21,1)]" />
                {/* Badge d'indication à gauche */}
                <div className="absolute left-2 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1 select-none whitespace-nowrap animate-in fade-in duration-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                  {activeGuides.labelY || 'Milieu'}
                </div>
              </div>
            )}

            {/* Réticule d'intersection si centré à la fois horizontalement et verticalement */}
            {activeGuides.x !== null && activeGuides.y !== null && (
              <div
                className="absolute pointer-events-none z-[1001] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center animate-in zoom-in-75 duration-100"
                style={{ left: `${activeGuides.x}px`, top: `${activeGuides.y}px` }}
              >
                <div className="w-6 h-6 rounded-full border-2 border-yellow-400 bg-yellow-400/30 flex items-center justify-center shadow-[0_0_12px_rgba(250,204,21,1)]">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Export ---
export const GlobalGifsManager = () => {
  const { data: gifs = [], isLoading } = useGlobalGifs(true);
  const createGif = useCreateGif();
  const updateGif = useUpdateGif();
  const deleteGif = useDeleteGif();
  const uploadGif = useUploadGif();

  const [previewPage, setPreviewPage] = useState('/');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('mobile');
  const [gridSnap, setGridSnap] = useState(true);
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<'layers' | 'canvas' | 'inspector'>('canvas');
  const [allowOverlap, setAllowOverlap] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageElements, setPageElements] = useState<PageElement[]>([]);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const selectedGif = gifs.find(g => g.id === selectedId) ?? null;
  const draftGif = selectedGif ? { ...selectedGif, ...(pendingChanges[selectedGif.id] || {}) } : null;
  const pageGifs = gifs.filter(g => g.page === previewPage);
  const getPageLabel = (path: string) => PAGES.find(p => p.value === path)?.label || path;

  // -- Media upload --
  const getMediaAspectRatio = (file: File) => new Promise<number>((resolve) => {
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const r = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 1;
        URL.revokeObjectURL(url); resolve(r);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(1); };
      video.src = url; return;
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const r = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      URL.revokeObjectURL(url); resolve(r);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(1); };
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
        await createGif.mutateAsync({ url, page: previewPage, width, height, aspectRatio, element_type: 'media' });
        toast.success('Media ajoute !');
      } catch { toast.error("Erreur lors de l'upload"); }
    }
    e.target.value = '';
  };

  // -- Add custom element --
  const handleAddElement = async (type: ElementType) => {
    const defaults: Record<ElementType, { content_text: string; width: number; height: number; font_size: number; bg_color: string; font_color: string }> = {
      media: { content_text: '', width: 140, height: 140, font_size: 16, bg_color: 'transparent', font_color: '#ffffff' },
      title: { content_text: 'Nouveau Titre', width: 280, height: 56, font_size: 24, bg_color: 'transparent', font_color: '#ffffff' },
      text: { content_text: 'Paragraphe de texte...', width: 280, height: 80, font_size: 14, bg_color: 'transparent', font_color: '#cccccc' },
      badge: { content_text: ' Badge', width: 160, height: 40, font_size: 13, bg_color: '#6366f1', font_color: '#ffffff' },
      stat: { content_text: 'Progression', width: 240, height: 80, font_size: 13, bg_color: 'transparent', font_color: '#ffffff' },
      button: { content_text: 'Cliquez ici', width: 200, height: 52, font_size: 15, bg_color: '#6366f1', font_color: '#ffffff' },
      background: { content_text: 'Fond', width: 400, height: 300, font_size: 16, bg_color: '#1a1a2e', font_color: '#ffffff' },
      dom_transform: { content_text: '', width: 100, height: 100, font_size: 14, bg_color: 'transparent', font_color: '#ffffff' },
    };
    const d = defaults[type];
    try {
      await createGif.mutateAsync({ url: '', page: previewPage, ...d, element_type: type as any, percentage_val: 75 });
        toast.success('Element cree !');
    } catch { toast.error('Erreur creation'); }
  };

  // -- Delete --
  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGif.mutateAsync(deleteTarget);
      setSelectedId(null);
      toast.success('Élément supprimé');
    } catch { toast.error('Erreur suppression'); }
    finally { setDeleteTarget(null); }
  };

  // -- Duplicate element --
  const handleDuplicate = async (gifToDuplicate?: GlobalGif | null) => {
    const target = gifToDuplicate || selectedGif;
    if (!target) return;
    try {
      await createGif.mutateAsync({
        url: target.url || '',
        x: target.x + 20,
        y: target.y + 20,
        width: target.width,
        height: target.height,
        page: target.page,
        element_type: target.element_type,
        content_text: target.content_text ? `${target.content_text} (Copie)` : '',
        font_color: target.font_color,
        bg_color: target.bg_color,
        font_size: target.font_size,
        percentage_val: target.percentage_val,
        z_index: (target.z_index ?? 30) + 1,
        action_url: target.action_url,
        hide_selector: target.hide_selector,
        click_target_id: target.click_target_id,
        initially_hidden: target.initially_hidden,
        auto_hide_after_ms: target.auto_hide_after_ms,
      });
      toast.success('Élément dupliqué avec succès !');
    } catch {
      toast.error('Erreur lors de la duplication');
    }
  };

  // -- Copy to another page --
  const handleCopyToPage = async (targetPage: string) => {
    if (!selectedGif || targetPage === selectedGif.page) return;
    try {
      await createGif.mutateAsync({
        url: selectedGif.url || '',
        x: selectedGif.x,
        y: selectedGif.y,
        width: selectedGif.width,
        height: selectedGif.height,
        page: targetPage,
        element_type: selectedGif.element_type,
        content_text: selectedGif.content_text,
        font_color: selectedGif.font_color,
        bg_color: selectedGif.bg_color,
        font_size: selectedGif.font_size,
        percentage_val: selectedGif.percentage_val,
        z_index: selectedGif.z_index,
        action_url: selectedGif.action_url,
        hide_selector: selectedGif.hide_selector,
        click_target_id: selectedGif.click_target_id,
        initially_hidden: selectedGif.initially_hidden,
        auto_hide_after_ms: selectedGif.auto_hide_after_ms,
      });
      toast.success(`Élément copié vers ${getPageLabel(targetPage)} !`);
    } catch {
      toast.error('Erreur lors de la copie vers la page');
    }
  };

  // -- Replace media file --
  const [isReplacingMedia, setIsReplacingMedia] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const handleReplaceMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGif) return;
    setIsReplacingMedia(true);
    try {
      const publicUrl = await uploadGif.mutateAsync(file);
      update('url', publicUrl);
      toast.success('Média prêt ! Cliquez sur Publier pour sauvegarder.');
    } catch {
      toast.error('Erreur lors du remplacement du média');
    } finally {
      setIsReplacingMedia(false);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  // -- Batch save --
  const handleBatchSave = async (changes: Record<string, any>) => {
    for (const [id, data] of Object.entries(changes)) {
      await updateGif.mutateAsync({ id, ...data });
    }
  };

  // -- Update field helper --
  const update = (field: string, value: unknown) => {
    if (!selectedGif) return;
    setPendingChanges(prev => ({
      ...prev,
      [selectedGif.id]: {
        ...(prev[selectedGif.id] || {}),
        [field]: value
      }
    }));
  };

  return (
    <>
    <div className="flex flex-col gap-4">
      {/* -- Header -- */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-card p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Canvas Studio
          </h2>
          <p className="text-xs text-muted-foreground">Editez visuellement chaque page de l'app</p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold">Page :</Label>
          <Select value={previewPage} onValueChange={(val) => { setPreviewPage(val); setSelectedId(null); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* -- Toolbar -- */}
      <div className="bg-card p-4 rounded-2xl border border-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ajouter un element sur {getPageLabel(previewPage)}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="cursor-pointer">
              <input type="file" multiple accept="image/*,video/*" onChange={handleAddMedia} className="hidden" />
              <Button size="sm" variant="default" asChild>
                <span><ImageIcon className="w-4 h-4 mr-1" /> Media (GIF/Image/Video)</span>
              </Button>
            </label>
            {(['title', 'text', 'badge', 'stat', 'button', 'background'] as ElementType[]).map(type => {
              const info = getElementInfo(type);
              const Icon = info.icon;
              return (
                <Button key={type} size="sm" variant="outline" onClick={() => handleAddElement(type)} className="gap-1">
                  <Icon className={cn('w-4 h-4', info.color)} /> {info.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
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

      {/* -- Mobile panel switcher -- */}
      {isMobile && (
        <div className="sticky top-0 z-40 grid grid-cols-3 gap-1 bg-card p-1 rounded-xl border border-border">
          {([['layers', 'Calques'], ['canvas', 'Canevas'], ['inspector', 'Inspecteur']] as const).map(([k, l]) => (
            <Button key={k} size="sm" variant={mobilePanel === k ? 'default' : 'ghost'} onClick={() => setMobilePanel(k)}>{l}</Button>
          ))}
        </div>
      )}

      {/* -- Main 3-panel workspace -- */}
      <div className={isMobile ? 'flex flex-col' : 'grid grid-cols-[200px_1fr_280px] gap-3'} style={{ height: isMobile ? 'calc(100dvh - 140px)' : 680 }}>

        {/* -- LEFT: Layer List -- */}
        <div className={cn(isMobile && mobilePanel !== 'layers' && 'hidden', isMobile && 'h-full')}><div className="h-full bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 py-2 border-b border-border">
            <h3 className="text-xs font-bold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Calques
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {pageElements.length === 0 && pageGifs.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground text-center">Chargement...</div>
            )}

            {/* Page Elements */}
            {pageElements.length > 0 && (
              <div className="px-3 py-1.5 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Elements de la page ({pageElements.length})
              </div>
            )}
            {pageElements.map(el => {
              const existingOverlay = pageGifs.find(g => g.element_type === 'dom_transform' && g.hide_selector?.includes(el.uid));
              const isSelected = existingOverlay ? selectedId === existingOverlay.id : false;
              return (
                <div key={el.uid}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors text-xs border-l-2',
                    isSelected ? 'bg-primary/10 border-primary' : 'border-transparent'
                  )}
                  onClick={async () => {
                    const existing = pageGifs.find(g => g.element_type === 'dom_transform' && g.hide_selector?.includes(el.uid));
                    if (existing) {
                      setSelectedId(existing.id);
                      return;
                    }
                    try {
                      const created = await createGif.mutateAsync({
                        url: '', page: previewPage, element_type: 'dom_transform',
                        content_text: JSON.stringify({ origX: el.x, origY: el.y, origW: el.width, origH: el.height }),
                        x: el.x, y: el.y, width: el.width, height: el.height,
                        bg_color: 'transparent', font_color: '#ffffff', font_size: 14, percentage_val: 0, z_index: 35, action_url: null,
                        hide_selector: `[data-editor-uid="${el.uid}"]`,
                      });
                      if (created && created[0]) setSelectedId(created[0].id);
                      else if (created?.id) setSelectedId(created.id);
                      else if (created) setSelectedId((created as any).id || (created as any)[0]?.id);
                    } catch (e) {}
                  }}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: el.color }} />
                  <span className="flex-1 truncate text-foreground/80">{el.text?.slice(0, 20) || el.label}</span>
                  <span className="text-[9px] text-muted-foreground uppercase opacity-60">{el.tag}</span>
                </div>
              );
            })}

            {/* Overlays */}
            {pageGifs.length > 0 && (
              <div className="px-3 py-1.5 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">
                Overlays ({pageGifs.length})
              </div>
            )}
            {[...pageGifs].reverse().map((gif) => {
              const info = getElementInfo(gif.element_type);
              const Icon = info.icon;
              const isSelected = selectedId === gif.id;
              const label = gif.content_text || gif.url?.split('/').pop()?.slice(0, 18) || info.label;
              return (
                <div key={gif.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors text-xs border-l-2',
                    isSelected ? 'bg-primary/10 border-primary' : 'border-transparent'
                  )}
                  onClick={() => setSelectedId(gif.id)}>
                  <Icon className={cn('w-3 h-3 shrink-0', info.color)} />
                  <span className="flex-1 truncate text-foreground/80">{label}</span>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    title="Dupliquer ce calque"
                    onClick={e => { e.stopPropagation(); handleDuplicate(gif); }}>
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title={gif.visible ? 'Masquer' : 'Afficher'}
                    onClick={e => { e.stopPropagation(); updateGif.mutate({ id: gif.id, visible: !gif.visible }); }}>
                    {gif.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 opacity-40" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        </div>
        {/* -- CENTER: Canvas -- */}
        <div className={cn('h-full flex flex-col', isMobile && mobilePanel !== 'canvas' && 'hidden')}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full border border-border rounded-2xl bg-card">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <PositioningArea
              gifs={pageGifs}
              previewPage={previewPage}
              getPageLabel={getPageLabel}
              onSave={handleBatchSave}
              gridSnap={gridSnap}
              onSelectElement={(id) => { setSelectedId(id); }}
              selectedId={selectedId}
              pageElements={pageElements}
              onScannedElements={setPageElements}
              onSelectPageElement={async (uid) => {
                if (!uid) {
                  setSelectedId(null);
                  return;
                }
                const el = pageElements.find(e => e.uid === uid);
                if (!el) return;

                const existing = pageGifs.find(g => g.element_type === 'dom_transform' && g.hide_selector?.includes(uid));
                if (existing) {
                  setSelectedId(existing.id);
                  return;
                }

                const autoHideSelector = `[data-editor-uid="${el.uid}"]`;
                try {
                  const created = await createGif.mutateAsync({
                    url: '',
                    page: previewPage,
                    element_type: 'dom_transform',
                    content_text: JSON.stringify({ origX: el.x, origY: el.y, origW: el.width, origH: el.height }),
                    x: el.x,
                    y: el.y,
                    width: el.width,
                    height: el.height,
                    bg_color: 'transparent',
                    font_color: '#ffffff',
                    font_size: 14,
                    percentage_val: 0,
                    z_index: 35,
                    action_url: null,
                    hide_selector: autoHideSelector,
                  });
                  if (created && created[0]) setSelectedId(created[0].id);
                  else if (created?.id) setSelectedId(created.id);
                  else if (created) setSelectedId((created as any).id || (created as any)[0]?.id);
                } catch (e) {
                  console.error(e);
                }
              }}
              editForm={editForm}
              setEditForm={setEditForm}
              previewDevice={previewDevice}
              setPreviewDevice={setPreviewDevice}
              pendingChanges={pendingChanges}
              setPendingChanges={setPendingChanges}
              saving={saving}
              setSaving={setSaving}
            />
          )}
        </div>

        {/* -- RIGHT: Inspector -- */}
        <div className={cn('bg-card border', isMobile && mobilePanel !== 'inspector' && 'hidden', isMobile && 'h-full')} style={{}} data-panel="inspector"><div className="h-full bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="shrink-0 px-3 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-bold">Inspecteur</h3>
            {selectedGif && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="w-7 h-7"
                  title="Dupliquer cet élément"
                  onClick={() => handleDuplicate()}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="w-7 h-7"
                  title="Supprimer cet élément"
                  onClick={() => handleDelete(selectedGif.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {!selectedGif ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Cliquez sur un element du canvas ou dans la liste des calques
              </p>
            ) : draftGif ? (
              <>
                {/* Type selector */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type d'élément</Label>
                  <Select
                    value={draftGif.element_type || 'media'}
                    onValueChange={(val) => {
                      const newType = val as ElementType;
                      update('element_type', newType);
                      if (newType !== 'media' && !draftGif.content_text) {
                        update('content_text', getElementInfo(newType).label);
                      }
                      if (newType === 'title' && (!draftGif.font_size || draftGif.font_size < 20)) {
                        update('font_size', 24);
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ELEMENT_TYPES.map(t => {
                        const Icon = t.icon;
                        return (
                          <SelectItem key={t.value} value={t.value} className="text-xs">
                            <span className="flex items-center gap-1.5">
                              <Icon className={cn('w-3.5 h-3.5', t.color)} />
                              {t.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Visibility */}
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                  <Label className="text-xs">Visible</Label>
                  <Switch checked={draftGif.visible} onCheckedChange={v => update('visible', v)} />
                </div>

                {/* Content text */}
                {(['title', 'text', 'badge', 'stat', 'button'] as string[]).includes(draftGif.element_type || '') && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Texte / Libelle</Label>
                    <Input
                      value={draftGif.content_text || ''}
                      onChange={e => update('content_text', e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                )}

                {/* Media URL + Re-upload file */}
                {draftGif.element_type === 'media' && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Média (Fichier ou URL)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={draftGif.url || ''}
                        onChange={e => update('url', e.target.value)}
                        className="h-8 text-xs flex-1 font-mono"
                        placeholder="https://..."
                      />
                      <input
                        type="file"
                        ref={replaceFileInputRef}
                        onChange={handleReplaceMediaFile}
                        accept="image/*,video/*"
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs gap-1 shrink-0"
                        disabled={isReplacingMedia}
                        onClick={() => replaceFileInputRef.current?.click()}
                      >
                        {isReplacingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Changer
                      </Button>
                    </div>
                  </div>
                )}

                {/* Font size slider */}
                {(['title', 'text', 'badge', 'button'] as string[]).includes(draftGif.element_type || '') && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Taille texte - {draftGif.font_size || 16}px
                    </Label>
                    <Slider
                      min={8} max={96} step={1}
                      value={[draftGif.font_size || 16]}
                      onValueChange={([v]) => update('font_size', v)}
                      className="mt-2"
                    />
                  </div>
                )}

                {/* Stat percentage */}
                {draftGif.element_type === 'stat' && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Pourcentage - {draftGif.percentage_val || 0}%
                    </Label>
                    <Slider
                      min={0} max={100} step={1}
                      value={[draftGif.percentage_val || 0]}
                      onValueChange={([v]) => update('percentage_val', v)}
                      className="mt-2"
                    />
                  </div>
                )}

                {/* Colors */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Texte</Label>
                    <input type="color" value={draftGif.font_color || '#ffffff'}
                      onChange={e => update('font_color', e.target.value)}
                      className="mt-1 w-full h-9 cursor-pointer rounded-lg border border-border bg-transparent" />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fond</Label>
                    <input type="color" value={draftGif.bg_color || '#6366f1'}
                      onChange={e => update('bg_color', e.target.value)}
                      className="mt-1 w-full h-9 cursor-pointer rounded-lg border border-border bg-transparent" />
                  </div>
                </div>

                {/* Position */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Position</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] gap-1 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 font-bold"
                        title="Centrer horizontalement au milieu de la page"
                        onClick={() => {
                          const w = draftGif.width || 100;
                          const targetW = previewDevice === 'mobile' ? 420 : 1000;
                          update('x', Math.round((targetW - w) / 2));
                          toast.info('Centré horizontalement (au milieu)');
                        }}
                      >
                        <AlignCenterHorizontal className="w-3 h-3" />
                        Centrer X
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] gap-1 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 font-bold"
                        title="Centrer verticalement au milieu de la page"
                        onClick={() => {
                          const h = draftGif.height || 100;
                          update('y', Math.round((800 - h) / 2));
                          toast.info('Centré verticalement (au milieu)');
                        }}
                      >
                        <AlignCenterVertical className="w-3 h-3" />
                        Centrer Y
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <Label className="text-[9px] text-muted-foreground">X (px)</Label>
                      <Input type="number" value={draftGif.x}
                        onChange={e => update('x', parseInt(e.target.value) || 0)}
                        className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[9px] text-muted-foreground">Y (px)</Label>
                      <Input type="number" value={draftGif.y}
                        onChange={e => update('y', parseInt(e.target.value) || 0)}
                        className="h-8 text-xs" />
                    </div>
                  </div>
                </div>

                {/* Size */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Taille</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <Label className="text-[9px] text-muted-foreground">Largeur (px)</Label>
                      <Input type="number" value={draftGif.width}
                        onChange={e => update('width', parseInt(e.target.value) || 30)}
                        className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[9px] text-muted-foreground">Hauteur (px)</Label>
                      <Input type="number" value={draftGif.height}
                        onChange={e => update('height', parseInt(e.target.value) || 30)}
                        className="h-8 text-xs" />
                    </div>
                  </div>
                </div>

                {/* Action URL */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-primary" /> Redirection au clic (optionnel)
                  </Label>
                  <Input
                    value={draftGif.action_url || ''}
                    onChange={e => update('action_url', e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                    placeholder="Ex: /shop, /packs, ou https://..."
                  />
                </div>

                {/* Hide Selector */}
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Masquer l'élément original (sélecteur CSS)
                  </Label>
                  <Input
                    value={draftGif.hide_selector || ''}
                    onChange={e => update('hide_selector', e.target.value)}
                    className="mt-1 h-8 text-xs font-mono"
                    placeholder="Ex: h1, [data-tour='timer']"
                  />
                </div>

                {/* Interactions & Behavior */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Interactions & Dynamique
                  </Label>

                  {/* Initially hidden */}
                  <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                    <div>
                      <Label className="text-xs block">Caché au démarrage</Label>
                      <span className="text-[9px] text-muted-foreground">S'affiche seulement si déclenché</span>
                    </div>
                    <Switch
                      checked={draftGif.initially_hidden}
                      onCheckedChange={v => update('initially_hidden', v)}
                    />
                  </div>

                  {/* Trigger click_target_id */}
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <CornerDownRight className="w-3 h-3 text-primary" /> Déclencher une cible au clic
                    </Label>
                    <Select
                      value={draftGif.click_target_id || 'none'}
                      onValueChange={v => update('click_target_id', v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs bg-muted/30">
                        <SelectValue placeholder="Aucune" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">Aucune cible</SelectItem>
                        {pageGifs
                          .filter(g => g.id !== draftGif.id)
                          .map(g => {
                            const info = getElementInfo(g.element_type);
                            const name = g.content_text || g.url?.split('/').pop()?.slice(0, 18) || info.label;
                            return (
                              <SelectItem key={g.id} value={g.id} className="text-xs">
                                {info.label}: {name}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Auto-hide timer */}
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Timer className="w-3 h-3 text-amber-400" /> Disparition auto (secondes)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={draftGif.auto_hide_after_ms ? draftGif.auto_hide_after_ms / 1000 : ''}
                      onChange={e => {
                        const sec = parseFloat(e.target.value) || 0;
                        update('auto_hide_after_ms', sec > 0 ? Math.round(sec * 1000) : null);
                      }}
                      placeholder="0 = permanent"
                      className="mt-1 h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Layer order (z-index) */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Ordre du calque (z-index : {draftGif.z_index ?? 30})
                    </Label>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1"
                      onClick={() => {
                        const nextZ = (draftGif.z_index ?? 30) + 5;
                        update('z_index', nextZ);
                        toast.success(`Premier plan (z-index: ${nextZ})`);
                      }}>
                      <ChevronUp className="w-3.5 h-3.5" /> Premier plan (+5)
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1"
                      onClick={() => {
                        const nextZ = Math.max(1, (draftGif.z_index ?? 30) - 5);
                        update('z_index', nextZ);
                        toast.success(`Arrière-plan (z-index: ${nextZ})`);
                      }}>
                      <ChevronDown className="w-3.5 h-3.5" /> Arrière-plan (-5)
                    </Button>
                  </div>
                </div>

                {/* Page Copy & Duplicate actions */}
                <div className="pt-2 border-t border-border space-y-2">
                  {/* PUBLISH BUTTON - always visible when element selected */}
                  <Button
                    variant="default"
                    size="sm"
                    className={cn(
                      'w-full font-bold shadow-lg',
                      pendingChanges[draftGif.id] && Object.keys(pendingChanges[draftGif.id]).length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30'
                        : 'bg-muted text-muted-foreground cursor-default opacity-60'
                    )}
                    disabled={saving || !(pendingChanges[draftGif.id] && Object.keys(pendingChanges[draftGif.id]).length > 0)}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await updateGif.mutateAsync({ id: draftGif.id, ...pendingChanges[draftGif.id] });
                        setPendingChanges(prev => {
                          const next = { ...prev };
                          delete next[draftGif.id];
                          return next;
                        });
                        toast.success('Modifications publiées !');
                      } catch {
                        toast.error('Erreur lors de la publication');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                    {pendingChanges[draftGif.id] && Object.keys(pendingChanges[draftGif.id]).length > 0
                      ? 'Publier les modifications'
                      : 'Aucune modification'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => handleDuplicate()}
                  >
                    <Copy className="w-3.5 h-3.5" /> Dupliquer cet élément
                  </Button>

                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Copier vers une autre page
                    </Label>
                    <Select onValueChange={(page) => handleCopyToPage(page)}>
                      <SelectTrigger className="mt-1 h-8 text-xs bg-muted/30">
                        <SelectValue placeholder="Choisir la destination..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGES.filter(p => p.value !== draftGif.page).map(p => (
                          <SelectItem key={p.value} value={p.value} className="text-xs">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button variant="destructive" size="sm" className="w-full text-xs" onClick={() => handleDelete(draftGif.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer l'élément
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet élément ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'élément sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

