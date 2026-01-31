import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../brand/BrandProvider';
import Sidebar from './sidebar';
import { GiHamburgerMenu } from 'react-icons/gi';
import { AiFillHome } from 'react-icons/ai';
import './navbar.css';

function Nav() {
  const { user, logout } = useAuth();
  const { brand } = useBrand(); // { name, logo }
  const [showSidebar, setShowSidebar] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const navigate = useNavigate();

  const BASE_NAVBAR_HEIGHT = 80;

  useEffect(() => {
    if (showSidebar) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [showSidebar]);

  useEffect(() => {
    if (!showSidebar) return;
    const onKey = (e) => e.key === 'Escape' && setShowSidebar(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSidebar]);

  return (
    <div>
      {/* Fixed navbar */}
      <header className="nav" style={{ height: BASE_NAVBAR_HEIGHT }}>
        <div className="nav-top">
          {/* LEFT: burger + brand */}
          <div className="nav-left">
            <button
              className="nav-burger"
              onClick={() => setShowSidebar((v) => !v)}
              aria-label="Open menu"
            >
              <GiHamburgerMenu />
            </button>

            <div
              className="nav-brand"
              onClick={() => setZoomed(true)}
              role="button"
              aria-label="Zoom logo"
              title={brand.name}
            >
              {brand.logo ? (
                <img className="nav-logo" src={brand.logo} alt="Logo" />
              ) : (
                <div className="nav-logo nav-logo--placeholder" />
              )}
              <h1 className="nav-title">{brand.name}</h1>
            </div>
          </div>

          {/* RIGHT: actions */}
          <div className="nav-actions">
            {user && user.role === 'admin' && (
              <button
                className="nav-btn nav-btn-outline"
                onClick={() => navigate('/admin/dashboard')}
                aria-label="Admin Dashboard"
                title="Admin Dashboard"
                type="button"
              >
                <AiFillHome />
              </button>
            )}
            {user && user.role === 'admin' && (
              <button
                className="nav-btn nav-btn-solid"
                onClick={() => navigate('/admin/brand-settings')}
                type="button"
              >
                Brand Settings
              </button>
            )}
            {user && user.role !== 'admin' && (
              <button
                className="nav-btn nav-btn-outline"
                onClick={() => navigate('/dashboard')}
                aria-label="Dashboard"
                title="Dashboard"
                type="button"
              >
                <AiFillHome />
              </button>
            )}
            {user && (
              <button
                className="nav-btn nav-btn-outline"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                type="button"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Zoom Modal */}
      {zoomed && (
        <div className="zoom" onClick={() => setZoomed(false)}>
          {brand.logo && (
            <img
              src={brand.logo}
              alt="Logo"
              className="zoom__img"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Sidebar + Backdrop */}
      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
      <div
        className={`sidebar-backdrop ${showSidebar ? 'show' : ''}`}
        onClick={() => setShowSidebar(false)}
        aria-hidden={!showSidebar}
        style={{ top: BASE_NAVBAR_HEIGHT }}
      />

      {/* Spacer so content doesn’t hide under fixed navbar */}
      <div style={{ height: BASE_NAVBAR_HEIGHT }} />
    </div>
  );
}

export default Nav;
