import { useEffect, useRef } from 'react';

/** Lightweight burst when clearance completes (Telegram-style celebration). */
export function ClearanceConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!active) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = canvas.offsetWidth * dpr);
    const h = (canvas.height = canvas.offsetHeight * dpr);
    ctx.scale(dpr, dpr);

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#1a3c5e'];
    const pieces = Array.from({ length: 48 }, () => ({
      x: canvas.offsetWidth / 2,
      y: canvas.offsetHeight * 0.35,
      vx: (Math.random() - 0.5) * 10,
      vy: -8 - Math.random() * 6,
      g: 0.35 + Math.random() * 0.2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]!,
      s: 4 + Math.random() * 5,
    }));

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      for (const p of pieces) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (frame < 90) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100] h-full w-full"
      style={{ width: '100%', height: '100%' }}
      aria-hidden
    />
  );
}
