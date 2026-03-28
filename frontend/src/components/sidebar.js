// src/components/Sidebar.jsx
import React from 'react';
import './sidebar.css';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

const Sidebar = ({ show, onClose }) => {
  const { user } = useAuth();
  const slug = user?.company_slug;
  const { pathname } = useLocation();

  // Returns 'active' if the current path matches or starts with the given href
  const isActive = (href) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <div className={`sidenav ${show ? 'active' : ''}`}>
        {/* Admin Panel — only for role === 'admin' */}
        {user?.role === 'admin' && (
          <>
            <h2>Admin Panel</h2>
            <ul>
              <li>
                <a
                  href={`/${slug}/admin/dashboard`}
                  className={
                    isActive(`/${slug}/admin/dashboard`) ? 'active' : ''
                  }
                  onClick={onClose}
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/users`}
                  className={isActive(`/${slug}/admin/users`) ? 'active' : ''}
                  onClick={onClose}
                >
                  Manage Users
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/courses/upload`}
                  className={isActive(`/${slug}/admin/courses`) ? 'active' : ''}
                  onClick={onClose}
                >
                  Handle Courses
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/course-requests`}
                  className={
                    isActive(`/${slug}/admin/course-requests`) ? 'active' : ''
                  }
                  onClick={onClose}
                >
                  Course Requests
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/activities`}
                  className={
                    isActive(`/${slug}/admin/activities`) ? 'active' : ''
                  }
                  onClick={onClose}
                >
                  Handle User Activities
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/leaderboard`}
                  className={
                    isActive(`/${slug}/admin/leaderboard`) ? 'active' : ''
                  }
                  onClick={onClose}
                >
                  View Leaderboard
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/brand-settings`}
                  className={
                    isActive(`/${slug}/admin/brand-settings`) ? 'active' : ''
                  }
                  onClick={onClose}
                >
                  Brand Settings
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/admin/company-settings`}
                  className={
                    isActive(`/${slug}/admin/company-settings`) ? 'active' : ''
                  }
                  onClick={onClose}
                >
                  Company Settings
                </a>
              </li>
            </ul>
          </>
        )}

        {/* User Panel — any non-admin role (sales_rep, manager, custom, etc.) */}
        {user?.role !== 'admin' && (
          <>
            <h2>Welcome {user.name}</h2>
            <ul>
              <li>
                <a
                  href={`/${slug}/dashboard`}
                  className={isActive(`/${slug}/dashboard`) ? 'active' : ''}
                  onClick={onClose}
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/courses`}
                  className={isActive(`/${slug}/courses`) ? 'active' : ''}
                  onClick={onClose}
                >
                  Available Courses
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/activity`}
                  className={isActive(`/${slug}/activity`) ? 'active' : ''}
                  onClick={onClose}
                >
                  Log Activities
                </a>
              </li>
              <li>
                <a
                  href={`/${slug}/leaderboard`}
                  className={isActive(`/${slug}/leaderboard`) ? 'active' : ''}
                  onClick={onClose}
                >
                  Leaderboard
                </a>
              </li>
            </ul>
          </>
        )}
      </div>
    </>
  );
};

export default Sidebar;
