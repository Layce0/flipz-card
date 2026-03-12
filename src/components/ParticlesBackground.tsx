import { useEffect, useRef, memo } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
}

export const ParticlesBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId: number;
    let isVisible = true;
    const particles: Particle[] = [];
    const PARTICLE_COUNT = 35; // reduced from 60

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Pause when tab is hidden
    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) animate();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: h * 0.65 + Math.random() * h * 0.35,
        size: Math.random() * 2.5 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.2 - 0.1,
        opacity: Math.random() * 0.7 + 0.3,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.01,
      });
    }

    const animate = () => {
      if (!isVisible) return;

      const cw = window.innerWidth;
      const ch = window.innerHeight;
      ctx.clearRect(0, 0, cw, ch);

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        const currentOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));

        if (p.x < 0) p.x = cw;
        if (p.x > cw) p.x = 0;
        if (p.y < ch * 0.6) {
          p.speedY = Math.abs(p.speedY) * 0.5;
          p.y = ch * 0.6;
        }
        if (p.y > ch) {
          p.speedY = -Math.abs(p.speedY);
          p.y = ch;
        }

        // Single glow circle instead of gradient (much cheaper)
        ctx.globalAlpha = currentOpacity * 0.3;
        ctx.fillStyle = 'hsl(275, 85%, 75%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = 'hsl(275, 90%, 85%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, willChange: 'transform' }}
    />
  );
});

ParticlesBackground.displayName = 'ParticlesBackground';
