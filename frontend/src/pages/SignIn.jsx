// src/pages/SignIn.jsx
import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import '../components/SignIn.css';

export default function SignIn() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data);

      const { role, company_slug } = res.data.user;

      // Safety check — if no slug something is wrong with the account setup
      if (!company_slug) {
        setErr('Your account is not associated with a company. Please contact your administrator.');
        return;
      }

      if (role === 'admin') nav(`/${company_slug}/admin/dashboard`);
      else nav(`/${company_slug}/dashboard`);

    } catch (e) {
      setErr(e.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h3 className="auth-title">Sign in</h3>
        <input
          className="auth-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="auth-error">{err}</div>}
        <button className="auth-btn" onClick={submit} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <div>
          <Link className="auth-link" to="/forgot">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}