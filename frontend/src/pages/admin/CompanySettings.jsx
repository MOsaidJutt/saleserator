import React, { useEffect, useState } from 'react';
import api from '../../api';
import Nav from '../../components/Navbar';
import '../../components/adminuistyles/CourseForm.css';
import '../../components/adminuistyles/CompanySettings.css';

const BADGE_COLOR_OPTIONS = ['gray', 'cyan', 'blue', 'purple', 'amber', 'red'];

const BADGE_PREVIEW = {
  gray: { bg: '#374151', text: '#d1d5db' },
  cyan: { bg: '#164e63', text: '#67e8f9' },
  blue: { bg: '#1e3a5f', text: '#60a5fa' },
  purple: { bg: '#3b0764', text: '#d8b4fe' },
  amber: { bg: '#451a03', text: '#fcd34d' },
  red: { bg: '#450a0a', text: '#fca5a5' },
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

  const handleActivityChange = (activity_type, value) => {
    setActivityRules((prev) =>
      prev.map((r) =>
        r.activity_type === activity_type
          ? { ...r, points_per_unit: value }
          : r,
      ),
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

  const handleRankChange = (rank_id, field, value) => {
    setRankRules((prev) =>
      prev.map((r) => (r.rank_id === rank_id ? { ...r, [field]: value } : r)),
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
        <div className="course-form-title" style={{ padding: '2rem' }}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    /* KEY FIX: outer div gets overflow-x:hidden to stop page scroll,
       inner cs-page div applies the padding around all sections */
    <div style={{ overflowX: 'hidden' }}>
      <Nav />

      {/* cs-page provides the horizontal padding so sections never touch edges */}
      <div className="cs-page">
        <h2 className="cs-title">Company Settings</h2>

        {/* ── Activity Point Rules ── */}
        <section className="cs-section">
          <div className="cs-section-head">
            <h3 className="cs-section-title">Activity Point Rules</h3>
            <p className="cs-section-sub">
              Set how many SP each activity type awards per unit.
            </p>
          </div>
          <div className="cs-section-body">
            <div className="cs-cards-grid">
              {activityRules.map((rule) => (
                <div key={rule.activity_type} className="cs-card">
                  <div>
                    <div className="cs-card-title">{rule.activity_type}</div>
                    <div className="cs-card-sub">Points per unit</div>
                  </div>
                  <div className="cs-card-row">
                    <input
                      type="number"
                      min="0"
                      value={rule.points_per_unit}
                      onChange={(e) =>
                        handleActivityChange(rule.activity_type, e.target.value)
                      }
                      className="cs-input"
                    />
                    <button
                      className="cs-save-btn"
                      onClick={() => saveActivityRule(rule)}
                      disabled={savingActivity === rule.activity_type}
                    >
                      {savingActivity === rule.activity_type
                        ? 'Saving...'
                        : 'Save'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Rank Rules ── */}
        <section className="cs-section">
          <div className="cs-section-head">
            <h3 className="cs-section-title">Rank Thresholds</h3>
            <p className="cs-section-sub">
              Set the SP required to reach each rank and its badge color.
            </p>
          </div>
          <div className="cs-section-body">
            <div className="cs-cards-grid">
              {rankRules.map((rule) => {
                const preview =
                  BADGE_PREVIEW[rule.badge_color] || BADGE_PREVIEW.gray;
                return (
                  <div key={rule.rank_id} className="cs-card">
                    <div className="cs-card-row">
                      <span
                        className="cs-badge"
                        style={{ background: preview.bg, color: preview.text }}
                      >
                        {rule.name}
                      </span>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={(e) =>
                          handleRankChange(rule.rank_id, 'name', e.target.value)
                        }
                        placeholder="Rank name"
                        className="cs-input cs-input--wide"
                      />
                    </div>
                    <div className="cs-card-row">
                      <span className="cs-label">Min SP</span>
                      <input
                        type="number"
                        min="0"
                        value={rule.min_sp}
                        onChange={(e) =>
                          handleRankChange(
                            rule.rank_id,
                            'min_sp',
                            e.target.value,
                          )
                        }
                        className="cs-input"
                      />
                      <span className="cs-label">Color</span>
                      <select
                        value={rule.badge_color || 'gray'}
                        onChange={(e) =>
                          handleRankChange(
                            rule.rank_id,
                            'badge_color',
                            e.target.value,
                          )
                        }
                        className="cs-select"
                      >
                        {BADGE_COLOR_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="cs-save-btn"
                      onClick={() => saveRankRule(rule)}
                      disabled={savingRank === rule.rank_id}
                    >
                      {savingRank === rule.rank_id ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {message && (
          <div className={`cs-message cs-message--${messageType}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
