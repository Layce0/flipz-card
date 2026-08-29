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
    // Fewer particles on mobile for 60fps
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 8 : 20;

    const resize = () => {
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5);
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
      if (isVisible) {
        lastTime = performance.now();
        animate(lastTime);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: h * 0.65 + Math.random() * h * 0.35,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: (Math.random() - 0.5) * 0.15 - 0.08,
        opacity: Math.random() * 0.5 + 0.3,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.015 + 0.01,
      });
    }

    let lastTime = performance.now();
    const frameInterval = isMobile ? 1000 / 30 : 1000 / 60; // 30 FPS on mobile to save CPU/GPU

    const animate = (time: number) => {
      if (!isVisible) return;

      animationId = requestAnimationFrame(animate);

      const elapsed = time - lastTime;
      if (elapsed < frameInterval) return;
      lastTime = time - (elapsed % frameInterval);

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

        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = 'hsl(275, 85%, 80%)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animationId = requestAnimationFrame(animate);

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
