import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

const Layout = () => {
  const location = useLocation();
  const hideNav = location.pathname.includes('request') && !location.pathname.includes('requests');

  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <main id="main-content" className="content-scroll">
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default Layout;
