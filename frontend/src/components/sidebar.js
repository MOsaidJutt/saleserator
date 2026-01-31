import React from 'react';
import './sidebar.css';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ show }) => {
  // Access user role from AuthContext (or replace with your preferred method)
  const { user } = useAuth(); // Assuming user has a 'role' property

  return (
    <div className={`sidenav ${show ? 'active' : ''}`}>
      {/* Admin Panel */}
      {user?.role === 'admin' && (
        <>
          <h2>Admin Panel</h2>
          <ul>
            <li>
              <a href="/admin/dashboard">Dashboard</a>
            </li>
            <li>
              <a href="/admin/CourseUpload">Handle Courses</a>
            </li>
            <li>
              <a href="/admin/CourseRequests">Course Requests</a>
            </li>
            <li>
              <a href="/admin/activities">Handle User Activities</a>
            </li>
            <li>
              <a href="/admin/leaderboard">View Leaderboard</a>
            </li>
            <li>
              <a href="/admin/brand-settings">Brand Settings</a>
            </li>
          </ul>
        </>
      )}

      {/* User (Sales Rep) Panel */}
      {user?.role === 'sales_rep' && (
        <>
          <h2>Welcome {user.name}</h2>
          <ul>
            <li>
              <a href="/dashboard">Dashboard</a>
            </li>
            <li>
              <a href="/AvailableCourses">Available Courses</a>
            </li>
            <li>
              <a href="/activity">Log Activities</a>{' '}
              {/* Link to Activity Form */}
            </li>
            <li>
              <a href="/leaderboard">Leaderboard</a> {/* Link to Leaderboard */}
            </li>
          </ul>
        </>
      )}
    </div>
  );
};

export default Sidebar;
