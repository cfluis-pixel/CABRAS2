import { useState } from 'react';
import { socket } from '../socket.js';

export default function Voting({ room, me, showToast }) {
  const others = room.players.filter((p) => p.id !== me.id);
  const [scores, setScores] = useState({});
  const [sent, setSent] = useState(room.voted.includes(me.id));

  const alreadyVoted = sent || room.voted.includes(me.id);
  const complete = others.every((p) => scores[p.id] != null);
  const votedCount = room.voted.length;
  const connectedCount = room.players.filter((p) => p.connected).length;

  const submit = () => {
    socket.emit('vote', { scores }, (res) => {
      if (res?.error) return showToast(res.error);
      setSent(true);
    });
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="logo logo-small">CABRAS2 🐐</h1>
        <span className="pill mono">{room.code}</span>
      </header>

      <div className="card voting-card">
        <h2>🗳️ ¡Hora de juzgar!</h2>
        <p className="hint">
          Puntúa del 0 al 10 el trío de nombres de cada jugador. No puedes puntuarte a
          ti mismo.
        </p>

        <div className="vote-mine">
          <span className="vote-mine-label">Tus nombres:</span>
          {me.wonNames.map((n) => (
            <span key={n} className="won-chip filled">
              {n}
            </span>
          ))}
        </div>

        {others.length === 0 ? (
          <p className="hint">Has jugado en solitario, no hay a quién puntuar 🐐</p>
        ) : (
          <ul className="vote-list">
            {others.map((p) => (
              <li key={p.id} className="vote-row">
                <div className="vote-who">
                  <b>{p.name}</b>
                  <div className="vote-names">
                    {p.wonNames.map((n) => (
                      <span key={n} className="won-chip filled">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="score-buttons">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      disabled={alreadyVoted}
                      className={`score-btn ${scores[p.id] === i ? 'picked' : ''}`}
                      onClick={() => setScores((s) => ({ ...s, [p.id]: i }))}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {alreadyVoted ? (
          <p className="hint">
            ✅ Voto enviado. Esperando al resto… ({votedCount}/{connectedCount})
          </p>
        ) : (
          <button
            className="btn btn-primary btn-big"
            disabled={!complete}
            onClick={submit}
          >
            Enviar puntuaciones ({Object.keys(scores).length}/{others.length})
          </button>
        )}
      </div>
    </div>
  );
}
