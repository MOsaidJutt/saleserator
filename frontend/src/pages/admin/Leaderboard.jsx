import React, { useState, useEffect } from 'react';
import api, { apiCsv } from '../../api';
import { Link } from 'react-router-dom';
import '../../components/adminuistyles/AdminLeaderboard.css'; // Custom CSS file
import Navbar from '../../components/Navbar';

export default function Leaderboard() {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('points'); // Default sorting by points
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const response = await api(
        `/admin/leaderboard?start=${start}&end=${end}&search=${encodeURIComponent(
          search,
        )}&sort=${sort}`,
      );
      setItems(response.data.items || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [start, end, search, sort]);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen); // Toggle visibility
  };

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
    <div>
      <Navbar />
      <div className="leaderboard-page-container">
        <div className="leaderboard-page-content">
          <h1 className="page-title">Leaderboard</h1>
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
            <div>
              <label className="filter-label">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="filter-input"
              />
            </div>

            <div>
              <label className="filter-label">Sort</label>
              <div
                className={`
                  custom-dropdown 
                  ${isDropdownOpen ? 'open' : ''}
                `}
              >
                <div className="dropdown-selected" onClick={toggleDropdown}>
                  <span>{sort === 'points' ? 'By Points' : 'By Name'}</span>
                  <span className="dropdown-arrow">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="18"
                      fill="currentColor"
                      className="bi bi-chevron-down"
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
                      setDropdownOpen(false); // Close dropdown after selection
                    }}
                  >
                    By Points
                  </li>
                  <li
                    key="name"
                    onClick={() => {
                      setSort('name');
                      setDropdownOpen(false); // Close dropdown after selection
                    }}
                  >
                    By Name
                  </li>
                </ul>
              </div>
            </div>
            <div className="button-container">
              <button
                onClick={loadLeaderboard}
                className="filter-button"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
              <button onClick={downloadCsv} className="filter-button">
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
                  items.map((u, idx) => (
                    <tr key={u.user_id}>
                      <td>{u.rank ?? idx + 1}</td>
                      <td>{u.name}</td>
                      <td>{u.total_points}</td>
                      <td>{u.activity_count}</td>
                      <td>
                        <Link
                          to={`/admin/leaderboard/user/${u.user_id}?start=${start}&end=${end}`}
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
          </div>
        </div>
      </div>
    </div>
  );
}
