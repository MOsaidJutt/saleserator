import React, { useState, useEffect } from 'react';
import api, { apiCsv } from '../../api';
import Navbar from '../../components/Navbar';
import '../../components/adminuistyles/AdminActivityLog.css';

export default function ActivitiesPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');

  const [editItem, setEditItem] = useState(null);
  const [editReason, setEditReason] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editType, setEditType] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editDeleted, setEditDeleted] = useState(false);

  const [isDropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (editItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editItem]);

  const toggleDropdown = () => setDropdownOpen(!isDropdownOpen);

  const handleOptionSelect = (activityType) => {
    setType(activityType);
    setDropdownOpen(false);
  };

  const activityTypeMapping = {
    video_completed: 'Video Completed',
    course_completed: 'Course Completed',
    calls: 'Calls',
    emails: 'Emails',
    textMessages: 'Text Messages',
    appointments: 'Appointments',
    presentations: 'Presentations',
    deals: 'Deals',
    socialMediaPosts: 'Social Media Posts',
    networkingEvents: 'Networking Events',
    doorsKnocked: 'Doors Knocked',
    referralsReceived: 'Referrals Received',
  };

  const activityTypes = Object.keys(activityTypeMapping);

  async function load() {
    setLoading(true);
    try {
      const validUserId = userId === '' ? null : userId;
      const validType = type === '' ? null : type;
      const res = await api(
        `/admin/activities?start=${start}&end=${end}&user_id=${validUserId || ''}&type=${validType || ''}&q=${q || ''}`,
      );
      const rows = Array.isArray(res.data.items) ? res.data.items : [];
      setItems(rows);
    } catch (e) {
      console.error('Failed to load activities:', e);
      alert(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [start, end, userId, type, q]);

  function startEdit(item) {
    setEditItem(item);
    setEditReason('');
    setEditValue(item.value);
    setEditPoints(item.points);
    setEditType(item.activity_type);
    const utcDate = new Date(item.date_logged).toISOString().slice(0, 10);
    setEditDate(utcDate);
    setEditDeleted(item.is_deleted);
  }

  const handleActivityUpdate = async (e) => {
    e.preventDefault();
    const updatedActivity = {
      activity_type: editType,
      value: Number(editValue),
      points: Number(editPoints),
      date_logged: editDate,
      is_deleted: editDeleted,
      edit_reason: editReason,
    };
    if (!updatedActivity.edit_reason || !updatedActivity.edit_reason.trim()) {
      alert('Edit reason is required');
      return;
    }
    try {
      await api.patch(
        `/admin/activities/edit/${editItem.activity_id}`,
        updatedActivity,
      );
      alert('Activity updated successfully!');
      setEditItem(null);
      load();
    } catch (e) {
      console.error(e);
      alert('Failed to update activity');
    }
  };

  async function deleteItem(item) {
    const reason = prompt('Reason for delete?');
    if (!reason) return;
    try {
      await api(`/admin/activities/${item.activity_id}`, {
        method: 'DELETE',
        body: { reason },
      });
      load();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  async function downloadCsv() {
    try {
      const res = await apiCsv(
        `/admin/activities/export.csv?start=${start}&end=${end}&user_id=${userId || ''}&type=${type || ''}&q=${q || ''}`,
      );
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activities_${start}_to_${end}.csv`;
      a.click();
    } catch (e) {
      console.error(e);
      alert(e.message);
    }
  }

  return (
    /* KEY FIX: overflow-x hidden on outermost div stops page-level horizontal scroll */
    <div style={{ overflowX: 'hidden' }}>
      <Navbar />
      <div className="activity-page-container">
        <div className="activity-page-content">
          <h1 className="page-title">Activities</h1>

          <div className="filter-container">
            <div className="filter-inputs-row">
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
                <label className="filter-label">User ID</label>
                <input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div>
                <label className="filter-label">Search</label>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div>
                <label className="filter-label">Type</label>
                <div
                  className={`custom-dropdown ${isDropdownOpen ? 'open' : ''}`}
                >
                  <div className="dropdown-selected" onClick={toggleDropdown}>
                    <span>
                      {activityTypeMapping[type] || 'Select Activity Type'}
                    </span>
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
                    <li key="default" onClick={() => handleOptionSelect('')}>
                      None
                    </li>
                    {activityTypes.map((activityType) => (
                      <li
                        key={activityType}
                        onClick={() => handleOptionSelect(activityType)}
                      >
                        {activityTypeMapping[activityType]}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="filter-btn-row">
              <button
                onClick={load}
                className="filter-button"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
              <button onClick={downloadCsv} className="filter-button">
                CSV
              </button>
            </div>
          </div>

          {/* KEY FIX: activity-table-scroll div wraps the table directly */}
          <div className="activity-table-container">
            <div className="activity-table-scroll">
              <table className="admin-activity-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Points</th>
                    <th>Date</th>
                    <th>Deleted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((it, index) => (
                      <tr key={it.activity_id}>
                        <td>{index + 1}</td>
                        <td>{it.name}</td>
                        <td>
                          {activityTypeMapping[it.activity_type] ||
                            it.activity_type}
                        </td>
                        <td>{it.value}</td>
                        <td>{it.points}</td>
                        <td>
                          {it.date_logged
                            ? new Date(it.date_logged).toLocaleDateString()
                            : ''}
                        </td>
                        <td>{it.is_deleted ? 'yes' : ''}</td>
                        <td>
                          <button
                            onClick={() => startEdit(it)}
                            className="edit-button"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItem(it)}
                            className="delete-button"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="no-activities">
                        No activities
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Modal */}
          {editItem && (
            <div
              className="edit-modal"
              onMouseDown={(e) => {
                if (e.target.classList.contains('edit-modal'))
                  setEditItem(null);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                overflowY: 'auto',
              }}
            >
              <div
                className="edit-modal-content"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <h2>Edit Activity</h2>
                <form onSubmit={handleActivityUpdate} className="edit-form">
                  <div className="edit-modal-body">
                    <div className="form-field">
                      <label>Activity Type</label>
                      <input
                        type="text"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="form-input"
                        placeholder="Activity Type"
                      />
                    </div>
                    <div className="form-field">
                      <label>Value</label>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="form-input"
                        placeholder="Value"
                      />
                    </div>
                    <div className="form-field">
                      <label>Points</label>
                      <input
                        type="number"
                        value={editPoints}
                        onChange={(e) => setEditPoints(e.target.value)}
                        className="form-input"
                        placeholder="Points"
                      />
                    </div>
                    <div className="form-field">
                      <label>Date</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="modal-bottom-grid">
                      <div className="form-field modal-reason">
                        <label>Edit Reason</label>
                        <textarea
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className="form-textarea"
                          placeholder="Edit Reason"
                        />
                      </div>
                      <div className="form-field modal-deleted">
                        <label>Mark Deleted</label>
                        <div className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={editDeleted}
                            onChange={(e) => setEditDeleted(e.target.checked)}
                            className="form-checkbox"
                          />
                          <span className="checkbox-text">Deleted</span>
                        </div>
                      </div>
                      <div className="modal-actions-right">
                        <button
                          type="button"
                          onClick={() => setEditItem(null)}
                          className="cancel-button"
                        >
                          Cancel
                        </button>
                        <button type="submit" className="save-button">
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
