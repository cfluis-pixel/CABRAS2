import { useEffect, useReducer, useState } from 'react';
import { socket } from '../socket.js';
import Wheel from './Wheel.jsx';

function useNow(intervalMs = 100) {
  const [, tick] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const iv = setInterval(tick, intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return Date.now();
}

export default function Game({ room, me, showToast, clockOffset }) {
  const now = useNow() + clockOffset.current;
  const round = room.round;
  const spinning = room.phase === 'spin';
  const bidding = room.phase === 'bidding';
  const reveal = room.phase === 'reveal';

  const highest = round?.highestBid || null;
  const minBid = (highest?.amount ?? 0) + 1;
  const [amount, setAmount] = useState(minBid);

  // Cuando cambia la puja más alta, propone la mínima siguiente
  useEffect(() => setAmount(minBid), [minBid, round?.number]);

  const remaining = round ? Math.max(0, round.endsAt - now) : 0;
  const secs = Math.ceil(remaining / 1000);
  const timerMax = highest ? 10 : 15;
  const pct = bidding ? Math.min(100, (remaining / (timerMax * 1000)) * 100) : 100;

  const turnPlayer = room.players.find((p) => p.id === round?.turnPlayerId);
  const canBid =
    bidding && !me.locked && me.goats >= minBid && highest?.playerId !== me.id;

  const bid = (n) => {
    socket.emit('bid', { amount: n }, (res) => {
      if (res?.error) showToast(res.error);
    });
  };

  return (
    <div className="screen game">
      <header className="topbar">
        <h1 className="logo logo-small">CABRAS2 🐐</h1>
        <div className="topbar-info">
          <span className="pill mono">{room.code}</span>
          <span className="pill">📜 {room.namesLeft} nombres en juego</span>
          {round && <span className="pill">Ronda {round.number}</span>}
        </div>
      </header>

      <div className="game-grid">
        <section className="card stage">
          {round && (
            <>
              <p className="stage-label">
                {spinning ? '🎰 Girando la ruleta…' : 'Se subasta:'}
              </p>
              <Wheel
                pool={round.pool}
                targetName={round.name}
                spinning={spinning}
                spinEndsAt={round.spinEndsAt}
                clockOffset={clockOffset}
                roundNumber={round.number}
              />

              <div className={`timer ${bidding && secs <= 3 ? 'danger' : ''}`}>
                <div className="timer-num">{bidding ? `⏱ ${secs}s` : '⏸'}</div>
                <div className="timer-bar">
                  <div
                    className="timer-fill"
                    style={{ width: `${bidding ? pct : 100}%` }}
                  />
                </div>
              </div>

              <div className="bid-status">
                {highest ? (
                  <p>
                    Puja más alta: <b>{highest.amount} 🐐</b> de{' '}
                    <b>{highest.playerName}</b>
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

          {reveal && room.lastResult && (
            <div className="reveal-overlay">
              <div className="reveal-card">
                <div className="reveal-emoji">{room.lastResult.free ? '🎁' : '🔨'}</div>
                <h2>
                  ¡<b>{room.lastResult.winnerName}</b> se lleva «
                  {room.lastResult.name}»!
                </h2>
                <p>
                  {room.lastResult.free
                    ? 'Gratis, nadie ha pujado 😱'
                    : `Por ${room.lastResult.amount} 🐐`}
                </p>
              </div>
            </div>
          )}
        </section>

        <aside className="card players-panel">
          <h3>Jugadores</h3>
          <ul>
            {room.players.map((p) => (
              <li
                key={p.id}
                className={`pp-row ${p.id === round?.turnPlayerId ? 'is-turn' : ''} ${
                  p.id === highest?.playerId ? 'is-highest' : ''
                } ${!p.connected ? 'is-off' : ''}`}
              >
                <div className="pp-top">
                  <span className="pp-name">
                    {p.id === round?.turnPlayerId && '🎯 '}
                    {p.name}
                    {p.id === me.id && <span className="you"> (tú)</span>}
                    {!p.connected && ' 📴'}
                  </span>
                  <span className="pp-goats">{p.goats} 🐐</span>
                </div>
                <div className="pp-names">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`won-chip ${p.wonNames[i] ? 'filled' : ''}`}>
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
