import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SignUp from './pages/SignUp';
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

export default function App() {
  const { user } = useAuth();
  return (
    <>
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/superadmin" element={<SuperAdmin />} />

          {/* User Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="sales_rep">
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/AvailableCourses"
            element={
              <ProtectedRoute role="sales_rep">
                <AvailableCourses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/detail/:courseId"
            element={
              <ProtectedRoute role="sales_rep">
                <CourseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:courseId/video/:assetId"
            element={
              <ProtectedRoute role="sales_rep">
                <VideoWatch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute role="sales_rep">
                <ActivityPage userId={user?.user_id} />{' '}
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute role="sales_rep">
                <LeaderboardPage />{' '}
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/CourseRequests"
            element={
              <ProtectedRoute role="admin">
                <CourseRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/CourseUpload"
            element={
              <ProtectedRoute role="admin">
                <CourseUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/courses/:id/edit"
            element={
              <ProtectedRoute role="admin">
                <EditCourseVideos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/activities"
            element={
              <ProtectedRoute role="admin">
                <AdminActivity />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaderboard"
            element={
              <ProtectedRoute role="admin">
                <AdminLeaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/leaderboard/user/:userId"
            element={
              <ProtectedRoute role="admin">
                <AdminLeaderboardUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/brand-settings"
            element={
              <ProtectedRoute role="admin">
                <BrandSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tv" element={<TvMode />}
          />
        </Routes>
      </div>
    </>
  );
}
