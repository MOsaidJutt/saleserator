import React, { useEffect, useState } from 'react';
import api from '../../api';
import Nav from '../../components/Navbar';
import '../../components/useruistyles/Leaderboard.css'; // 👈 include this CSS

const PERIODS = ['daily', 'weekly', 'monthly', 'all'];

export default function Leaderboard() {
  const [period, setPeriod] = useState('daily'); // default Daily
  const [rows, setRows] = useState([]);
  const [label, setLabel] = useState('');
  const [asOf, setAsOf] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (p = period, refresh = false) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/users/leaderboard?period=${p}&limit=50&refresh=${refresh ? 1 : 0}`,
      );
      setRows(data.results || []);
      setLabel(data.label || p);
      setAsOf(data.asOf || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(period, true);
  }, [period]);

  return (
    <div>
      <Nav />
      <div className="page-root ldb-page">
        <div className="page-wrap ldb-wrap">
          <section className="ldb-panel">
            <div className="ldb-head">
              <div className="ldb-title-row">
                <h3 className="ldb-title">Leaderboard</h3>

                <div className="ldb-tabs">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      className={`ldb-tab ${period === p ? 'active' : ''}`}
                      onClick={() => setPeriod(p)}
                      disabled={loading}
                    >
                      {p[0].toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                  <button
                    className="ldb-btn ghost"
                    disabled={loading}
                    onClick={() => load(period, true)}
                  >
                    Refresh snapshot
                  </button>
                </div>
              </div>

              <div className="ldb-subtle">
                {label}{' '}
                {rows.length > 0 && (
                  <>
                    • Last updated:{' '}
                    {new Date(
                      rows[0].generated_at || asOf || Date.now(),
                    ).toLocaleString()}
                  </>
                )}
              </div>
            </div>

            <div className="ldb-body">
              {loading ? (
                <div className="ldb-loading">Loading…</div>
              ) : (
                <table className="ldb-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th className="right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={`${r.user_id}-${r.rank}`}
                        className={`ldb-row ${r.rank <= 3 ? `top-${r.rank}` : ''}`}
                      >
                        <td>
                          <span className="ldb-rank">{r.rank}</span>
                        </td>
                        <td className="ldb-user">{r.name}</td>
                        <td className="right">
                          <span className="ldb-points">{r.points}</span>
                        </td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={3} className="ldb-empty">
                          No data for this period yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
