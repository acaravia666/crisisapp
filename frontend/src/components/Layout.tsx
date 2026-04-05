import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

const Layout = () => {
  const location = useLocation();
  const hideNav = location.pathname.includes('request') && !location.pathname.includes('requests');

  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <main id="main-content" className="content-scroll relative-container">
        <div 
          style={{ 
            position: 'absolute', top: '10px', right: '10px', zIndex: 1000,
            background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold',
            padding: '2px 8px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}
        >
          LIVE UPDATE ACTIVE
        </div>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default Layout;
