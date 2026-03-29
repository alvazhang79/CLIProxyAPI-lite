import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('session_token');
    navigate('/login');
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-10">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img src="/logo-icon.svg" alt="logo" className="w-8 h-8" />
          <div>
            <div className="font-mono font-bold text-coral text-sm tracking-wide">
              CLIProxy<span className="text-navy">API</span>
            </div>
            <div className="text-xs text-teal font-medium">Lite</div>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 {t('nav.dashboard')}
        </NavLink>
        <NavLink to="/keys" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          🔑 {t('nav.keys')}
        </NavLink>
        <NavLink to="/models" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          🤖 {t('nav.models')}
        </NavLink>
        <NavLink to="/providers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          🌐 {t('nav.providers')}
        </NavLink>
        <NavLink to="/embeddings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 {t('nav.embeddings')}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          ⚙️ {t('nav.settings')}
        </NavLink>
        <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📋 {t('nav.logs')}
        </NavLink>
      </div>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="nav-link w-full text-red-500 hover:bg-red-50"
        >
          🚪 {t('common.logout')}
        </button>
      </div>
    </nav>
  );
}
