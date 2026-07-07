import { useEffect, useRef, useState } from 'react';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Número que cuenta desde 0 hasta `value` (para las notas del ranking)
export function CountUp({ value, decimals = 2, duration = 900, delay = 0 }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf;
    let start;
    const timeout = setTimeout(() => {
      const tick = (now) => {
        if (start == null) start = now;
        const t = Math.min(1, (now - start) / duration);
        setDisplay(value * easeOut(t));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);

  return <>{display.toFixed(decimals)}</>;
}

// Contador de cabras: interpola el cambio y muestra un "−N" flotante al bajar
export function GoatCounter({ value }) {
  const prev = useRef(value);
  const [display, setDisplay] = useState(value);
  const [delta, setDelta] = useState(null);

  useEffect(() => {
    const from = prev.current;
    if (value === from) return;
    prev.current = value;
    if (value < from) setDelta({ amount: value - from, key: Date.now() });

    let raf;
    let start;
    const duration = 700;
    const tick = (now) => {
      if (start == null) start = now;
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(from + (value - from) * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="goat-counter">
      {display} 🐐
      {delta && (
        <span key={delta.key} className="goat-delta" onAnimationEnd={() => setDelta(null)}>
          {delta.amount}
        </span>
      )}
    </span>
  );
}
