// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import ForgotPassword from './pages/ForgotPassword';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import SuperAdmin from './pages/SuperAdmin';
import TvMode from './pages/TvMode';

import UserDashboard from './pages/user/Dashboard';
import AvailableCourses from './pages/user/AvailableCourses';
import CourseDetail from './pages/user/CourseDetail';
import VideoWatch from './pages/user/VideoWatch';
import ActivityPage from './pages/user/ActivityForm';
import LeaderboardPage from './pages/user/Leaderboard';

import AdminDashboard from './pages/admin/Dashboard';
import CourseRequests from './pages/admin/CourseRequests';
import CourseUpload from './pages/admin/CourseUpload';
import EditCourseVideos from './pages/admin/EditCourseVideos';
import BrandSettings from './pages/admin/BrandSettings';
import AdminActivity from './pages/admin/ActivityPage';
import AdminLeaderboard from './pages/admin/Leaderboard';
import AdminLeaderboardUser from './pages/admin/Leaderboarduser';
import AdminUsers from './pages/admin/Users'; // new
import CompanySettings from './pages/admin/CompanySettings';

export default function App() {
  const { user } = useAuth();

  return (
    <div className="container">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/forgot" element={<ForgotPassword />} />

        {/* Signup is disabled — redirect to signin */}
        <Route path="/signup" element={<Navigate to="/signin" replace />} />

        {/* Superadmin — TODO: protect this properly later */}
        <Route path="/superadmin" element={<SuperAdmin />} />

        <Route path="/tv" element={<TvMode />} />

        {/* ── User Routes ── */}
        <Route
          path="/:company_slug/dashboard"
          element={
            <ProtectedRoute role="sales_rep">
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/courses"
          element={
            <ProtectedRoute role="sales_rep">
              <AvailableCourses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/courses/detail/:courseId"
          element={
            <ProtectedRoute role="sales_rep">
              <CourseDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/courses/:courseId/video/:assetId"
          element={
            <ProtectedRoute role="sales_rep">
              <VideoWatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/activity"
          element={
            <ProtectedRoute role="sales_rep">
              <ActivityPage userId={user?.user_id} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/leaderboard"
          element={
            <ProtectedRoute role="sales_rep">
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />

        {/* ── Admin Routes ── */}
        <Route
          path="/:company_slug/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/users"
          element={
            <ProtectedRoute role="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/course-requests"
          element={
            <ProtectedRoute role="admin">
              <CourseRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/courses/upload"
          element={
            <ProtectedRoute role="admin">
              <CourseUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/courses/:id/edit"
          element={
            <ProtectedRoute role="admin">
              <EditCourseVideos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/activities"
          element={
            <ProtectedRoute role="admin">
              <AdminActivity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/leaderboard"
          element={
            <ProtectedRoute role="admin">
              <AdminLeaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/leaderboard/user/:userId"
          element={
            <ProtectedRoute role="admin">
              <AdminLeaderboardUser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/:company_slug/admin/brand-settings"
          element={
            <ProtectedRoute role="admin">
              <BrandSettings />
            </ProtectedRoute>
          }
        />
         <Route
          path="/:company_slug/admin/company-settings"
          element={
            <ProtectedRoute role="admin">
              <CompanySettings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}