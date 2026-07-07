const MEDALS = ['🥇', '🥈', '🥉'];

export default function Results({ room, me, onExit }) {
  const results = room.results || [];

  return (
    <div className="screen">
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
              {results.map((r, i) => (
                <tr key={r.id} className={r.id === me.id ? 'is-me' : ''}>
                  <td className="rank">{MEDALS[i] || i + 1}</td>
                  <td className="rname">
                    {r.name}
                    {r.id === me.id && <span className="you"> (tú)</span>}
                  </td>
                  <td>
                    <div className="vote-names">
                      {r.wonNames.map((n) => (
                        <span key={n} className="won-chip filled">
                          {n}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{r.goatsLeft}</td>
                  <td className="avg">{r.average != null ? r.average.toFixed(2) : '—'}</td>
                </tr>
              ))}
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
