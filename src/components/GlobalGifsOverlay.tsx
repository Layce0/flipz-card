import { useLocation } from 'react-router-dom';
import { useGlobalGifs } from '@/hooks/useGlobalGifs';

export const GlobalGifsOverlay = () => {
  const { data: gifs = [] } = useGlobalGifs();
  const { pathname } = useLocation();

  const visibleGifs = gifs.filter(g => g.visible && g.page === pathname);

  if (visibleGifs.length === 0) return null;

  return (
    <>
      {visibleGifs.map((gif) => (
        <img
          key={gif.id}
          src={gif.url}
          alt=""
          className="absolute pointer-events-none z-40 object-contain"
          style={{
            left: gif.x,
            top: gif.y,
            width: gif.width,
            height: gif.height,
          }}
        />
      ))}
    </>
  );
};
