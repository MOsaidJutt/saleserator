// src/routes/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  const { company_slug } = useParams();

  // Not logged in
  if (!user) return <Navigate to="/signin" replace />;

  // Wrong role
  if (role && user.role !== role) return <Navigate to="/signin" replace />;

  // Logged in user trying to access a different company's URL
  if (company_slug && user.company_slug !== company_slug) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}