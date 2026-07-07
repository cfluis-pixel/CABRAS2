import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// Tiempos (ms) — configurables por env para poder acelerar tests
const SPIN_MS = Number(process.env.SPIN_MS) || 4500;
const INITIAL_TIMER_MS = Number(process.env.INITIAL_TIMER_MS) || 15000;
const BID_RESET_MS = Number(process.env.BID_RESET_MS) || 10000;
const REVEAL_MS = Number(process.env.REVEAL_MS) || 3500;

const STARTING_GOATS = 20;
const NAMES_PER_PLAYER = 3;
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 18;
const MAX_NAMES = 100;

// Sin caracteres confusos: O, 0, I, l, 1
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.get('/', (_req, res) => res.json({ ok: true, game: 'CABRAS2' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

/** @type {Map<string, object>} código de sala -> estado de la sala */
const rooms = new Map();

// ---------- Logs ----------

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function logEvent(emoji, code, player, message, color = C.cyan) {
  const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
  const parts = [
    `${C.dim}${time}${C.reset}`,
    emoji,
    code ? `${C.magenta}[${code}]${C.reset}` : null,
    player ? `${C.bold}${player}${C.reset}` : null,
    `${color}${message}${C.reset}`,
  ].filter(Boolean);
  console.log(parts.join(' '));
}

function makeCode() {
  let code;
  do {
    code = Array.from({ length: CODE_LENGTH }, () =>
      CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitize(room) {
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    wheelMode: room.wheelMode,
    namesTotal: room.names.length,
    namesLeft: room.names.filter((n) => !n.wonBy).length,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      goats: p.goats,
      ready: p.ready,
      connected: p.connected,
      wonNames: p.wonNames,
      isHost: p.id === room.hostId,
      locked: p.wonNames.length >= NAMES_PER_PLAYER,
    })),
    round: room.round
      ? {
          name: room.round.name ? room.round.name.text : null,
          turnPlayerId: room.round.turnPlayerId,
          pool: room.round.pool,
          spinEndsAt: room.round.spinEndsAt,
          endsAt: room.round.endsAt,
          highestBid: room.round.highestBid,
          number: room.round.number,
        }
      : null,
    lastResult: room.lastResult,
    voted: Object.keys(room.votes || {}),
    results: room.results || null,
  };
}

function broadcast(room) {
  io.to(room.code).emit('room:state', { state: sanitize(room), serverTime: Date.now() });
}

function setRoomTimeout(room, ms, fn) {
  clearTimeout(room.timer);
  room.timer = setTimeout(fn, ms);
}

function destroyRoom(room) {
  clearTimeout(room.timer);
  rooms.delete(room.code);
}

function getContext(socket) {
  const { code, playerId } = socket.data || {};
  const room = rooms.get(code);
  const player = room?.players.get(playerId);
  return { room, player };
}

// ---------- Flujo de partida ----------

function currentTurnPlayer(room) {
  const order = room.turnOrder;
  for (let i = 0; i < order.length; i++) {
    const idx = (room.turnIdx + i) % order.length;
    const p = room.players.get(order[idx]);
    if (p && p.wonNames.length < NAMES_PER_PLAYER) {
      room.turnIdx = idx;
      return p;
    }
  }
  return null;
}

function startRound(room) {
  const available = room.names.filter((n) => !n.wonBy);
  const turnPlayer = currentTurnPlayer(room);
  if (!turnPlayer || available.length === 0) {
    startVoting(room);
    return;
  }
  room.roundNumber = (room.roundNumber || 0) + 1;
  // El nombre no se elige hasta que la ruleta gira (en manual podría tardar)
  room.round = {
    name: null,
    number: room.roundNumber,
    turnPlayerId: turnPlayer.id,
    pool: available.map((n) => n.text),
    spinEndsAt: null,
    endsAt: null,
    highestBid: null,
  };
  if (room.wheelMode === 'manual') {
    // Modo manual: espera a que el jugador de turno emita wheel:spin
    room.phase = 'waitSpin';
    broadcast(room);
    return;
  }
  beginSpin(room);
}

function beginSpin(room) {
  const available = room.names.filter((n) => !n.wonBy);
  room.round.name = available[crypto.randomInt(available.length)];
  room.phase = 'spin';
  room.round.spinEndsAt = Date.now() + SPIN_MS;
  room.round.endsAt = Date.now() + SPIN_MS + INITIAL_TIMER_MS;
  broadcast(room);
  setRoomTimeout(room, SPIN_MS, () => {
    room.phase = 'bidding';
    room.round.endsAt = Date.now() + INITIAL_TIMER_MS;
    broadcast(room);
    setRoomTimeout(room, INITIAL_TIMER_MS, () => resolveRound(room));
  });
}

function resolveRound(room) {
  const r = room.round;
  if (!r) return;
  let winner, amount, free;
  if (r.highestBid) {
    winner = room.players.get(r.highestBid.playerId);
    amount = r.highestBid.amount;
    free = false;
  } else {
    winner = room.players.get(r.turnPlayerId);
    amount = 0;
    free = true;
  }
  winner.goats -= amount;
  winner.wonNames.push(r.name.text);
  r.name.wonBy = winner.id;
  room.lastResult = {
    winnerId: winner.id,
    winnerName: winner.name,
    name: r.name.text,
    amount,
    free,
  };
  room.round = null;
  room.phase = 'reveal';
  room.turnIdx = (room.turnIdx + 1) % room.turnOrder.length;
  broadcast(room);

  const done = [...room.players.values()].every(
    (p) => p.wonNames.length >= NAMES_PER_PLAYER
  );
  setRoomTimeout(room, REVEAL_MS, () => {
    room.lastResult = null;
    if (done) startVoting(room);
    else startRound(room);
  });
}

function startVoting(room) {
  room.phase = 'voting';
  room.votes = {};
  broadcast(room);
  if (room.players.size < 2) finishGame(room);
}

function checkVotesComplete(room) {
  if (room.phase !== 'voting') return;
  const connected = [...room.players.values()].filter((p) => p.connected);
  if (connected.length > 0 && connected.every((p) => room.votes[p.id])) {
    finishGame(room);
  }
}

function finishGame(room) {
  const totals = {};
  const counts = {};
  for (const scores of Object.values(room.votes || {})) {
    for (const [targetId, score] of Object.entries(scores)) {
      totals[targetId] = (totals[targetId] || 0) + score;
      counts[targetId] = (counts[targetId] || 0) + 1;
    }
  }
  room.results = [...room.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      wonNames: p.wonNames,
      goatsLeft: p.goats,
      average:
        counts[p.id] != null
          ? Math.round((totals[p.id] / counts[p.id]) * 100) / 100
          : null,
    }))
    .sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  room.phase = 'results';
  const podium = room.results
    .map((r, i) => `${i + 1}º ${r.name} (${r.average != null ? r.average.toFixed(2) : '—'})`)
    .join(' · ');
  logEvent('🏆', room.code, null, `partida terminada — ${podium}`, C.green);
  broadcast(room);
}

