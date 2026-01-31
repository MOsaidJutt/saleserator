import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../../api';
import '../../components/adminuistyles/AdminLeaderboarduser.css'; // Custom CSS file
import Navbar from '../../components/Navbar';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function LeaderboardUser() {
  const { userId } = useParams();
  const query = useQuery();
  const today = new Date().toISOString().slice(0, 10);

  const [start, setStart] = useState(query.get('start') || today);
  const [end, setEnd] = useState(query.get('end') || today);
  const [user, setUser] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadUserData() {
    setLoading(true);
    try {
      const res = await api.get(`/admin/leaderboard/user/${userId}`, {
        params: { start, end },
      });
      setUser(res.data.user || null);
      setBreakdown(res.data.breakdown || []);
      setRecent(res.data.recent || []);
    } catch (e) {
      alert(e.message || 'Failed to load user activity');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserData();
  }, [userId, start, end]);

  return (
    <div>
      <Navbar />
      <div className="leaderboard-user-page">
        <div className="leaderboard-user-content">
          <h1 className="page-title">
            User Activity
            {user && (
              <span className="subtitle">
                {' '}
                – {user.name} ({user.email})
              </span>
            )}
          </h1>
          <Link to="/admin/leaderboard" className="link">
            ← Back to Leaderboard
          </Link>

          {/* Filter bar matching the Leaderboard Page */}
          <div className="filter-container">
            <div>
              <label className="filter-label">Start</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="filter-input"
              />
            </div>
            <div>
              <label className="filter-label">End</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="filter-input"
              />
            </div>
            <button
              className="filter-button"
              onClick={loadUserData}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Reload'}
            </button>
          </div>

          {/* Activity Breakdown Table */}
          <div className="card">
            <div className="card-header">Activity Breakdown</div>
            <table className="user-table">
              <thead>
                <tr>
                  <th>Activity Type</th>
                  <th className="right">Count</th>
                  <th className="right">Total Points</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((row) => (
                  <tr key={row.activity_type}>
                    <td>{row.activity_type}</td>
                    <td className="right">{row.count}</td>
                    <td className="right">{row.total_points}</td>
                  </tr>
                ))}
                {!breakdown.length && (
                  <tr>
                    <td colSpan="3" className="empty">
                      No activity in this range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent Activities Table */}
          <div className="card">
            <div className="card-header">Recent Activities</div>
            <table className="user-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Activity Type</th>
                  <th>Value</th>
                  <th className="right">Points</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.activity_id}>
                    <td>
                      {a.date_logged &&
                        new Date(a.date_logged).toLocaleDateString()}
                    </td>
                    <td>{a.activity_type}</td>
                    <td>{a.value}</td>
                    <td className="right">{a.points}</td>
                    <td>
                      {a.updated_at && new Date(a.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!recent.length && (
                  <tr>
                    <td colSpan="5" className="empty">
                      No recent activities
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
