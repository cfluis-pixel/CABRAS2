import { useEffect, useMemo, useState } from 'react';
import { playerColor, playerHue } from '../colors.js';
import Avatar from './Avatar.jsx';
import Confetti from './Confetti.jsx';
import { CountUp } from './Counters.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Results({ room, me, onExit }) {
  const results = room.results || [];
  const n = results.length;

  // Revelado de abajo hacia arriba: rápido en la cola, pausado en el podio,
  // pausa extra antes del ganador
  const delays = useMemo(() => {
    const d = new Array(n).fill(0);
    let t = 350;
    for (let pos = n - 1; pos >= 0; pos--) {
      if (pos === 0) t += 650;
      d[pos] = t;
      t += pos <= 2 ? 650 : 150;
    }
    return d;
  }, [n]);

  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    if (n < 2) return;
    const t = setTimeout(() => setConfetti(true), delays[0] + 350);
    return () => clearTimeout(t);
  }, [delays, n]);

  const winnerIdx = room.players.findIndex((p) => p.id === results[0]?.id);
  const confettiColors = useMemo(() => {
    const h = playerHue(winnerIdx >= 0 ? winnerIdx : 0);
    return ['#b4f927', '#ffb020', `hsl(${h} 75% 60%)`, `hsl(${(h + 40) % 360} 70% 55%)`, '#eef4ff'];
  }, [winnerIdx]);

  const playerIdx = (id) => room.players.findIndex((p) => p.id === id);

  return (
    <div className="screen">
      {confetti && <Confetti colors={confettiColors} />}
      <header className="topbar">
        <h1 className="logo logo-small">CABRAS2 🐐</h1>
        <span className="pill mono">{room.code}</span>
      </header>

      <div className="card results-card">
        <h2>🏆 Ranking final</h2>
        <div className="table-wrap">
          <table className="results-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Nombres conseguidos</th>
                <th>🐐 restantes</th>
                <th>Nota media</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const idx = playerIdx(r.id);
                return (
                  <tr
                    key={r.id}
                    className={`result-row ${r.id === me.id ? 'is-me' : ''} ${
                      i === 0 && n > 1 ? 'winner' : ''
                    }`}
                    style={{ '--d': `${delays[i]}ms`, '--pc': playerColor(idx) }}
                  >
                    <td className="rank">{MEDALS[i] || i + 1}</td>
                    <td className="rname">
                      <span className="rname-inner">
                        <Avatar name={r.name} index={idx} size={30} />
                        {r.name}
                        {r.id === me.id && <span className="you"> (tú)</span>}
                      </span>
                    </td>
                    <td>
                      <div className="vote-names">
                        {r.wonNames.map((nm) => (
                          <span key={nm} className="won-chip filled">
                            {nm}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{r.goatsLeft}</td>
                    <td className="avg">
                      {r.average != null ? (
                        <CountUp value={r.average} delay={delays[i] + 250} />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button className="btn btn-primary btn-big" onClick={onExit}>
          🐐 Volver al inicio
        </button>
      </div>
    </div>
  );
}
