import { useState } from 'react';
import { socket } from '../socket.js';
import Avatar from './Avatar.jsx';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para contextos no seguros (http en red local)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function Lobby({ room, me, showToast, onExit }) {
  const [copied, setCopied] = useState(false);
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

  const setWheelMode = (wheelMode) => {
    if (wheelMode === room.wheelMode) return;
    socket.emit('room:settings', { wheelMode }, (res) => {
      if (res?.error) showToast(res.error);
    });
  };

  const copyInvite = async () => {
    const url = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;
    const ok = await copyText(url);
    if (!ok) return showToast('No se pudo copiar el link');
    setCopied(true);
    showToast('Link de invitación copiado 📋', 'info');
    setTimeout(() => setCopied(false), 2500);
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
        <button className="btn btn-ghost invite-btn" onClick={copyInvite}>
          {copied ? '✅ ¡Copiado!' : '🔗 Copiar link de invitación'}
        </button>

        <div className="lobby-meta">
          <span className="pill">👥 {room.players.length}/18 jugadores</span>
          <span className={`pill ${enoughNames ? '' : 'pill-warn'}`}>
            📜 {room.namesTotal} nombres {enoughNames ? '' : `(faltan ${needed - room.namesTotal})`}
          </span>
          <span className="pill">🐐 20 cabras por jugador</span>
        </div>

        <ul className="player-list">
          {room.players.map((p, idx) => (
            <li key={p.id} className="player-row">
              <span className="player-name">
                <Avatar name={p.name} index={idx} size={32} />
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
            <div className="mode-row">
              <span className="mode-label">Ruleta</span>
              <div className="mode-toggle">
                <button
                  className={room.wheelMode === 'auto' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setWheelMode('auto')}
                >
                  Automática
                </button>
                <button
                  className={room.wheelMode === 'manual' ? 'mode-btn active' : 'mode-btn'}
                  onClick={() => setWheelMode('manual')}
                >
                  Manual
                </button>
              </div>
              <span className="hint mode-hint">
                {room.wheelMode === 'auto'
                  ? 'La ruleta gira sola al inicio de cada ronda'
                  : 'El jugador de turno debe pulsar «Girar ruleta»'}
              </span>
            </div>
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
