import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, AlertTriangle, Package, User } from 'lucide-react';

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink 
        to="/" 
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="Home"
      >
        <Home className="nav-icon" />
        <span>Home</span>
      </NavLink>
      <NavLink 
        to="/requests" 
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="Gear Feed"
      >
        <div className="relative">
          <AlertTriangle className="nav-icon" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-urgency-emergency rounded-full animate-pulse"></div>
        </div>
        <span>Feed</span>
      </NavLink>
      <NavLink 
        to="/inventory" 
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="My Gear"
      >
        <div className="nav-icon-container">
          <Package className="nav-icon" />
        </div>
        <span>Gear</span>
      </NavLink>
      <NavLink 
        to="/profile" 
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="My Profile"
      >
        <User className="nav-icon" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
