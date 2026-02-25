import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalGifs, GlobalGif } from '@/hooks/useGlobalGifs';

// Persists across navigations within the same session
const playedVideoIds = new Set<string>();

export const GlobalGifsOverlay = () => {
  const { data: gifs = [] } = useGlobalGifs();
  const { pathname } = useLocation();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set(playedVideoIds));

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

  // All values stored as % of viewport width → use vw directly
  // The browser handles all scaling natively, no JS needed
  const getStyle = (gif: GlobalGif): React.CSSProperties => ({
    position: 'absolute' as const,
    left: `${gif.x}vw`,
    top: `${gif.y}vw`,
    width: `${gif.width}vw`,
    height: `${gif.height}vw`,
    zIndex: 30,
  });

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
        const style = getStyle(gif);
        const interactiveClass = gif.click_target_id ? 'cursor-pointer' : 'pointer-events-none';

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
            className={`object-contain ${interactiveClass}`}
            style={style}
          />
        ) : (
          <img
            key={gif.id}
            src={gif.url}
            alt=""
            onClick={() => gif.click_target_id && handleClick(gif)}
            className={`object-contain ${interactiveClass}`}
            style={style}
          />
        );
      })}
    </>
  );
};
