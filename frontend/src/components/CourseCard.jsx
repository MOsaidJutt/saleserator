import React from 'react';
import './CourseCard.css';

export default function CourseCard({
  course,
  actionText,
  onAction,
  disabled,
  variant = 'dashboard',
}) {
  const percent = Math.round(course.progress_percent || 0);
  const isCompleted = percent >= 100;

  const approvedFlag =
    course.approved === true ||
    course.status === 'approved' ||
    course.state === 'approved';

  const requestedFlag =
    course.requested === true || course.request_status === 'pending';

  const isRequestsView = variant === 'requests';

  const renderProgressArea = () => {
    if (!isRequestsView) {
      return (
        <div className="card-progress">
          <div className="card-progress-bar">
            <div
              className="card-progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <small className="card-progress-text">{percent}%</small>
        </div>
      );
    }
    if (approvedFlag) {
      return (
        <div className="card-progress">
          <div className="card-progress-bar">
            <div
              className="card-progress-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <small className="card-progress-text">{percent}%</small>
        </div>
      );
    }
    if (requestedFlag) return <p className="pending-text">Pending approval</p>;
    return null;
  };

  return (
    <div
      className="card course-card"
      onClick={() => !disabled && onAction(course)}
    >
      {isCompleted && <div className="card-pill">Completed</div>}

      <h4 className="card-title">{course.title}</h4>
      <p className="tag">
        {course.category} • {course.points} pts
      </p>

      {renderProgressArea()}

      <button
        type="button" // 🟢 prevents page reload
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAction?.(course);
        }}
        disabled={disabled}
        className="cc-btn"
      >
        {actionText}
      </button>
    </div>
  );
}
