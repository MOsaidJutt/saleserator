import React, { useEffect, useState } from 'react';
import api from '../../api';
import Nav from '../../components/Navbar';
import '../../components/adminuistyles/CourseForm.css';

const BADGE_COLOR_OPTIONS = ['gray', 'cyan', 'blue', 'purple', 'amber', 'red'];

const BADGE_PREVIEW = {
  gray:   { bg: '#374151', text: '#d1d5db' },
  cyan:   { bg: '#164e63', text: '#67e8f9' },
  blue:   { bg: '#1e3a5f', text: '#60a5fa' },
  purple: { bg: '#3b0764', text: '#d8b4fe' },
  amber:  { bg: '#451a03', text: '#fcd34d' },
  red:    { bg: '#450a0a', text: '#fca5a5' },
};

export default function CompanySettings() {
  const [activityRules, setActivityRules] = useState([]);
  const [rankRules, setRankRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingActivity, setSavingActivity] = useState(null);
  const [savingRank, setSavingRank] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [actRes, rankRes] = await Promise.all([
        api.get('/admin/settings/activity-rules'),
        api.get('/admin/settings/rank-rules'),
      ]);
      setActivityRules(actRes.data?.items || []);
      setRankRules(rankRes.data?.items || []);
    } catch (err) {
      showMessage('Failed to load settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  // ── Activity Rules ──────────────────────────────────────────

  const handleActivityChange = (activity_type, value) => {
    setActivityRules((prev) =>
      prev.map((r) =>
        r.activity_type === activity_type
          ? { ...r, points_per_unit: value }
          : r
      )
    );
  };

  const saveActivityRule = async (rule) => {
    setSavingActivity(rule.activity_type);
    try {
      await api.put('/admin/settings/activity-rules', {
        activity_type: rule.activity_type,
        points_per_unit: Number(rule.points_per_unit),
      });
      showMessage(`"${rule.activity_type}" updated successfully.`);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update.', 'error');
    } finally {
      setSavingActivity(null);
    }
  };

  // ── Rank Rules ──────────────────────────────────────────────

  const handleRankChange = (rank_id, field, value) => {
    setRankRules((prev) =>
      prev.map((r) =>
        r.rank_id === rank_id ? { ...r, [field]: value } : r
      )
    );
  };

  const saveRankRule = async (rule) => {
    setSavingRank(rule.rank_id);
    try {
      await api.put(`/admin/settings/rank-rules/${rule.rank_id}`, {
        name: rule.name,
        min_sp: Number(rule.min_sp),
        badge_color: rule.badge_color,
      });
      showMessage(`"${rule.name}" rank updated successfully.`);
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update.', 'error');
    } finally {
      setSavingRank(null);
    }
  };

  if (loading) {
    return (
      <div>
        <Nav />
        <div className="course-form-title" style={{ padding: '2rem' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div>
      <Nav />

      <h2 className="course-form-title" style={{ marginTop: '1.25rem' }}>
        Company Settings
      </h2>

      {/* ── Activity Point Rules ── */}
      <section className="existing-courses-wrap">
        <h3 className="existing-courses-title">Activity Point Rules</h3>
        <p style={{ padding: '0 1.5rem', opacity: 0.6, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Set how many SP each activity type awards per unit.
        </p>

        <div className="existing-courses-body">
          <div className="course-list">
            {activityRules.map((rule) => (
              <article key={rule.activity_type} className="course-card">
                <div className="course-card-header">
                  <div>
                    <div className="course-card-title">{rule.activity_type}</div>
                    <div className="course-card-sub">Points per unit</div>
                  </div>
                  <div className="course-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="number"
                      min="0"
                      value={rule.points_per_unit}
                      onChange={(e) => handleActivityChange(rule.activity_type, e.target.value)}
                      style={{
                        width: '80px',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: '#f1f5f9',
                        fontSize: '0.95rem',
                        textAlign: 'center',
                      }}
                    />
                    <button
                      className="submit-btn"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      onClick={() => saveActivityRule(rule)}
                      disabled={savingActivity === rule.activity_type}
                    >
                      {savingActivity === rule.activity_type ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rank Rules ── */}
      <section className="existing-courses-wrap" style={{ marginTop: '2rem' }}>
        <h3 className="existing-courses-title">Rank Thresholds</h3>
        <p style={{ padding: '0 1.5rem', opacity: 0.6, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Set the SP required to reach each rank and its badge color.
        </p>

        <div className="existing-courses-body">
          <div className="course-list">
            {rankRules.map((rule) => {
              const preview = BADGE_PREVIEW[rule.badge_color] || BADGE_PREVIEW.gray;
              return (
                <article key={rule.rank_id} className="course-card">
                  <div className="course-card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>

                    {/* Rank name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <span
                        style={{
                          background: preview.bg,
                          color: preview.text,
                          padding: '0.25rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {rule.name}
                      </span>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(e) => handleRankChange(rule.rank_id, 'name', e.target.value)}
                        placeholder="Rank name"
                        style={{
                          width: '130px',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          background: '#0f172a',
                          color: '#f1f5f9',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>

                    {/* Min SP */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Min SP</label>
                      <input
                        type="number"
                        min="0"
                        value={rule.min_sp}
                        onChange={(e) => handleRankChange(rule.rank_id, 'min_sp', e.target.value)}
                        style={{
                          width: '90px',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          background: '#0f172a',
                          color: '#f1f5f9',
                          fontSize: '0.95rem',
                          textAlign: 'center',
                        }}
                      />
                    </div>

                    {/* Badge color */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Color</label>
                      <select
                        value={rule.badge_color || 'gray'}
                        onChange={(e) => handleRankChange(rule.rank_id, 'badge_color', e.target.value)}
                        style={{
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          background: '#0f172a',
                          color: '#f1f5f9',
                          fontSize: '0.85rem',
                        }}
                      >
                        {BADGE_COLOR_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Save */}
                    <button
                      className="submit-btn"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      onClick={() => saveRankRule(rule)}
                      disabled={savingRank === rule.rank_id}
                    >
                      {savingRank === rule.rank_id ? 'Saving...' : 'Save'}
                    </button>

                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Message */}
      {message && (
        <div
          className={`message ${messageType === 'error' ? 'message-error' : 'message-success'}`}
          style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}
        >
          {message}
        </div>
      )}
    </div>
  );
}