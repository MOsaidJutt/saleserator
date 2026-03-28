import React, { useState, useEffect } from 'react';
import api, { apiCsv } from '../../api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../components/adminuistyles/AdminLeaderboard.css';
import Navbar from '../../components/Navbar';

export default function Leaderboard() {
  const { user } = useAuth();
  const slug = user?.company_slug;
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('points');
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 10;

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const response = await api(
        `/admin/leaderboard?start=${start}&end=${end}&search=${encodeURIComponent(search)}&sort=${sort}`,
      );
      setItems(response.data.items || []);
      setCurrentPage(1);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [start, end, search, sort]);

  const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

  async function downloadCsv() {
    try {
      const res = await apiCsv(
        `/admin/leaderboard/export.csv?start=${start}&end=${end}`,
      );
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leaderboard_${start}_to_${end}.csv`;
      a.click();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    /* KEY FIX: overflow-x hidden on outermost div stops page-level horizontal scroll */
    <div style={{ overflowX: 'hidden' }}>
      <Navbar />
      <div className="leaderboard-page-container">
        <div className="leaderboard-page-content">
          <h1 className="page-title">Leaderboard</h1>

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
            <div>
              <label className="lb-filter-label">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="lb-filter-input"
              />
            </div>
            <div>
              <label className="lb-filter-label">Sort</label>
              <div
                className={`custom-dropdown ${isDropdownOpen ? 'open' : ''}`}
              >
                <div className="dropdown-selected" onClick={toggleDropdown}>
                  <span>{sort === 'points' ? 'By Points' : 'By Name'}</span>
                  <span className="dropdown-arrow">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="18"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                    >
                      <path d="M1.5 5.5a.5.5 0 0 1 .707-.707L8 9.293l5.793-5.793a.5.5 0 0 1 .707.707L8 10.707 1.5 5.5z" />
                    </svg>
                  </span>
                </div>
                <ul className="dropdown-options">
                  <li
                    key="points"
                    onClick={() => {
                      setSort('points');
                      setDropdownOpen(false);
                    }}
                  >
                    By Points
                  </li>
                  <li
                    key="name"
                    onClick={() => {
                      setSort('name');
                      setDropdownOpen(false);
                    }}
                  >
                    By Name
                  </li>
                </ul>
              </div>
            </div>
            <div className="lb-button-container">
              <button
                onClick={loadLeaderboard}
                className="lb-filter-button"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
              <button onClick={downloadCsv} className="lb-filter-button">
                Download CSV
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Points</th>
                  <th>Activities</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items
                    .slice(
                      (currentPage - 1) * ROWS_PER_PAGE,
                      currentPage * ROWS_PER_PAGE,
                    )
                    .map((u, idx) => (
                      <tr key={u.user_id}>
                        <td>
                          {u.rank ??
                            (currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                        </td>
                        <td>{u.name}</td>
                        <td>{u.total_points}</td>
                        <td>{u.activity_count}</td>
                        <td>
                          <Link
                            to={`/${slug}/admin/leaderboard/user/${u.user_id}?start=${start}&end=${end}`}
                            className="link"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {items.length > ROWS_PER_PAGE && (
              <div className="lb-pagination">
                <button
                  className="lb-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← Previous
                </button>
                <span className="lb-page-info">
                  Page {currentPage} of
                  {Math.ceil(items.length / ROWS_PER_PAGE)}
                </span>
                <button
                  className="lb-page-btn"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(Math.ceil(items.length / ROWS_PER_PAGE), p + 1),
                    )
                  }
                  disabled={
                    currentPage >= Math.ceil(items.length / ROWS_PER_PAGE)
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
