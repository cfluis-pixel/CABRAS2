import { useEffect, useMemo, useRef, useState } from 'react';

const ITEM_H = 72; // debe coincidir con --wheel-item-h en CSS
const REEL_LEN = 30;
const TARGET_IDX = REEL_LEN;

export default function Wheel({ pool, targetName, spinning, idle, spinEndsAt, clockOffset, roundNumber }) {
  // En modo manual, mientras nadie gira, aún no hay nombre elegido
  const target = targetName || '· · ·';

  // Tira de nombres: relleno + nombre elegido por el servidor + cola para que
  // el tambor no se vea vacío por debajo al frenar
  const items = useMemo(() => {
    const src = pool && pool.length ? [...pool].sort(() => Math.random() - 0.5) : [target];
    const reel = [];
    let i = 0;
    while (reel.length < REEL_LEN) {
      reel.push(src[i % src.length]);
      i++;
    }
    reel.push(target, src[0], src[1 % src.length]);
    return reel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, targetName]);

  const finalY = -(TARGET_IDX - 1) * ITEM_H;
  const reelRef = useRef(null);
  const wasSpinning = useRef(false);
  const [y, setY] = useState(spinning ? 0 : finalY);
  const [duration, setDuration] = useState(0);
  const [flash, setFlash] = useState(false);

  // Curvatura de tambor: rota los items según su distancia al centro visible
  const applyDrum = (currentY) => {
    const reel = reelRef.current;
    if (!reel) return;
    const center = ITEM_H * 1.5;
    for (let i = 0; i < reel.children.length; i++) {
      const el = reel.children[i];
      const d = (i * ITEM_H + ITEM_H / 2 + currentY - center) / ITEM_H;
      if (Math.abs(d) < 2.4) {
        el.style.transform = `rotateX(${(-d * 28).toFixed(1)}deg) scale(${(
          1 - Math.min(0.3, Math.abs(d) * 0.16)
        ).toFixed(3)})`;
        el.style.opacity = String(Math.max(0.15, 1 - Math.abs(d) * 0.38).toFixed(2));
      } else {
        el.style.transform = '';
        el.style.opacity = '0';
      }
    }
  };

  // Lanza el giro y, mientras dura, mide la velocidad real para aplicar
  // desenfoque de movimiento + curvatura frame a frame
  useEffect(() => {
    const reel = reelRef.current;
    if (!spinning) {
      setDuration(0);
      setY(finalY);
      if (wasSpinning.current) {
        wasSpinning.current = false;
        setFlash(true);
        const t = setTimeout(() => setFlash(false), 900);
        return () => clearTimeout(t);
      }
      return;
    }

    wasSpinning.current = true;
    setDuration(0);
    setY(0);

    let raf;
    let prevY = 0;
    let prevT = performance.now();
    const track = (now) => {
      if (!reelRef.current) return;
      const m = new DOMMatrix(getComputedStyle(reelRef.current).transform);
      const curY = m.m42;
      const dt = Math.max(1, now - prevT);
      const v = Math.abs(curY - prevY) / dt; // px/ms
      prevY = curY;
      prevT = now;
      reelRef.current.style.filter = v > 0.15 ? `blur(${Math.min(3.5, v * 0.9).toFixed(1)}px)` : '';
      applyDrum(curY);
      raf = requestAnimationFrame(track);
    };

    // Doble rAF: el navegador pinta la posición inicial antes de animar
    const kickoff = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const remaining = Math.max(500, spinEndsAt - (Date.now() + clockOffset.current));
        setDuration(remaining);
        setY(finalY);
        raf = requestAnimationFrame(track);
      });
    });

    return () => {
      cancelAnimationFrame(kickoff);
      cancelAnimationFrame(raf);
      if (reel) reel.style.filter = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, spinning]);

  // En reposo (pujas / revelado), curvatura estática con el nombre centrado
  useEffect(() => {
    if (!spinning) applyDrum(finalY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, items]);

  const state = spinning ? 'is-spinning' : idle ? 'is-idle' : 'is-locked';
  const itemClass = (i) => {
    if (i !== TARGET_IDX || spinning) return '';
    return idle ? 'pending' : 'current';
  };

  return (
    <div className={`wheel ${state} ${flash ? 'flash' : ''}`}>
      <div className="wheel-window">
        <div
          ref={reelRef}
          className="wheel-reel"
          style={{
            transform: `translateY(${y}px)`,
            transition: duration
              ? `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.25, 1)`
              : 'none',
          }}
        >
          {items.map((name, i) => (
            <div key={i} className={`wheel-item ${itemClass(i)}`}>
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
