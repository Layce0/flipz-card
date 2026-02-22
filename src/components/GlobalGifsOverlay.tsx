import { useGlobalGifs } from '@/hooks/useGlobalGifs';

export const GlobalGifsOverlay = () => {
  const { data: gifs = [] } = useGlobalGifs();

  if (gifs.length === 0) return null;

  return (
    <>
      {gifs.filter(g => g.visible).map((gif) => (
        <img
          key={gif.id}
          src={gif.url}
          alt=""
          className="fixed pointer-events-none z-40"
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
