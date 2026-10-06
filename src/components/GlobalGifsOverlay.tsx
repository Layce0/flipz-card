import { useState, useCallback, useEffect, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGlobalGifs, GlobalGif } from '@/hooks/useGlobalGifs';

// Persists across navigations within the same session
const playedVideoIds = new Set<string>();

export const GlobalGifsOverlay = memo(() => {
  const { data: mediaItems = [] } = useGlobalGifs();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set(playedVideoIds));

  const pageItems = mediaItems.filter(item => item.page === pathname);

  const handleClick = useCallback((item: GlobalGif) => {
    // 1. Redirection if action_url is defined
    if (item.action_url) {
      const url = item.action_url.trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        navigate(url);
      }
    }

    // 2. Trigger linked target if click_target_id is defined
    if (item.click_target_id) {
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
    }
  }, [pageItems, navigate]);

  const getMediaStyle = (item: GlobalGif): React.CSSProperties => {
    return {
      position: 'absolute',
      left: `${item.x}px`,
      top: `${item.y}px`,
      width: `${item.width}px`,
      height: `${item.height}px`,
      zIndex: item.z_index ?? 30,
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

  // Dynamically hide elements that are replaced by canvas overlays
  useEffect(() => {
    let css = '';

    // Standard hide_selectors
    const hideSelectors = visibleItems
      .filter(i => i.element_type !== 'dom_transform')
      .map(i => i.hide_selector)
      .filter((s): s is string => Boolean(s && s.trim()));
      
    if (hideSelectors.length > 0) {
      css += hideSelectors.map(sel => `${sel} { display: none !important; }`).join('\n') + '\n';
    }

    // CSS Transforms for 'dom_transform' elements
    visibleItems.forEach(gif => {
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
              z-index: ${gif.z_index || 9999} !important;
              position: relative !important;
            }\n`;
          }
        } catch(e) {}
      }
    });

    if (!css) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'flipz-canvas-hide-selectors';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    return () => {
      styleEl.remove();
    };
  }, [visibleItems]);

  if (visibleItems.length === 0) return null;

  return (
    <>
      {visibleItems.filter(item => item.element_type !== 'dom_transform').map((item) => {
        const style = getMediaStyle(item);
        const isClickable = Boolean(item.click_target_id || item.action_url || item.element_type === 'button');
        const interactiveClass = isClickable ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none';
        const isVideo = item.url && item.url.match(/\.(mp4|webm|mov|avi)(\?|$)/i);

        // Render Title / Text Card
        if (item.element_type === 'title' || item.element_type === 'text') {
          return (
            <div
              key={item.id}
              style={style}
              onClick={() => isClickable && handleClick(item)}
              className={`p-2 rounded-lg leading-snug flex items-center ${interactiveClass}`}
            >
              <span style={{ fontSize: `${item.font_size || 16}px`, fontWeight: item.element_type === 'title' ? 800 : 500 }}>
                {item.content_text || 'Texte personnalisé'}
              </span>
            </div>
          );
        }

        // Render Interactive Button
        if (item.element_type === 'button') {
          return (
            <button
              key={item.id}
              style={style}
              onClick={() => handleClick(item)}
              className="px-4 py-2 rounded-xl font-bold flex items-center justify-center transition-transform active:scale-95 hover:brightness-110 shadow-lg cursor-pointer pointer-events-auto"
            >
              <span style={{ fontSize: `${item.font_size || 14}px` }}>
                {item.content_text || 'Bouton'}
              </span>
            </button>
          );
        }

        // Render Background / Banner
        if (item.element_type === 'background') {
          return (
            <div
              key={item.id}
              style={style}
              onClick={() => isClickable && handleClick(item)}
              className={`rounded-2xl transition-all ${interactiveClass}`}
            />
          );
        }

        // Render Badge / Icon Badge
        if (item.element_type === 'badge') {
          return (
            <div
              key={item.id}
              style={style}
              onClick={() => isClickable && handleClick(item)}
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
              onClick={() => isClickable && handleClick(item)}
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
            onClick={() => isClickable && handleClick(item)}
            className={`object-contain ${interactiveClass}`}
            style={style}
          />
        ) : (
          <img
            key={item.id}
            src={item.url}
            alt=""
            onClick={() => isClickable && handleClick(item)}
            className={`object-contain ${interactiveClass}`}
            style={style}
          />
        );
      })}
    </>
  );
});

GlobalGifsOverlay.displayName = 'GlobalGifsOverlay';
