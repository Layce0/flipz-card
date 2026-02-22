import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalGifs } from '@/hooks/useGlobalGifs';

export const GlobalGifsOverlay = () => {
  const { data: gifs = [] } = useGlobalGifs();
  const { pathname } = useLocation();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());

  const pageGifs = gifs.filter(g => g.page === pathname);

  const handleClick = useCallback((gif: typeof pageGifs[0]) => {
    if (!gif.click_target_id) return;

    // Hide clicked gif
    setHiddenIds(prev => new Set(prev).add(gif.id));

    // Show target gif
    const target = pageGifs.find(g => g.id === gif.click_target_id);
    if (!target) return;

    setTriggeredIds(prev => new Set(prev).add(target.id));

    // Auto-hide target after duration
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

  const visibleGifs = pageGifs.filter(g => {
    if (hiddenIds.has(g.id)) return false;
    if (g.initially_hidden && !triggeredIds.has(g.id)) return false;
    if (!g.visible) return false;
    return true;
  });

  if (visibleGifs.length === 0) return null;

  return (
    <>
      {visibleGifs.map((gif) =>
        gif.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i) ? (
          <video
            key={gif.id}
            src={gif.url}
            autoPlay
            loop
            muted
            playsInline
            onClick={() => gif.click_target_id && handleClick(gif)}
            className={`absolute z-40 object-contain ${gif.click_target_id ? 'cursor-pointer' : 'pointer-events-none'}`}
            style={{
              left: gif.x,
              top: gif.y,
              width: gif.width,
              height: gif.height,
            }}
          />
        ) : (
          <img
            key={gif.id}
            src={gif.url}
            alt=""
            onClick={() => gif.click_target_id && handleClick(gif)}
            className={`absolute z-40 object-contain ${gif.click_target_id ? 'cursor-pointer' : 'pointer-events-none'}`}
            style={{
              left: gif.x,
              top: gif.y,
              width: gif.width,
              height: gif.height,
            }}
          />
        )
      )}
    </>
  );
};
