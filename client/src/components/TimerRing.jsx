import { useEffect, useRef } from 'react';
import useIsMobile from '../useIsMobile.js';

// Anillo de cuenta atrás con precisión de décimas, actualizado vía rAF
// (sin re-render de React: escribe directamente en el DOM)
export default function TimerRing({ endsAt, totalMs, clockOffset, running, danger, warn }) {
  const isMobile = useIsMobile();
  const SIZE = isMobile ? 104 : 132;
  const R = isMobile ? 44 : 56;
  const CIRC = 2 * Math.PI * R;

  const fgRef = useRef(null);
  const numRef = useRef(null);

  useEffect(() => {
    let raf;
    const tick = () => {
      const fg = fgRef.current;
      const num = numRef.current;
      if (fg && num) {
        if (!running) {
          fg.style.strokeDashoffset = 0;
          num.textContent = Math.round(totalMs / 1000);
        } else {
          const remain = Math.max(0, endsAt - (Date.now() + clockOffset.current));
          const frac = Math.min(1, remain / totalMs);
          fg.style.strokeDashoffset = CIRC * (1 - frac);
          num.textContent =
            remain <= 5000 ? (remain / 1000).toFixed(1) : String(Math.ceil(remain / 1000));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, totalMs, running, clockOffset, CIRC]);

  const state = !running ? 'idle' : danger ? 'danger' : warn ? 'warn' : '';

  return (
    <div className={`timer-ring ${state}`} style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle className="ring-bg" cx={SIZE / 2} cy={SIZE / 2} r={R} />
        <circle
          ref={fgRef}
          className="ring-fg"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeDasharray={CIRC}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span ref={numRef} className="ring-num" />
    </div>
  );
}
