import { useState, useEffect } from 'react';
import './cms.css';

import CmsLogin from './CmsLogin';
import CmsDashboard from './CmsDashboard';
import CmsBlogManager from './CmsBlogManager';
import CmsCategoryManager from './CmsCategoryManager';
import CmsProductManager from './CmsProductManager';
import CmsMediaLibrary from './CmsMediaLibrary';
import CmsSecurityCenter from './CmsSecurityCenter';
import CmsUserManager from './CmsUserManager';
import CmsSettings from './CmsSettings';
import CmsProfileModal from './CmsProfileModal';

export default function CmsApp({ onBackToSite, initialTab = 'overview' }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [authChecking, setAuthChecking] = useState(true);

  // Layout & Theme State
  const [activeTab, setActiveTab] = useState(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('cms_theme') || 'dark');
  const [editingPostId, setEditingPostId] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Verify Current Session
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth.php?action=me')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          setCsrfToken(data.csrf_token || '');
        } else {
          setCurrentUser(null);
          setCsrfToken('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUser(null);
          setCsrfToken('');
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Theme Sync
  useEffect(() => {
    localStorage.setItem('cms_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setCsrfToken(token);
    setActiveTab('overview');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth.php?action=logout', { method: 'POST' });
    } catch {
      // non-fatal
    }
    setCurrentUser(null);
    setCsrfToken('');
  };

  const handleSelectPostFromDashboard = (postId) => {
    setEditingPostId(postId);
    setActiveTab('posts');
  };

  if (authChecking) {
    return (
      <div className={`cms-root cms-theme-${theme}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--cms-text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '14px', animation: 'spin 1.5s linear infinite' }}>⚡</div>
          <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>Verifying StoneKrusher Administrative Session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className={`cms-root cms-theme-${theme}`}>
        <CmsLogin onLoginSuccess={handleLoginSuccess} onBackToSite={onBackToSite} />
      </div>
    );
  }

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: '📊', group: 'Core' },
    { id: 'posts', label: 'Blog Articles', icon: '📝', group: 'Content' },
    { id: 'categories', label: 'Categories & Topics', icon: '🏷️', group: 'Content' },
    { id: 'products', label: 'Machinery Catalog', icon: '🚜', group: 'Catalog' },
    { id: 'media', label: 'Media Library', icon: '🖼️', group: 'Assets' },
    { id: 'security', label: 'Security Center', icon: '🛡️', group: 'Governance' },
    { id: 'users', label: 'Users & Roles', icon: '👥', group: 'Governance' },
    { id: 'settings', label: 'CMS Configuration', icon: '⚙️', group: 'System' },
  ];

  return (
    <div className={`cms-root cms-theme-${theme}`}>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`cms-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileDrawerOpen ? 'mobile-open' : ''}`}>
        <div className="cms-sidebar-header">
          <div className="cms-brand">
            <div className="cms-brand-logo">⚡</div>
            {!sidebarCollapsed && (
              <div className="cms-brand-text">
                <span className="cms-brand-title">KONSTRUCTZ</span>
                <span className="cms-brand-subtitle">Console CMS</span>
              </div>
            )}
          </div>
          <button
            className="cms-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="cms-sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`cms-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setMobileDrawerOpen(false);
              }}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="cms-nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="cms-sidebar-footer">
          <button className="cms-back-site-btn" onClick={onBackToSite}>
            <span>🌐</span>
            {!sidebarCollapsed && <span>Back to Public Site</span>}
          </button>
        </div>
      </aside>

      {/* BACKDROP FOR MOBILE DRAWER */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 45
          }}
        />
      )}

      {/* MAIN VIEWPORT */}
      <div className={`cms-main-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

        {/* TOPBAR */}
        <header className="cms-topbar">
          <div className="cms-topbar-left">
            <button
              className="cms-mobile-menu-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open mobile menu"
            >
              ☰
            </button>

            <div className="cms-breadcrumbs">
              <span>StoneKrusher CMS</span>
              <span>/</span>
              <span className="crumb-active">
                {navItems.find(i => i.id === activeTab)?.label || 'Console'}
              </span>
            </div>
          </div>

          <div className="cms-topbar-right">
            {/* Theme Toggle */}
            <button
              className="cms-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User Profile */}
            <div
              className="cms-user-menu"
              onClick={() => setShowProfileModal(true)}
              title="Click to view Profile, Password & Google Account linking"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowProfileModal(true); }}
            >
              <div className="cms-user-avatar">
                {(currentUser.full_name || currentUser.username || 'A')[0].toUpperCase()}
              </div>
              <div className="cms-user-info">
                <span className="cms-user-name">
                  {currentUser.full_name || currentUser.username}
                  {currentUser.is_google_linked && (
                    <span style={{ marginLeft: '6px', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '999px', background: 'var(--cms-success-bg)', color: 'var(--cms-success)', fontWeight: '600' }}>
                      Google Linked
                    </span>
                  )}
                </span>
                <span className="cms-user-role">{currentUser.role_display || currentUser.role}</span>
              </div>
            </div>

            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              onClick={() => setShowProfileModal(true)}
              title="My Profile & Security"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <span>⚙️</span> Profile
            </button>

            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              onClick={handleLogout}
              title="End session"
            >
              Logout
            </button>
          </div>
        </header>

        {/* CONTENT CANVAS */}
        <main className="cms-content">
          {activeTab === 'overview' && (
            <CmsDashboard
              onNavigateTab={(tab) => {
                if (tab === 'posts_new') {
                  setEditingPostId(null);
                  setActiveTab('posts');
                } else {
                  setActiveTab(tab);
                }
              }}
              onSelectPost={handleSelectPostFromDashboard}
            />
          )}

          {activeTab === 'posts' && (
            <CmsBlogManager
              csrfToken={csrfToken}
              editingPostId={editingPostId}
              onClearEditingId={() => setEditingPostId(null)}
            />
          )}

          {activeTab === 'categories' && (
            <CmsCategoryManager csrfToken={csrfToken} />
          )}

          {activeTab === 'products' && (
            <CmsProductManager csrfToken={csrfToken} />
          )}

          {activeTab === 'media' && (
            <CmsMediaLibrary csrfToken={csrfToken} />
          )}

          {activeTab === 'security' && (
            <CmsSecurityCenter csrfToken={csrfToken} currentUser={currentUser} />
          )}

          {activeTab === 'users' && (
            <CmsUserManager csrfToken={csrfToken} currentUser={currentUser} />
          )}

          {activeTab === 'settings' && (
            <CmsSettings csrfToken={csrfToken} />
          )}
        </main>

      </div>

      {/* Profile & Google Account Modal */}
      <CmsProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        csrfToken={csrfToken}
      />
    </div>
  );
}
