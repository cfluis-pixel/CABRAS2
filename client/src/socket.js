import { io } from 'socket.io-client';

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
});

const KEY = 'cabras2-session';

export function saveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}
