import { socket } from '../socket.js';

export default function Lobby({ room, me, showToast, onExit }) {
  const isHost = me.id === room.hostId;
  const allReady = room.players.every((p) => p.ready);
  const needed = room.players.length * 3;
  const enoughNames = room.namesTotal >= needed;
  const canStart = isHost && allReady && enoughNames && room.players.length <= 18;

  const toggleReady = () => {
    socket.emit('player:ready', { ready: !me.ready }, (res) => {
      if (res?.error) showToast(res.error);
    });
  };

  const start = () => {
    socket.emit('game:start', {}, (res) => {
      if (res?.error) showToast(res.error);
    });
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="logo logo-small">CABRAS2 🐐</h1>
        <button className="btn btn-ghost" onClick={onExit}>
          Salir
        </button>
      </header>

      <div className="card lobby-card">
        <p className="code-label">Código de partida — compártelo con tus amigos</p>
        <div className="room-code">{room.code}</div>

        <div className="lobby-meta">
          <span className="pill">👥 {room.players.length}/18 jugadores</span>
          <span className={`pill ${enoughNames ? '' : 'pill-warn'}`}>
            📜 {room.namesTotal} nombres {enoughNames ? '' : `(faltan ${needed - room.namesTotal})`}
          </span>
          <span className="pill">🐐 20 cabras por jugador</span>
        </div>

        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id} className="player-row">
              <span className="player-name">
                {p.isHost && <span title="Anfitrión">👑 </span>}
                {p.name}
                {p.id === me.id && <span className="you"> (tú)</span>}
              </span>
              <span className={p.ready ? 'ready yes' : 'ready no'}>
                {p.isHost ? 'Anfitrión' : p.ready ? '✅ Listo' : '⏳ Esperando'}
              </span>
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <button className="btn btn-primary btn-big" disabled={!canStart} onClick={start}>
              🚀 Iniciar partida
            </button>
            {!allReady && (
              <p className="hint">Esperando a que todos pulsen «Estoy listo»…</p>
            )}
            {!enoughNames && (
              <p className="hint warn">
                No hay nombres suficientes para {room.players.length} jugadores.
              </p>
            )}
          </>
        ) : (
          <button
            className={`btn btn-big ${me.ready ? 'btn-ghost' : 'btn-primary'}`}
            onClick={toggleReady}
          >
            {me.ready ? '↩️ No estoy listo' : '✋ ¡Estoy listo!'}
          </button>
        )}
      </div>
    </div>
  );
}
