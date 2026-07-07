import { useEffect, useMemo, useState } from 'react';

const ITEM_H = 72; // debe coincidir con --wheel-item-h en CSS
const REEL_LEN = 30;

export default function Wheel({ pool, targetName, spinning, spinEndsAt, clockOffset, roundNumber }) {
  // Tira de nombres que gira; siempre termina en el nombre elegido por el servidor
  const items = useMemo(() => {
    const src = pool && pool.length ? [...pool].sort(() => Math.random() - 0.5) : [targetName];
    const reel = [];
    let i = 0;
    while (reel.length < REEL_LEN) {
      reel.push(src[i % src.length]);
      i++;
    }
    reel.push(targetName);
    return reel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber]);

  const finalY = -(items.length - 2) * ITEM_H;
  const [y, setY] = useState(spinning ? 0 : finalY);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!spinning) {
      setDuration(0);
      setY(finalY);
      return;
    }
    setDuration(0);
    setY(0);
    // Doble rAF para que el navegador pinte la posición inicial antes de animar
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const remaining = Math.max(500, spinEndsAt - (Date.now() + clockOffset.current));
        setDuration(remaining);
        setY(finalY);
      });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, spinning]);

  return (
    <div className={`wheel ${spinning ? 'is-spinning' : 'is-locked'}`}>
      <div className="wheel-marker">▶</div>
      <div className="wheel-window">
        <div
          className="wheel-reel"
          style={{
            transform: `translateY(${y}px)`,
            transition: duration
              ? `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.25, 1)`
              : 'none',
          }}
        >
          {items.map((name, i) => (
            <div
              key={i}
              className={`wheel-item ${!spinning && i === items.length - 1 ? 'current' : ''}`}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
      <div className="wheel-marker flip">◀</div>
    </div>
  );
}
