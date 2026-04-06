import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, AlertTriangle, Package, User } from 'lucide-react';
import { useSettings } from '../store/SettingsContext';

const BottomNav = () => {
  const { t } = useSettings();

  return (
    <nav className="bottom-nav">
      <NavLink
        to="/"
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="Home"
      >
        <Home className="nav-icon" />
        <span>{t('nav.home')}</span>
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
        <span>{t('nav.feed')}</span>
      </NavLink>
      <NavLink
        to="/inventory"
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="My Gear"
      >
        <div className="nav-icon-container">
          <Package className="nav-icon" />
        </div>
        <span>{t('nav.gear')}</span>
      </NavLink>
      <NavLink
        to="/profile"
        className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''} active-press`}
        aria-label="My Profile"
      >
        <User className="nav-icon" />
        <span>{t('nav.profile')}</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
