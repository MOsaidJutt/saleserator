// src/pages/SignUp.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import '../components/SignUp.css';

// ─────────────────────────────────────────────────────────────────
// INVITE-ONLY MODE
// Self-signup is disabled. Accounts are created by an admin.
// To re-enable self-signup, uncomment the block below and remove
// the invite-only UI.
// ─────────────────────────────────────────────────────────────────

export default function SignUp() {
  return (
    <div className="su-wrap">
      <div className="su-card">
        <h3 className="su-title">Access by invitation only</h3>
        <p style={{ textAlign: 'center', opacity: 0.7, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Accounts are created by your company admin.<br />
          If you haven't received your login details, please contact your administrator.
        </p>
        <Link className="su-btn" to="/signin" style={{ display: 'block', textAlign: 'center' }}>
          Go to Sign In
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SELF-SIGNUP (disabled — uncomment to re-enable)
// ─────────────────────────────────────────────────────────────────
//
// import React, { useState } from 'react';
// import api from '../api';
// import { Link, useNavigate } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';
// import '../components/SignUp.css';
//
// export default function SignUp() {
//   const nav = useNavigate();
//   const { login } = useAuth();
//
//   const [form, setForm] = useState({ email: '', password: '', name: '' });
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//
//   const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });
//
//   const onSubmit = async () => {
//     setError('');
//     setLoading(true);
//     try {
//       const exists = await api.post('/auth/check-email', { email: form.email });
//       if (exists.data?.exists) {
//         setError('Email already registered.');
//         return;
//       }
//       const res = await api.post('/auth/signup', form);
//       login(res.data);
//       nav('/dashboard');
//     } catch (e) {
//       setError(e.response?.data?.message || 'Could not sign up.');
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   return (
//     <div className="su-wrap">
//       <div className="su-card">
//         <h3 className="su-title">Create your account</h3>
//
//         <div className="su-field">
//           <label className="su-label">Name</label>
//           <input
//             className="su-input"
//             value={form.name}
//             onChange={update('name')}
//             placeholder="Your name"
//           />
//         </div>
//
//         <div className="su-field">
//           <label className="su-label">Email</label>
//           <input
//             className="su-input"
//             value={form.email}
//             onChange={update('email')}
//             placeholder="you@company.com"
//           />
//         </div>
//
//         <div className="su-field">
//           <label className="su-label">Password</label>
//           <input
//             className="su-input"
//             type="password"
//             value={form.password}
//             onChange={update('password')}
//             placeholder="••••••••"
//           />
//         </div>
//
//         {error && <div className="su-error">{error}</div>}
//
//         <button className="su-btn" onClick={onSubmit} disabled={loading}>
//           {loading ? 'Signing up...' : 'Sign up'}
//         </button>
//         <div>
//           <Link className="auth-link" to="/signin">
//             Already have an account.
//           </Link>
//         </div>
//       </div>
//     </div>
//   );
// }