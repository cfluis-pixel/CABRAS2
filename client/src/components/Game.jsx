import { useEffect, useReducer, useRef, useState } from 'react';
import { socket } from '../socket.js';
import { playerColor } from '../colors.js';
import Wheel from './Wheel.jsx';
import Avatar from './Avatar.jsx';
import TimerRing from './TimerRing.jsx';
import { GoatCounter } from './Counters.jsx';

function useNow(intervalMs = 100) {
  const [, tick] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const iv = setInterval(tick, intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return Date.now();
}

// Tarjeta que vuela desde la ruleta hasta el hueco del ganador
function FlyingName({ flight }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transform = `translate(${flight.to.x - flight.from.x}px, ${
          flight.to.y - flight.from.y
        }px) scale(0.38)`;
        el.style.opacity = '0.35';
      })
    );
    return () => cancelAnimationFrame(raf);
  }, [flight]);

  return (
    <div className="flying-wrap" style={{ left: flight.from.x, top: flight.from.y }}>
      <div ref={ref} className="flying-name">
        {flight.name}
      </div>
    </div>
  );
}

export default function Game({ room, me, showToast, clockOffset }) {
  const now = useNow() + clockOffset.current;
  const spinning = room.phase === 'spin';
  const bidding = room.phase === 'bidding';
  const reveal = room.phase === 'reveal';

  // Durante el revelado el servidor ya no manda round: conservamos el último
  // para que la ruleta siga visible y el nombre pueda "volar" desde ella
  const lastRoundRef = useRef(room.round);
  if (room.round) lastRoundRef.current = room.round;
  const round = room.round || lastRoundRef.current;

  const highest = room.round?.highestBid || null;
  const minBid = (highest?.amount ?? 0) + 1;
  const [amount, setAmount] = useState(minBid);
  useEffect(() => setAmount(minBid), [minBid, round?.number]);

  const remaining = round ? Math.max(0, round.endsAt - now) : 0;
  const secs = Math.ceil(remaining / 1000);
  const danger = bidding && remaining <= 3000;
  const warn = bidding && remaining <= 6000;

  const turnPlayer = room.players.find((p) => p.id === round?.turnPlayerId);
  const highestIdx = highest ? room.players.findIndex((p) => p.id === highest.playerId) : -1;
  const canBid =
    bidding && !me.locked && me.goats >= minBid && highest?.playerId !== me.id;

  const bid = (n) => {
    socket.emit('bid', { amount: n }, (res) => {
      if (res?.error) showToast(res.error);
    });
  };

  // --- vuelo del nombre ganado hacia el panel del ganador ---
  const stageRef = useRef(null);
  const chipRefs = useRef({});
  const [flight, setFlight] = useState(null);
  const flightKey = reveal && room.lastResult ? `${room.lastResult.winnerId}:${room.lastResult.name}` : null;

  useEffect(() => {
    if (!flightKey) {
      setFlight(null);
      return;
    }
    const { winnerId, name } = room.lastResult;
    const winner = room.players.find((p) => p.id === winnerId);
    const idx = winner ? winner.wonNames.indexOf(name) : -1;
    const srcEl = stageRef.current?.querySelector('.wheel-window');
    const dstEl = chipRefs.current[`${winnerId}:${idx}`];
    if (!srcEl || !dstEl) return;
    const src = srcEl.getBoundingClientRect();
    const dst = dstEl.getBoundingClientRect();
    setFlight({
      name,
      from: { x: src.left + src.width / 2, y: src.top + src.height / 2 },
      to: { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 },
    });
    const t = setTimeout(() => setFlight(null), 950);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightKey]);

  const isLandingChip = (p, i) =>
    reveal &&
    room.lastResult &&
    p.id === room.lastResult.winnerId &&
    i === p.wonNames.indexOf(room.lastResult.name);

  return (
    <div className="screen game">
      {danger && <div className="panic-vignette" />}
      {flight && <FlyingName flight={flight} />}

      <header className="topbar">
        <h1 className="logo logo-small">CABRAS2 🐐</h1>
        <div className="topbar-info">
          <span className="pill mono">{room.code}</span>
          <span className="pill">📜 {room.namesLeft} nombres en juego</span>
          {round && <span className="pill">Ronda {round.number}</span>}
        </div>
      </header>

      <div className="game-grid">
        <section className="card stage" ref={stageRef}>
          {round && (
            <>
              <p className="stage-label">
                {spinning ? 'Girando la ruleta…' : reveal ? 'Adjudicado' : 'Se subasta:'}
              </p>
              <Wheel
                pool={round.pool}
                targetName={round.name}
                spinning={spinning}
                spinEndsAt={round.spinEndsAt}
                clockOffset={clockOffset}
                roundNumber={round.number}
              />

              {reveal && room.lastResult ? (
                <div className="reveal-banner">
                  <b>{room.lastResult.winnerName}</b> se lleva «{room.lastResult.name}»{' '}
                  {room.lastResult.free ? (
                    <span className="free-tag">gratis</span>
                  ) : (
                    <>
                      por <b>{room.lastResult.amount} 🐐</b>
                    </>
                  )}
                </div>
              ) : (
                <TimerRing
                  endsAt={round.endsAt}
                  totalMs={(highest ? 10 : 15) * 1000}
                  clockOffset={clockOffset}
                  running={bidding}
                  danger={danger}
                  warn={warn}
                />
              )}

              {!reveal && (
                <div className="bid-status">
                  {highest ? (
                    <p>
                      Puja más alta: <b>{highest.amount} 🐐</b> de{' '}
                      <b style={{ color: playerColor(highestIdx) }}>{highest.playerName}</b>
                    </p>
                  ) : (
                    <p>
                      Sin pujas — si nadie puja, <b>{turnPlayer?.name}</b> se lo lleva
                      gratis
                    </p>
                  )}
                  <p className="turn-note">
                    🎯 Turno de <b>{turnPlayer?.name}</b>
                    {turnPlayer?.id === me.id && ' (¡eres tú!)'}
                  </p>
                </div>
              )}

              {me.locked ? (
                <p className="locked-note">
                  🔒 Ya tienes tus 3 nombres. ¡A mirar cómo sufren los demás!
                </p>
              ) : (
                <div className="bid-controls">
                  <button
                    className="btn btn-primary"
                    disabled={!canBid}
                    onClick={() => bid(minBid)}
                  >
                    Pujar {minBid} 🐐
                  </button>
                  <div className="bid-custom">
                    <input
                      type="number"
                      min={minBid}
                      max={me.goats}
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                    <button
                      className="btn btn-secondary"
                      disabled={!canBid || amount < minBid || amount > me.goats}
                      onClick={() => bid(amount)}
                    >
                      Pujar
                    </button>
                  </div>
                  <span className="my-goats">Tienes {me.goats} 🐐</span>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="card players-panel">
          <h3>Jugadores</h3>
          <ul>
            {room.players.map((p, idx) => (
              <li
                key={p.id}
                style={{ '--pc': playerColor(idx) }}
                className={`pp-row ${p.id === round?.turnPlayerId ? 'is-turn' : ''} ${
                  p.id === highest?.playerId ? 'is-highest' : ''
                } ${!p.connected ? 'is-off' : ''}`}
              >
                <div className="pp-top">
                  <span className="pp-name">
                    <Avatar name={p.name} index={idx} size={28} />
                    {p.name}
                    {p.id === me.id && <span className="you"> (tú)</span>}
                    {p.id === round?.turnPlayerId && (
                      <span className="turn-tag">turno</span>
                    )}
                    {!p.connected && ' 📴'}
                  </span>
                  <span className="pp-goats">
                    <GoatCounter value={p.goats} />
                  </span>
                </div>
                <div className="pp-names">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      ref={(el) => {
                        chipRefs.current[`${p.id}:${i}`] = el;
                      }}
                      className={`won-chip ${p.wonNames[i] ? 'filled' : ''} ${
                        isLandingChip(p, i) ? 'landing' : ''
                      }`}
                    >
                      {p.wonNames[i] || '—'}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
