import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const PrivateRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex bg-bg-primary h-full items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/onboarding" />;
};

export default PrivateRoute;
