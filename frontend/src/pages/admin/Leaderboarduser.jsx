import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import '../../components/adminuistyles/AdminLeaderboarduser.css';
import Navbar from '../../components/Navbar';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function LeaderboardUser() {
  const { user: authUser } = useAuth();
  const slug = authUser?.company_slug;
  const { userId } = useParams();
  const query = useQuery();
  const today = new Date().toISOString().slice(0, 10);

  const [start, setStart] = useState(query.get('start') || today);
  const [end, setEnd] = useState(query.get('end') || today);
  const [user, setUser] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentPage, setRecentPage] = useState(1);
  const RECENT_PER_PAGE = 15;

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
          <Link to={`/${slug}/admin/leaderboard`} className="lb-back-btn">
            ← Back to Leaderboard
          </Link>

          {/* Filter bar matching the Leaderboard Page */}
          <div className="lb-filter-container">
            <div>
              <label className="lb-filter-label">Start</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="lb-filter-input"
              />
            </div>
            <div>
              <label className="lb-filter-label">End</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="lb-filter-input"
              />
            </div>
            <button
              className="lb-filter-button"
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
                {recent
                  .slice(
                    (recentPage - 1) * RECENT_PER_PAGE,
                    recentPage * RECENT_PER_PAGE,
                  )
                  .map((a) => (
                    <tr key={a.activity_id}>
                      <td>
                        {a.date_logged &&
                          new Date(a.date_logged).toLocaleDateString()}
                      </td>
                      <td>{a.activity_type}</td>
                      <td>{a.value}</td>
                      <td className="right">{a.points}</td>
                      <td>
                        {a.updated_at &&
                          new Date(a.updated_at).toLocaleString()}
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
            {recent.length > RECENT_PER_PAGE && (
              <div className="lb-pagination">
                <button
                  className="lb-page-btn"
                  onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                  disabled={recentPage === 1}
                >
                  ← Previous
                </button>
                <span className="lb-page-info">
                  Page {recentPage} of{' '}
                  {Math.ceil(recent.length / RECENT_PER_PAGE)}
                </span>
                <button
                  className="lb-page-btn"
                  onClick={() =>
                    setRecentPage((p) =>
                      Math.min(
                        Math.ceil(recent.length / RECENT_PER_PAGE),
                        p + 1,
                      ),
                    )
                  }
                  disabled={
                    recentPage >= Math.ceil(recent.length / RECENT_PER_PAGE)
                  }
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
