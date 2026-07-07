# 🐐 CABRAS2

Juego web multijugador en tiempo real de subastas de nombres. Cada jugador empieza con **20 cabras** y debe conseguir exactamente **3 nombres** pujando contra los demás. Al final, todos votan los nombres de los demás y gana quien tenga mejor nota media.

## Stack

- **Backend** (`/server`): Node.js + Express + Socket.io
- **Frontend** (`/client`): React + Vite + socket.io-client

Todo el estado del juego vive en el servidor (autoritativo) y se sincroniza en tiempo real a todos los dispositivos vía WebSockets: sala de espera, ruleta, timer, pujas, cabras y nombres ganados. Nadie necesita refrescar la página en ningún momento. El timer se sincroniza enviando *timestamps* del servidor, de modo que todos los dispositivos ven exactamente el mismo tiempo restante.

## Cómo se juega

1. El anfitrión crea la partida con una lista de hasta 100 nombres (mínimo 3 por jugador).
2. Comparte el código de 5 caracteres (sin caracteres confusos: nunca verás `O`, `0`, `I`, `l` ni `1`).
3. Los invitados se unen con el código y pulsan **«Estoy listo»**. Cuando todos están listos, el anfitrión pulsa **«Iniciar partida»** (de 1 a 18 jugadores).
4. En cada ronda la ruleta elige un nombre al azar. Timer inicial de **15 s**; cada puja lo reinicia a **10 s**. Si nadie puja, el jugador de turno se lleva el nombre **gratis**.
5. Cuando todos tienen 3 nombres, se abre la votación (0–10 al trío de cada rival) y se muestra el ranking final por nota media.

---

## 🚀 Ejecutar en local

Requisitos: **Node.js 18.11+** (recomendado 20+).

### 1. Backend

```bash
cd server
npm install
npm run dev
```

El servidor arranca en `http://localhost:3001` (configurable en `server/.env`):

```env
PORT=3001
CLIENT_ORIGIN=*
```

### 2. Frontend

En otra terminal:

```bash
cd client
npm install
npm run dev
```

Abre `http://localhost:5173`. La URL del backend se configura en `client/.env`:

```env
VITE_SERVER_URL=http://localhost:3001
```

> 💡 Para probar en varios dispositivos de tu red local, arranca Vite con `npm run dev -- --host` y pon en `client/.env` la IP local de tu ordenador (ej. `VITE_SERVER_URL=http://192.168.1.50:3001`).

---

## ☁️ Despliegue

### Backend en Railway

1. Sube el repositorio a GitHub.
2. En [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. En **Settings → Root Directory** pon `server`.
4. Railway detecta Node automáticamente (`npm install` + `npm start`).
5. En **Variables** añade:
   - `CLIENT_ORIGIN` = URL de tu frontend en Vercel (ej. `https://cabras2.vercel.app`)
   - `PORT` no hace falta: Railway lo inyecta automáticamente y el servidor lo lee de `process.env.PORT`.
6. En **Settings → Networking → Generate Domain** para obtener la URL pública (ej. `https://cabras2-server.up.railway.app`).

### Frontend en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** e importa el mismo repositorio.
2. En **Root Directory** selecciona `client`.
3. Vercel detecta Vite automáticamente (`npm run build`, salida en `dist`).
4. En **Environment Variables** añade:
   - `VITE_SERVER_URL` = URL pública del backend en Railway (ej. `https://cabras2-server.up.railway.app`)
5. Deploy. ¡Listo! 🐐

> ⚠️ Si cambias la URL del backend, recuerda actualizar `VITE_SERVER_URL` en Vercel y **redeployar** (las variables `VITE_*` se inyectan en build).

---

## Estructura

```
CABRAS2/
├── server/            # Backend Node + Socket.io (estado autoritativo del juego)
│   ├── index.js       # Salas, rondas, pujas, timers, votación
│   ├── .env           # PORT y CLIENT_ORIGIN
│   └── package.json
├── client/            # Frontend React + Vite
│   ├── .env           # VITE_SERVER_URL
│   └── src/
│       ├── App.jsx            # Enrutado por fase de juego + reconexión
│       ├── socket.js          # Conexión Socket.io + sesión
│       └── components/
│           ├── Home.jsx       # Crear / unirse
│           ├── Lobby.jsx      # Sala de espera, código, "Estoy listo"
│           ├── Game.jsx       # Pantalla de juego (timer, pujas, jugadores)
│           ├── Wheel.jsx      # Ruleta estilo casino
│           ├── Voting.jsx     # Votación 0-10
│           └── Results.jsx    # Ranking final
└── README.md
```

## Detalles técnicos de sincronización

- El servidor emite el estado completo de la sala (`room:state`) en cada cambio, junto con `serverTime`. El cliente calcula el *offset* entre su reloj y el del servidor y pinta el timer contra el `endsAt` del servidor → todos los dispositivos ven el mismo tiempo.
- Los timers de ronda corren **solo en el servidor** (`setTimeout` autoritativo): el fin de ronda, la asignación del nombre y el avance a la siguiente ronda ocurren en el servidor y se difunden a todos a la vez.
- La ruleta usa el nombre elegido por el servidor: la animación es local pero el resultado es idéntico en todos los dispositivos.
- Si un jugador refresca la página o pierde la conexión, se reincorpora automáticamente a su asiento (sesión guardada en `sessionStorage`).
