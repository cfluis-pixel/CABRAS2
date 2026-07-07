import { useEffect, useMemo, useRef } from 'react';

const ITEM_H = 40; // debe coincidir con --drum-item-h en CSS
const VISIBLE = 3;

// Rueda vertical estilo iOS: scroll nativo con snap + escala/opacidad según
// distancia al centro. El valor central es el seleccionado.
export default function DrumPicker({ min, max, value, onChange }) {
  const listRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const scrollingRef = useRef(null); // timeout activo mientras el usuario desliza
  const rafRef = useRef(null);
  const mountedRef = useRef(false);

  const values = useMemo(() => {
    const out = [];
    for (let v = min; v <= max; v++) out.push(v);
    return out;
  }, [min, max]);

  const updateStyles = () => {
    const el = listRef.current;
    if (!el) return;
    const center = el.scrollTop + el.clientHeight / 2;
    Array.from(el.children).forEach((child, i) => {
      const mid = ITEM_H + i * ITEM_H + ITEM_H / 2; // padding-top = ITEM_H
      const d = Math.abs(mid - center) / ITEM_H;
      child.style.transform = `scale(${Math.max(0.68, 1 - d * 0.16).toFixed(3)})`;
      child.style.opacity = String(Math.max(0.18, 1 - d * 0.42).toFixed(2));
      child.classList.toggle('selected', d < 0.5);
    });
  };

  const handleScroll = () => {
    clearTimeout(scrollingRef.current);
    scrollingRef.current = setTimeout(() => {
      scrollingRef.current = null;
    }, 160);
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = listRef.current;
      if (!el) return;
      updateStyles();
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
      const v = min + idx;
      if (v !== valueRef.current) onChange(v);
    });
  };

  // Sincroniza el scroll cuando el valor cambia desde fuera (p. ej. sube la
  // puja mínima), salvo que el usuario esté deslizando en ese momento
  useEffect(() => {
    const el = listRef.current;
    if (!el || scrollingRef.current) return;
    const idx = Math.max(0, Math.min(values.length - 1, value - min));
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: mountedRef.current ? 'smooth' : 'auto' });
    }
    updateStyles();
    mountedRef.current = true;
  }, [value, min, max, values.length]);

  useEffect(() => () => {
    clearTimeout(scrollingRef.current);
    cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="drum-picker" style={{ height: ITEM_H * VISIBLE }}>
      <div className="drum-list" ref={listRef} onScroll={handleScroll}>
        {values.map((v) => (
          <div key={v} className="drum-item">
            {v}
          </div>
        ))}
      </div>
      <div className="drum-band" aria-hidden="true" />
    </div>
  );
}
