import React, { useState } from 'react';
import api from '../api';
import '../components/forgotpassword.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('request'); // 'request' | 'verify'
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async () => {
    setMsg('');
    setErr('');
    if (!email) return setErr('Please enter your email.');
    try {
      setLoading(true);
      await api.post('/auth/forgot', { email });
      setMsg('Verification code sent to your email.');
      setStage('verify');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setMsg('');
    setErr('');
    if (!code || !newPwd) return setErr('Enter the code and a new password.');
    try {
      setLoading(true);
      await api.post('/auth/reset', { email, code, newPassword: newPwd });
      setMsg('Password updated. You can sign in now.');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Reset failed. Check the code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pass-wrap">
      <div className="auth-card">
        <h3 className="auth-title">Reset password</h3>

        {stage === 'request' && (
          <>
            <input
              className="auth-input"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              className="auth-btn"
              onClick={request}
              disabled={!email || loading}
            >
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="auth-hint">We’ll email you a 6-digit code.</p>
          </>
        )}

        {stage === 'verify' && (
          <>
            <input
              className="auth-input"
              placeholder="Code from email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="New password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <button
              className="auth-btn"
              onClick={reset}
              disabled={!code || !newPwd || loading}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
            <p className="auth-inline">
              Not your email?{' '}
              <button
                className="auth-linklike"
                onClick={() => setStage('request')}
              >
                Change
              </button>
            </p>
          </>
        )}

        {err && <div className="auth-error">{err}</div>}
        {msg && <div className="auth-msg">{msg}</div>}
      </div>
    </div>
  );
}
