import { useEffect, useRef } from 'react';

// Confeti de rectángulos de colores sobre canvas. Se autolimpia al terminar.
export default function Confetti({ colors, duration = 4500, count = 130 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const parts = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: (5 + Math.random() * 6) * dpr,
      h: (3 + Math.random() * 5) * dpr,
      vy: (1.6 + Math.random() * 2.6) * dpr,
      vx: (Math.random() - 0.5) * 1.6 * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.18,
      sway: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of parts) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.sway + now / 400) * 0.6 * dpr;
        p.rot += p.vr;
        if (p.y < canvas.height + 20) alive = true;
        // Dejan de nacer partículas al final: fade global
        const alpha = elapsed > duration ? Math.max(0, 1 - (elapsed - duration) / 800) : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.max(1, p.h * Math.abs(Math.cos(p.rot))));
        ctx.restore();
      }
      if (alive && elapsed < duration + 900) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [colors, duration, count]);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}
