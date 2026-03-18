import React, { useState } from 'react';
import api from '../api';
import '../components/forgotpassword.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('request');
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async () => {
    setMsg(''); setErr('');
    if (!email) return setErr('Please enter your email.');
    try {
      setLoading(true);
      await api.post('/auth/forgot', { email });
      setMsg('Verification code sent to your email.');
      setStage('verify');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Could not send code. Try again.');
    } finally { setLoading(false); }
  };

  const reset = async () => {
    setMsg(''); setErr('');
    if (!code || !newPwd) return setErr('Enter the code and a new password.');
    try {
      setLoading(true);
      await api.post('/auth/reset', { email, code, newPassword: newPwd });
      setMsg('Password updated. You can sign in now.');
    } catch (e) {
      setErr(e?.response?.data?.message || 'Reset failed. Check the code.');
    } finally { setLoading(false); }
  };

  return (
    <div className="pass-wrap">
      <div className="pass-card">
        <h3 className="pass-title">Reset password</h3>

        {stage === 'request' && (
          <>
            <input
              className="pass-input"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="pass-btn" onClick={request} disabled={!email || loading}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
            <p className="pass-hint">We'll email you a 6-digit code.</p>
          </>
        )}

        {stage === 'verify' && (
          <>
            <input
              className="pass-input"
              placeholder="Code from email"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="pass-input"
              type="password"
              placeholder="New password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <button className="pass-btn" onClick={reset} disabled={!code || !newPwd || loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
            <p className="pass-inline">
              Not your email?{' '}
              <button className="pass-linklike" onClick={() => setStage('request')}>
                Change
              </button>
            </p>
          </>
        )}

        {err && <div className="pass-error">{err}</div>}
        {msg && <div className="pass-msg">{msg}</div>}
      </div>
    </div>
  );
}