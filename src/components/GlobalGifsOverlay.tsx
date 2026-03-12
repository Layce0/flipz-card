import { useState, useCallback, useEffect, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalGifs, GlobalGif } from '@/hooks/useGlobalGifs';

// Persists across navigations within the same session
const playedVideoIds = new Set<string>();

export const GlobalGifsOverlay = memo(() => {
  const { data: mediaItems = [] } = useGlobalGifs();
  const { pathname } = useLocation();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set(playedVideoIds));

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

  const getMediaStyle = (item: GlobalGif): React.CSSProperties => {
    return {
      position: 'absolute',
      left: `${item.x}px`,
      top: `${item.y}px`,
      width: `${item.width}px`,
      height: `${item.height}px`,
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
});

GlobalGifsOverlay.displayName = 'GlobalGifsOverlay';
