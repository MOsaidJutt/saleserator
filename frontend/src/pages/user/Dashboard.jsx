import React, { useEffect, useState } from 'react';
import api from '../../api';
import Nav from '../../components/Navbar';
import CourseCard from '../../components/CourseCard';
import { useNavigate, Link } from 'react-router-dom';
import '../../components/useruistyles/UserDashboard.css';
import { useAuth } from '../../context/AuthContext';

const activityNameMapping = {
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

const BADGE_COLORS = {
  gray:   { bg: '#374151', text: '#d1d5db' },
  cyan:   { bg: '#164e63', text: '#67e8f9' },
  blue:   { bg: '#1e3a5f', text: '#60a5fa' },
  purple: { bg: '#3b0764', text: '#d8b4fe' },
  amber:  { bg: '#451a03', text: '#fcd34d' },
  red:    { bg: '#450a0a', text: '#fca5a5' },
};

function RankBadge({ name, color }) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.gray;
  return (
    <span
      className="rank-badge-pill"
      style={{ background: c.bg, color: c.text }}
    >
      {name}
    </span>
  );
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState(null);
  const [rank, setRank] = useState(null);
  const { user } = useAuth();
  const slug = user?.company_slug;

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [dashRes, rankRes] = await Promise.all([
          api.get('/users/dashboard'),
          api.get('/users/rank/me'),
        ]);
        if (!mounted) return;
        setDash(dashRes.data);
        setRank(rankRes.data);
      } catch (err) {
        console.error('Failed to load dashboard', err);
        if (mounted) setDash(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div><Nav /><div className="dashboard-wrap">Loading...</div></div>;
  }

  if (!dash) {
    return <div><Nav /><div className="dashboard-wrap">Failed to load dashboard.</div></div>;
  }

  const {
    totalPoints = 0,
    weeklyChangePercent = 0,
    currentRank = null,
    coursesCompleted = 0,
    thisWeek = { secondsWatched: 0, assetsViewed: 0 },
    enrolledCourses = [],
    recommended = [],
    recentActivities = [],
    leaderboard = [],
  } = dash;

  const badgeColor = rank?.badgeColor || 'gray';

  return (
    <div>
      <Nav />
      <div className="dashboard-wrap">

        {/* Welcome Banner */}
        <section className="welcome-banner">
          <div className="welcome-banner__left">
            <h2>Welcome back, {user.name}!</h2>
            <p>Leaderboard position this week: <strong>#{currentRank ?? '—'}</strong></p>
          </div>

          {/* Rank display */}
          {rank && (
            <div className="welcome-banner__rank">
              <div className="rank-label">Current Rank</div>
              <RankBadge name={rank.rankName} color={badgeColor} />
              <div className="rank-progress-wrap">
                <div className="rank-progress-bar">
                  <div
                    className="rank-progress-fill"
                    style={{ width: `${rank.progressPct ?? 0}%` }}
                  />
                </div>
                <div className="rank-progress-meta">
                  <span>{rank.totalSp} SP</span>
                  {rank.rankName !== rank.nextRank && (
                    <span>{rank.nextRankAt} SP → {rank.nextRank}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* My Courses */}
        <section className="my-progress">
          <h3>My Courses</h3>
          <div className="dashboard-grid">
            {enrolledCourses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                actionText="Continue"
                variant="dashboard"
                onAction={() => navigate(`/${slug}/courses/detail/${c.id}`)}
              />
            ))}
            {enrolledCourses.length === 0 && (
              <div className="dashboard-empty">No courses yet.</div>
            )}
          </div>
        </section>

        {/* Quick Stats */}
        <section className="quick-stats">
          <div className="stat-card">
            <h4>Total Points</h4>
            <div className="stat-value">{Math.round(totalPoints)}</div>
            <div className={`stat-change ${weeklyChangePercent >= 0 ? 'up' : 'down'}`}>
              {weeklyChangePercent >= 0
                ? `+${weeklyChangePercent}% vs last week`
                : `${weeklyChangePercent}% vs last week`}
            </div>
          </div>

          <div className="stat-card">
            <h4>Courses Completed</h4>
            <div className="stat-value">{coursesCompleted}</div>
          </div>

          <div className="stat-card">
            <h4>This Week</h4>
            <div className="stat-value">Time Spent: {thisWeek.secondsWatched}</div>
            <div className="stat-value">{thisWeek.assetsViewed || 0} assets viewed</div>
          </div>
        </section>

        {/* Recommended Courses */}
        <section className="recommended">
          <h3>Recommended Courses</h3>
          <div className="recommend-grid">
            {recommended.length ? (
              recommended.map((r) => (
                <div key={`rec-${r.id}`} className="rec-card" role="button" tabIndex={0}>
                  <h4>{r.title}</h4>
                  <small>{r.category} • {r.points} pts</small>
                </div>
              ))
            ) : (
              <div className="dashboard-empty">No recommendations</div>
            )}
          </div>
          <div className="view-all">
            <Link to={`/${slug}/courses`} className="view-all-link">
              View All Available Courses →
            </Link>
          </div>
        </section>

        {/* Recent Activities */}
        <section className="recent-activities">
          <h3>Recent Activities</h3>
          <div className="activity-table">
            <div className="activity-header">
              <div>Activity Type</div>
              <div>Date</div>
              <div>Points</div>
            </div>
            <div className="activity-body">
              {recentActivities.length ? (
                recentActivities.map((a, idx) => (
                  <div key={idx} className="activity-row">
                    <div>{activityNameMapping[a.activity_type] || a.activity_type}</div>
                    <div>{new Date(a.date_logged).toLocaleDateString()}</div>
                    <div>{a.points || 0}</div>
                  </div>
                ))
              ) : (
                <div className="dashboard-empty">No recent activity</div>
              )}
            </div>
          </div>
        </section>

        {/* Leaderboard Preview */}
        <section className="leaderboard-preview">
          <h3>Top Performers This Week</h3>
          <div className="lb-grid">
            <div className="lb-header">
              <div className="lb-col-rank">Rank</div>
              <div className="lb-col-user">User</div>
              <div className="lb-col-points">Points</div>
            </div>
            <div className="dlb-body">
              {leaderboard.map((u, idx) => {
                const pos = idx + 1;
                return (
                  <div key={u.user_id} className={`lb-row ${pos <= 3 ? `top-${pos}` : ''}`}>
                    <div className="lb-cell lb-col-rank">
                      <span className="rank-badge">
                        {pos === 1 ? '🏆' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`}
                      </span>
                    </div>
                    <div className="lb-cell lb-col-user">{u.name}</div>
                    <div className="lb-cell lb-col-points">
                      {Math.round(u.total_points ?? u.points ?? 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="view-all">
            <Link to={`/${slug}/leaderboard`} className="view-all-link">
              View Full Leaderboard →
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}