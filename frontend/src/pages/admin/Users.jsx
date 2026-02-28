// src/pages/admin/Users.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api';
import Nav from '../../components/Navbar';
import '../../components/adminuistyles/CourseForm.css';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Invite form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('sales_rep');

  const [loading, setLoading] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showMessage('Email and password are required.', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/admin/users/invite', {
        name,
        email,
        password,
        role,
      });
      showMessage(res.data.message || 'User invited successfully.', 'success');
      setName('');
      setEmail('');
      setPassword('');
      setRole('sales_rep');
      setIsInviteOpen(false);
      fetchUsers();
    } catch (err) {
      showMessage(
        err.response?.data?.message || 'Failed to invite user.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Remove ${userName || 'this user'} from your company?`)) return;
    try {
      setRowBusy(userId);
      await api.delete(`/admin/users/${userId}`);
      await fetchUsers();
      showMessage('User removed successfully.', 'success');
    } catch (err) {
      showMessage(
        err.response?.data?.message || 'Failed to remove user.',
        'error'
      );
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div>
      <Nav />
      <h2 className="course-form-title" style={{ marginTop: '1.25rem' }}>
        User Management
      </h2>

      {/* ── Invite User (Collapsible) ── */}
      <section
        className={`course-form-collapsible ${isInviteOpen ? 'is-open' : ''}`}
      >
        <button
          type="button"
          className="collapsible-trigger"
          onClick={() => setIsInviteOpen((v) => !v)}
          aria-expanded={isInviteOpen}
        >
          <span>Invite a New User</span>
          <svg
            className="chevron"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="collapsible-content">
          <div className="course-form-container">
            <form onSubmit={handleInvite} className="course-form">
              <div className="grid-layout">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input
                    className="input-field"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@company.com"
                    required
                  />
                </div>
              </div>
              <div className="grid-layout">
                <div>
                  <label className="label">Temporary Password *</label>
                  <input
                    className="input-field"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Temporary Password"
                    required
                  />
                </div>
                <div>
                  <label className="label">Role</label>
                  <select
                    className="input-field"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="sales_rep">Sales Rep</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Inviting...' : 'Invite User'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Existing Users ── */}
      <section className="existing-courses-wrap">
        <h3 className="existing-courses-title">Team Members</h3>
        <div className="existing-courses-body">
          <div className="course-list">
            {users.length === 0 && (
              <p style={{ padding: '1rem', opacity: 0.6 }}>
                No users yet. Invite your first team member above.
              </p>
            )}
            {users.map((u) => (
              <article key={u.user_id} className="course-card">
                <div className="course-card-header">
                  <div>
                    <div className="course-card-title">
                      {u.name || '—'}
                    </div>
                    <div className="course-card-sub">
                      {u.email} · {u.role === 'admin' ? 'Admin' : 'Sales Rep'}
                      <span style={{ opacity: 0.5, marginLeft: '0.5rem' }}>
                        · Joined {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="course-card-actions">
                    <button
                      onClick={() => handleDelete(u.user_id, u.name)}
                      className="delete-btn"
                      type="button"
                      disabled={rowBusy === u.user_id}
                    >
                      {rowBusy === u.user_id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Message ── */}
      {message && (
        <div
          className={`message ${messageType === 'error' ? 'message-error' : 'message-success'}`}
        >
          {message}
        </div>
      )}
    </div>
  );
}