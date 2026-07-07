import { useState } from 'react';
import { socket } from '../socket.js';
import Avatar from './Avatar.jsx';

const CRITERIA = [
  { key: 'calidad', label: '✨ Calidad' },
  { key: 'quimica', label: '⚗️ Química' },
];

export default function Voting({ room, me, showToast }) {
  const others = room.players.filter((p) => p.id !== me.id);
  const [scores, setScores] = useState(() =>
    Object.fromEntries(others.map((p) => [p.id, { calidad: 5, quimica: 5 }]))
  );
  const [sent, setSent] = useState(room.voted.includes(me.id));

  const alreadyVoted = sent || room.voted.includes(me.id);
  const votedCount = room.voted.length;
  const connectedCount = room.players.filter((p) => p.connected).length;

  const setScore = (playerId, key, value) =>
    setScores((s) => ({ ...s, [playerId]: { ...s[playerId], [key]: value } }));

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
          Puntúa del 1 al 10 la <b>Calidad</b> y la <b>Química</b> del trío de nombres
          de cada jugador. Su nota será la media de ambas. No puedes puntuarte a ti
          mismo.
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
                  <b className="vote-who-name">
                    <Avatar
                      name={p.name}
                      index={room.players.findIndex((x) => x.id === p.id)}
                      size={30}
                    />
                    {p.name}
                  </b>
                  <div className="vote-names">
                    {p.wonNames.map((n) => (
                      <span key={n} className="won-chip filled">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sliders">
                  {CRITERIA.map(({ key, label }) => (
                    <label key={key} className="slider-row">
                      <span className="slider-label">{label}</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        disabled={alreadyVoted}
                        value={scores[p.id][key]}
                        onChange={(e) => setScore(p.id, key, Number(e.target.value))}
                      />
                      <span className="slider-value">{scores[p.id][key]}</span>
                    </label>
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
          <button className="btn btn-primary btn-big" onClick={submit}>
            Enviar puntuaciones
          </button>
        )}
      </div>
    </div>
  );
}
