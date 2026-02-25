import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalGifs, GlobalGif } from '@/hooks/useGlobalGifs';

// Persists across navigations within the same session
const playedVideoIds = new Set<string>();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const GlobalGifsOverlay = () => {
  const { data: mediaItems = [] } = useGlobalGifs();
  const { pathname } = useLocation();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set(playedVideoIds));
  const [pageHeight, setPageHeight] = useState<number>(window.innerHeight || 800);
  const [viewportWidth, setViewportWidth] = useState<number>(window.innerWidth || 390);

  useEffect(() => {
    const updateMetrics = () => {
      const doc = document.documentElement;
      const body = document.body;
      const nextHeight = Math.max(
        doc?.scrollHeight ?? 0,
        doc?.offsetHeight ?? 0,
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        window.innerHeight
      );

      setPageHeight(nextHeight > 0 ? nextHeight : window.innerHeight || 800);
      setViewportWidth(window.innerWidth || 390);
    };

    updateMetrics();
    window.addEventListener('resize', updateMetrics);
    window.addEventListener('orientationchange', updateMetrics);
    const interval = window.setInterval(updateMetrics, 1200);

    return () => {
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('orientationchange', updateMetrics);
      window.clearInterval(interval);
    };
  }, [pathname]);

  const pageItems = mediaItems.filter(item => item.page === pathname);

  const handleClick = useCallback((item: typeof pageItems[0]) => {
    if (!item.click_target_id) return;

    setHiddenIds(prev => new Set(prev).add(item.id));

    const target = pageItems.find(g => g.id === item.click_target_id);
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
  }, [pageItems]);

  const normalizeYPercent = (rawY: number) => {
    // New system: y is already % of page height
    if (rawY <= 100) return clamp(rawY, 0, 100);

    // Legacy compatibility: old y was stored in vw (% of viewport width)
    const converted = viewportWidth > 0 && pageHeight > 0
      ? (rawY * viewportWidth / pageHeight)
      : rawY;

    return clamp(converted, 0, 100);
  };

  const getMediaStyle = (item: GlobalGif): React.CSSProperties => {
    const yPercent = normalizeYPercent(item.y);

    return {
      position: 'absolute',
      left: `${item.x}vw`,
      top: `${(yPercent / 100) * pageHeight}px`,
      width: `${item.width}vw`,
      height: `${item.height}vw`,
      zIndex: 30,
    };
  };

  const visibleItems = pageItems.filter(item => {
    if (hiddenIds.has(item.id)) return false;
    if (item.initially_hidden && !triggeredIds.has(item.id)) return false;
    if (!item.visible) return false;
    return true;
  });

  if (visibleItems.length === 0) return null;

  return (
    <>
      {visibleItems.map((item) => {
        const isVideo = item.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i);
        if (isVideo && playedIds.has(item.id)) return null;

        const style = getMediaStyle(item);
        const interactiveClass = item.click_target_id ? 'cursor-pointer' : 'pointer-events-none';

        return isVideo ? (
          <video
            key={item.id}
            src={item.url}
            autoPlay
            muted
            playsInline
            onEnded={() => {
              playedVideoIds.add(item.id);
              setPlayedIds(prev => new Set(prev).add(item.id));
            }}
            onClick={() => item.click_target_id && handleClick(item)}
            className={`object-contain ${interactiveClass}`}
            style={style}
          />
        ) : (
          <img
            key={item.id}
            src={item.url}
            alt=""
            onClick={() => item.click_target_id && handleClick(item)}
            className={`object-contain ${interactiveClass}`}
            style={style}
          />
        );
      })}
    </>
  );
};