// ---------- Sockets ----------

io.on('connection', (socket) => {
  socket.on('room:create', ({ hostName, names, wheelMode } = {}, cb) => {
    hostName = String(hostName || '').trim().slice(0, 20);
    if (!hostName) return cb?.({ error: 'Introduce tu nombre de jugador' });

    const list = [
      ...new Set(
        (Array.isArray(names) ? names : String(names || '').split('\n'))
          .map((n) => String(n).trim().slice(0, 40))
          .filter(Boolean)
      ),
    ];
    if (list.length < NAMES_PER_PLAYER)
      return cb?.({ error: `Necesitas al menos ${NAMES_PER_PLAYER} nombres` });
    if (list.length > MAX_NAMES)
      return cb?.({ error: `Máximo ${MAX_NAMES} nombres (tienes ${list.length})` });

    const code = makeCode();
    const playerId = crypto.randomUUID();
    const room = {
      code,
      hostId: playerId,
      phase: 'lobby',
      wheelMode: wheelMode === 'manual' ? 'manual' : 'auto',
      players: new Map(),
      names: list.map((text, i) => ({ id: i + 1, text, wonBy: null })),
      turnOrder: [],
      turnIdx: 0,
      roundNumber: 0,
      round: null,
      lastResult: null,
      votes: {},
      results: null,
      timer: null,
    };
    room.players.set(playerId, {
      id: playerId,
      socketId: socket.id,
      name: hostName,
      goats: STARTING_GOATS,
      wonNames: [],
      ready: true, // el anfitrión siempre cuenta como listo
      connected: true,
    });
    rooms.set(code, room);
    socket.data = { code, playerId };
    socket.join(code);
    logEvent('🆕', code, hostName, `creó la sala con ${list.length} nombres`, C.green);
    cb?.({ ok: true, code, playerId });
    broadcast(room);
  });

  socket.on('room:join', ({ code, name } = {}, cb) => {
    code = String(code || '').trim().toUpperCase();
    name = String(name || '').trim().slice(0, 20);
    const room = rooms.get(code);
    if (!room) return cb?.({ error: 'Partida no encontrada. Revisa el código.' });
    if (!name) return cb?.({ error: 'Introduce tu nombre de jugador' });

    const existing = [...room.players.values()].find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing && existing.connected)
      return cb?.({ error: 'Ese nombre ya está en uso en la partida' });

    if (existing && !existing.connected) {
      // Retomar el asiento de un jugador desconectado (mismo nombre)
      existing.connected = true;
      existing.socketId = socket.id;
      socket.data = { code, playerId: existing.id };
      socket.join(code);
      logEvent('🔁', code, existing.name, 'se reconectó a la partida', C.yellow);
      cb?.({ ok: true, code, playerId: existing.id });
      broadcast(room);
      return;
    }

    if (room.phase !== 'lobby')
      return cb?.({ error: 'La partida ya ha empezado' });
    if (room.players.size >= MAX_PLAYERS)
      return cb?.({ error: `La partida está llena (máx. ${MAX_PLAYERS})` });

    const playerId = crypto.randomUUID();
    room.players.set(playerId, {
      id: playerId,
      socketId: socket.id,
      name,
      goats: STARTING_GOATS,
      wonNames: [],
      ready: false,
      connected: true,
    });
    socket.data = { code, playerId };
    socket.join(code);
    logEvent('🚪', code, name, `se unió a la sala (${room.players.size} jugadores)`, C.green);
    cb?.({ ok: true, code, playerId });
    broadcast(room);
  });

  socket.on('room:rejoin', ({ code, playerId } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase());
    const player = room?.players.get(playerId);
    if (!room || !player) return cb?.({ error: 'La partida ya no existe' });
    player.connected = true;
    player.socketId = socket.id;
    socket.data = { code: room.code, playerId };
    socket.join(room.code);
    logEvent('🔁', room.code, player.name, 'se reconectó a la partida', C.yellow);
    cb?.({ ok: true, code: room.code, playerId });
    broadcast(room);
  });

  socket.on('player:ready', ({ ready } = {}, cb) => {
    const { room, player } = getContext(socket);
    if (!room || !player || room.phase !== 'lobby') return cb?.({ error: 'No disponible' });
    if (player.id === room.hostId) return cb?.({ error: 'El anfitrión no necesita estar listo' });
    player.ready = Boolean(ready);
    cb?.({ ok: true });
    broadcast(room);
  });

  socket.on('room:settings', ({ wheelMode } = {}, cb) => {
    const { room, player } = getContext(socket);
    if (!room || !player) return cb?.({ error: 'No estás en ninguna partida' });
    if (player.id !== room.hostId)
      return cb?.({ error: 'Solo el anfitrión puede cambiar los ajustes' });
    if (room.phase !== 'lobby')
      return cb?.({ error: 'Los ajustes solo se cambian en la sala de espera' });
    if (wheelMode !== 'auto' && wheelMode !== 'manual')
      return cb?.({ error: 'Modo de ruleta inválido' });
    room.wheelMode = wheelMode;
    cb?.({ ok: true });
    broadcast(room);
  });

  socket.on('wheel:spin', (_payload, cb) => {
    const { room, player } = getContext(socket);
    if (!room || !player) return cb?.({ error: 'No estás en ninguna partida' });
    if (room.phase !== 'waitSpin')
      return cb?.({ error: 'La ruleta no se puede girar ahora' });
    if (player.id !== room.round.turnPlayerId)
      return cb?.({ error: 'Solo el jugador de turno puede girar la ruleta' });
    cb?.({ ok: true });
    beginSpin(room);
  });

  socket.on('game:start', (_payload, cb) => {
    const { room, player } = getContext(socket);
    if (!room || !player) return cb?.({ error: 'No estás en ninguna partida' });
    if (player.id !== room.hostId) return cb?.({ error: 'Solo el anfitrión puede iniciar' });
    if (room.phase !== 'lobby') return cb?.({ error: 'La partida ya ha empezado' });

    const players = [...room.players.values()];
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS)
      return cb?.({ error: `Se necesitan entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores` });
    if (!players.every((p) => p.ready))
      return cb?.({ error: 'Todos los jugadores deben pulsar "Estoy listo"' });
    if (room.names.length < players.length * NAMES_PER_PLAYER)
      return cb?.({
        error: `Faltan nombres: hay ${room.names.length} y se necesitan ${players.length * NAMES_PER_PLAYER} (3 por jugador)`,
      });

    room.turnOrder = shuffle(players.map((p) => p.id));
    room.turnIdx = 0;
    logEvent('🚀', room.code, player.name, `inició la partida con ${players.length} jugadores`, C.green);
    cb?.({ ok: true });
    startRound(room);
  });

  socket.on('bid', ({ amount } = {}, cb) => {
    const { room, player } = getContext(socket);
    if (!room || !player) return cb?.({ error: 'No estás en ninguna partida' });
    if (room.phase !== 'bidding') return cb?.({ error: 'Ahora no se puede pujar' });
    if (player.wonNames.length >= NAMES_PER_PLAYER)
      return cb?.({ error: 'Ya tienes 3 nombres, estás bloqueado' });

    amount = Math.floor(Number(amount));
    if (!Number.isFinite(amount) || amount < 1)
      return cb?.({ error: 'Puja inválida' });

    const highest = room.round.highestBid;
    if (highest && highest.playerId === player.id)
      return cb?.({ error: 'Ya tienes la puja más alta' });
    const min = (highest?.amount ?? 0) + 1;
    if (amount < min) return cb?.({ error: `La puja mínima es ${min} 🐐` });
    if (amount > player.goats)
      return cb?.({ error: `Solo tienes ${player.goats} 🐐` });

    room.round.highestBid = { playerId: player.id, playerName: player.name, amount };
    room.round.endsAt = Date.now() + BID_RESET_MS;
    setRoomTimeout(room, BID_RESET_MS, () => resolveRound(room));
    cb?.({ ok: true });
    broadcast(room);
  });

  socket.on('vote', ({ scores } = {}, cb) => {
    const { room, player } = getContext(socket);
    if (!room || !player) return cb?.({ error: 'No estás en ninguna partida' });
    if (room.phase !== 'voting') return cb?.({ error: 'Ahora no se puede votar' });
    if (room.votes[player.id]) return cb?.({ error: 'Ya has votado' });

    const others = [...room.players.keys()].filter((id) => id !== player.id);
    const clean = {};
    for (const id of others) {
      const calidad = Math.round(Number(scores?.[id]?.calidad));
      const quimica = Math.round(Number(scores?.[id]?.quimica));
      if (![calidad, quimica].every((s) => Number.isFinite(s) && s >= 1 && s <= 10))
        return cb?.({ error: 'Puntúa Calidad y Química de todos los jugadores del 1 al 10' });
      // La nota de este voto es la media de las dos puntuaciones
      clean[id] = (calidad + quimica) / 2;
    }
    room.votes[player.id] = clean;
    cb?.({ ok: true });
    broadcast(room);
    checkVotesComplete(room);
  });

  socket.on('room:leave', (_payload, cb) => {
    const { room, player } = getContext(socket);
    socket.data = {};
    cb?.({ ok: true });
    if (!room || !player) return;
    socket.leave(room.code);
    handleDeparture(room, player, socket.id, true);
  });

  socket.on('disconnect', () => {
    const { room, player } = getContext(socket);
    if (!room || !player || player.socketId !== socket.id) return;
    handleDeparture(room, player, socket.id, false);
  });
});

function handleDeparture(room, player, socketId, explicit) {
  player.connected = false;
  logEvent('👋', room.code, player.name, explicit ? 'salió de la partida' : 'se desconectó', C.red);
  if (room.phase === 'lobby') {
    if (player.id === room.hostId) {
      io.to(room.code).emit('room:closed', { reason: 'El anfitrión ha cerrado la partida' });
      logEvent('💥', room.code, null, 'sala cerrada (el anfitrión se fue del lobby)', C.red);
      destroyRoom(room);
      return;
    }
    room.players.delete(player.id);
  } else {
    if ([...room.players.values()].every((p) => !p.connected)) {
      logEvent('💥', room.code, null, 'sala eliminada (todos desconectados)', C.red);
      destroyRoom(room);
      return;
    }
    if (room.phase === 'voting') checkVotesComplete(room);
    // En modo manual, si el jugador de turno se va sin girar, gira el servidor
    if (room.phase === 'waitSpin' && room.round?.turnPlayerId === player.id) {
      beginSpin(room);
      return;
    }
  }
  broadcast(room);
}

server.listen(PORT, () => {
  console.log(`🐐 CABRAS2 server escuchando en http://localhost:${PORT}`);
});
