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
      color: item.font_color || '#ffffff',
      backgroundColor: item.bg_color || 'transparent',
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
        const style = getMediaStyle(item);
        const interactiveClass = item.click_target_id ? 'cursor-pointer' : 'pointer-events-none';
        const isVideo = item.url && item.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i);

        // Render Title / Text Card
        if (item.element_type === 'title' || item.element_type === 'text') {
          return (
            <div
              key={item.id}
              style={style}
              className={`p-2 rounded-lg leading-snug flex items-center ${interactiveClass}`}
            >
              <span style={{ fontSize: `${item.font_size || 16}px`, fontWeight: item.element_type === 'title' ? 800 : 500 }}>
                {item.content_text || 'Texte personnalisé'}
              </span>
            </div>
          );
        }

        // Render Badge / Icon Badge
        if (item.element_type === 'badge') {
          return (
            <div
              key={item.id}
              style={style}
              className={`px-3 py-1.5 rounded-full font-bold text-xs flex items-center justify-center shadow-md ${interactiveClass}`}
            >
              <span style={{ fontSize: `${item.font_size || 14}px` }}>
                {item.content_text || '🏷️ Badge'}
              </span>
            </div>
          );
        }

        // Render Percentage / Stat Card
        if (item.element_type === 'stat') {
          return (
            <div
              key={item.id}
              style={style}
              className={`p-3 rounded-xl border border-white/20 shadow-lg flex flex-col justify-center ${interactiveClass}`}
            >
              <div className="flex justify-between items-center text-xs font-bold mb-1">
                <span>{item.content_text || 'Indicateur'}</span>
                <span>{item.percentage_val || 0}%</span>
              </div>
              <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${item.percentage_val || 0}%` }} />
              </div>
            </div>
          );
        }

        // Render Media (Video / Image / GIF)
        if (isVideo && playedIds.has(item.id)) return null;

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
