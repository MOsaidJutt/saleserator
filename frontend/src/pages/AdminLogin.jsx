// frontend/src/pages/AdminLogin.jsx
import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const nav = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr('');
    setLoading(true); // Set loading state to true
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.user.role !== 'admin') {
        setErr('This account is not an admin.');
        setLoading(false);
        return;
      }
      login(res.data); // Login user (token and user data)
      nav('/admin/dashboard'); // Redirect to admin dashboard
    } catch (e) {
      setLoading(false); // Stop loading on error
      setErr(e.response?.data?.message || 'Invalid credentials'); // Show error message
    }
  };

  return (
    <div className="card stack" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h3>Admin sign in</h3>
      <input
        className="input"
        placeholder="Admin email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {err && <div style={{ color: 'tomato' }}>{err}</div>}
      <button
        className="btn"
        onClick={submit}
        disabled={loading} // Disable button when loading
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </div>
  );
}
