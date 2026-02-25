import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalGifs, GlobalGif } from '@/hooks/useGlobalGifs';

// Reference width used for all coordinate calculations (mobile-first)
const REFERENCE_WIDTH = 390;

// Persists across navigations within the same session
const playedVideoIds = new Set<string>();

export const GlobalGifsOverlay = () => {
  const { data: gifs = [] } = useGlobalGifs();
  const { pathname } = useLocation();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set(playedVideoIds));
  const [scale, setScale] = useState(1);
  const rafRef = useRef<number>();

  // Compute scale factor: current viewport width / reference width
  useEffect(() => {
    const update = () => {
      setScale(window.innerWidth / REFERENCE_WIDTH);
    };
    update();
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pageGifs = gifs.filter(g => g.page === pathname);

  const handleClick = useCallback((gif: typeof pageGifs[0]) => {
    if (!gif.click_target_id) return;
    setHiddenIds(prev => new Set(prev).add(gif.id));
    const target = pageGifs.find(g => g.id === gif.click_target_id);
    if (!target) return;
    setTriggeredIds(prev => new Set(prev).add(target.id));
    const duration = target.auto_hide_after_ms;
    if (duration && duration > 0) {
      setTimeout(() => {
        setTriggeredIds(prev => {
          const next = new Set(prev);
          next.delete(target.id);
          return next;
        });
      }, duration);
    }
  }, [pageGifs]);

  // Convert stored values (percentage of reference width) to px scaled to current viewport
  const getResponsiveStyle = (gif: GlobalGif): React.CSSProperties => {
    const toPixels = (val: number) => (val / 100) * REFERENCE_WIDTH * scale;
    return {
      position: 'absolute',
      left: toPixels(gif.x),
      top: toPixels(gif.y),
      width: toPixels(gif.width),
      height: toPixels(gif.height),
    };
  };

  const visibleGifs = pageGifs.filter(g => {
    if (hiddenIds.has(g.id)) return false;
    if (g.initially_hidden && !triggeredIds.has(g.id)) return false;
    if (!g.visible) return false;
    return true;
  });

  if (visibleGifs.length === 0) return null;

  return (
    <>
      {visibleGifs.map((gif) => {
        const isVideo = gif.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i);
        if (isVideo && playedIds.has(gif.id)) return null;
        const style = getResponsiveStyle(gif);
        return isVideo ? (
          <video
            key={gif.id}
            src={gif.url}
            autoPlay
            muted
            playsInline
            onEnded={() => {
              playedVideoIds.add(gif.id);
              setPlayedIds(prev => new Set(prev).add(gif.id));
            }}
            onClick={() => gif.click_target_id && handleClick(gif)}
            className={`z-30 object-contain ${gif.click_target_id ? 'cursor-pointer' : 'pointer-events-none'}`}
            style={style}
          />
        ) : (
          <img
            key={gif.id}
            src={gif.url}
            alt=""
            onClick={() => gif.click_target_id && handleClick(gif)}
            className={`z-30 object-contain ${gif.click_target_id ? 'cursor-pointer' : 'pointer-events-none'}`}
            style={style}
          />
        );
      })}
    </>
  );
};
