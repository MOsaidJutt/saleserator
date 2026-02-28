// src/components/Sidebar.jsx
import React from 'react';
import './sidebar.css';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ show }) => {
  const { user } = useAuth();
  const slug = user?.company_slug;

  return (
    <div className={`sidenav ${show ? 'active' : ''}`}>

      {/* Admin Panel */}
      {user?.role === 'admin' && (
        <>
          <h2>Admin Panel</h2>
          <ul>
            <li><a href={`/${slug}/admin/dashboard`}>Dashboard</a></li>
            <li><a href={`/${slug}/admin/courses/upload`}>Handle Courses</a></li>
            <li><a href={`/${slug}/admin/course-requests`}>Course Requests</a></li>
            <li><a href={`/${slug}/admin/activities`}>Handle User Activities</a></li>
            <li><a href={`/${slug}/admin/leaderboard`}>View Leaderboard</a></li>
            <li><a href={`/${slug}/admin/users`}>Manage Users</a></li>
            <li><a href={`/${slug}/admin/brand-settings`}>Brand Settings</a></li>
          </ul>
        </>
      )}

      {/* User (Sales Rep) Panel */}
      {user?.role === 'sales_rep' && (
        <>
          <h2>Welcome {user.name}</h2>
          <ul>
            <li><a href={`/${slug}/dashboard`}>Dashboard</a></li>
            <li><a href={`/${slug}/courses`}>Available Courses</a></li>
            <li><a href={`/${slug}/activity`}>Log Activities</a></li>
            <li><a href={`/${slug}/leaderboard`}>Leaderboard</a></li>
          </ul>
        </>
      )}

    </div>
  );
};

export default Sidebar;