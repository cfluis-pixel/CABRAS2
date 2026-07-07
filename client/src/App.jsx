import { useEffect, useRef, useState } from 'react';
import { socket, loadSession, saveSession, clearSession } from './socket.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import Voting from './components/Voting.jsx';
import Results from './components/Results.jsx';

export default function App() {
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(() => loadSession()?.playerId ?? null);
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState(null);
  // Diferencia reloj servidor - reloj local, para sincronizar el timer
  const clockOffset = useRef(0);
  const toastTimer = useRef(null);

  const showToast = (msg, kind = 'error') => {
    setToast({ msg, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    function onState({ state, serverTime }) {
      clockOffset.current = serverTime - Date.now();
      setRoom(state);
    }
    function onClosed({ reason } = {}) {
      setRoom(null);
      setPlayerId(null);
      clearSession();
      showToast(reason || 'La partida se ha cerrado', 'info');
    }
    function onConnect() {
      setConnected(true);
      const session = loadSession();
      if (session?.code && session?.playerId) {
        socket.emit('room:rejoin', session, (res) => {
          if (res?.error) {
            clearSession();
            setPlayerId(null);
            setRoom(null);
          } else {
            setPlayerId(session.playerId);
          }
        });
      }
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const handleEnter = ({ code, playerId }) => {
    saveSession({ code, playerId });
    setPlayerId(playerId);
  };

  const handleExit = () => {
    socket.emit('room:leave');
    clearSession();
    setPlayerId(null);
    setRoom(null);
  };

  const me = room?.players.find((p) => p.id === playerId) || null;

  let screen;
  let phaseKey;
  if (!room || !me) {
    phaseKey = 'home';
    screen = <Home onEnter={handleEnter} showToast={showToast} />;
  } else if (room.phase === 'lobby') {
    phaseKey = 'lobby';
    screen = <Lobby room={room} me={me} showToast={showToast} onExit={handleExit} />;
  } else if (room.phase === 'voting') {
    phaseKey = 'voting';
    screen = <Voting room={room} me={me} showToast={showToast} />;
  } else if (room.phase === 'results') {
    phaseKey = 'results';
    screen = <Results room={room} me={me} onExit={handleExit} />;
  } else {
    phaseKey = 'game';
    screen = (
      <Game
        room={room}
        me={me}
        showToast={showToast}
        clockOffset={clockOffset}
        onExit={handleExit}
      />
    );
  }

  return (
    <div className="app">
      {!connected && <div className="conn-banner">🔌 Reconectando con el servidor…</div>}
      {/* key por fase: cada pantalla entra con crossfade + deslizamiento */}
      <div className="phase-wrap" key={phaseKey}>
        {screen}
      </div>
      {toast && <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
