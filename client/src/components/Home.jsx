import { useState } from 'react';
import { socket } from '../socket.js';

export default function Home({ onEnter, showToast }) {
  const [tab, setTab] = useState('join');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [namesText, setNamesText] = useState('');
  const [busy, setBusy] = useState(false);

  const namesList = namesText
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

  const create = () => {
    setBusy(true);
    socket.emit('room:create', { hostName: name, names: namesText }, (res) => {
      setBusy(false);
      if (res?.error) return showToast(res.error);
      onEnter(res);
    });
  };

  const join = () => {
    setBusy(true);
    socket.emit('room:join', { code, name }, (res) => {
      setBusy(false);
      if (res?.error) return showToast(res.error);
      onEnter(res);
    });
  };

  return (
    <div className="screen home">
      <div className="logo-block">
        <div className="logo-goats">🐐🐐</div>
        <h1 className="logo">CABRAS2</h1>
        <p className="tagline">Puja tus cabras. Gana los mejores nombres.</p>
      </div>

      <div className="card home-card">
        <div className="tabs">
          <button
            className={tab === 'join' ? 'tab active' : 'tab'}
            onClick={() => setTab('join')}
          >
            Unirme a partida
          </button>
          <button
            className={tab === 'create' ? 'tab active' : 'tab'}
            onClick={() => setTab('create')}
          >
            Crear partida
          </button>
        </div>

        <label className="field">
          <span>Tu nombre de jugador</span>
          <input
            value={name}
            maxLength={20}
            placeholder="Ej: Marta"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {tab === 'join' ? (
          <>
            <label className="field">
              <span>Código de partida</span>
              <input
                className="code-input"
                value={code}
                maxLength={5}
                placeholder="ABCDE"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <button
              className="btn btn-primary btn-big"
              disabled={busy || !name.trim() || !code.trim()}
              onClick={join}
            >
              Entrar 🚪
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span>
                Lista de nombres a subasta — uno por línea{' '}
                <b className={namesList.length > 100 ? 'over' : ''}>
                  ({namesList.length}/100)
                </b>
              </span>
              <textarea
                rows={8}
                value={namesText}
                placeholder={'Bartolo\nEsperanza\nCanelita\n…'}
                onChange={(e) => setNamesText(e.target.value)}
              />
            </label>
            <p className="hint">
              Cada jugador ganará exactamente 3 nombres: necesitas al menos 3 × nº de
              jugadores.
            </p>
            <button
              className="btn btn-primary btn-big"
              disabled={busy || !name.trim() || namesList.length < 3 || namesList.length > 100}
              onClick={create}
            >
              Crear partida 🎉
            </button>
          </>
        )}
      </div>
    </div>
  );
}
