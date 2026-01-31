// src/pages/SignUp.jsx
import React, { useState } from 'react';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../components/SignUp.css'; // ← add this

export default function SignUp() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const exists = await api.post('/auth/check-email', { email: form.email });
      if (exists.data?.exists) {
        setError('Email already registered.');
        return;
      }
      const res = await api.post('/auth/signup', form);
      login(res.data);
      nav('/dashboard');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="su-wrap">
      <div className="su-card">
        <h3 className="su-title">Create your account</h3>

        <div className="su-field">
          <label className="su-label">Name</label>
          <input
            className="su-input"
            value={form.name}
            onChange={update('name')}
            placeholder="Your name"
          />
        </div>

        <div className="su-field">
          <label className="su-label">Email</label>
          <input
            className="su-input"
            value={form.email}
            onChange={update('email')}
            placeholder="you@company.com"
          />
        </div>

        <div className="su-field">
          <label className="su-label">Password</label>
          <input
            className="su-input"
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder="••••••••"
          />
        </div>

        {error && <div className="su-error">{error}</div>}

        <button className="su-btn" onClick={onSubmit} disabled={loading}>
          {loading ? 'Signing up...' : 'Sign up'}
        </button>
        <div>
          <Link className="auth-link" to="/signin">
            Already have an account.
          </Link>
        </div>
      </div>
    </div>
  );
}
