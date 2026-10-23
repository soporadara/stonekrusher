import { useState, useEffect } from 'react';
import './cms.css';

import CmsLogin from './CmsLogin';
import CmsDashboard from './CmsDashboard';
import CmsBlogManager from './CmsBlogManager';
import CmsCategoryManager from './CmsCategoryManager';
import CmsProductManager from './CmsProductManager';
import CmsMediaLibrary from './CmsMediaLibrary';
import CmsCrmLeads from './CmsCrmLeads';
import CmsSupportTracker from './CmsSupportTracker';
import CmsSeoSuite from './CmsSeoSuite';
import CmsSecurityCenter from './CmsSecurityCenter';
import CmsUserManager from './CmsUserManager';
import CmsSettings from './CmsSettings';
import CmsSystemStatus from './CmsSystemStatus';
import CmsProfileModal from './CmsProfileModal';
import CmsTabErrorBoundary from './CmsTabErrorBoundary';
import CmsCommentManager from './CmsCommentManager';
import konstructzLogo from '../../assets/konstructz_logo.png';

export default function CmsApp({ onBackToSite, initialTab = 'overview' }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [authChecking, setAuthChecking] = useState(true);

  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('cms_session_token') || '');

  // Layout & Theme State
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tabOptions, setTabOptions] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('stonekrusher_cms_sidebar_collapsed') === 'true');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('cms_theme') || 'light');
  const [editingPostId, setEditingPostId] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Sync activeTab if initialTab changes externally
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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
          const sTok = data.session_token || data.token || '';
          if (sTok) {
            setSessionToken(sTok);
            localStorage.setItem('cms_session_token', sTok);
          }
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

  const handleLoginSuccess = (user, token, sessionTok) => {
    setCurrentUser(user);
    setCsrfToken(token);
    const sTok = sessionTok || user?.session_token || user?.token || token || '';
    if (sTok && sTok.length === 64) {
      setSessionToken(sTok);
      localStorage.setItem('cms_session_token', sTok);
    }
    setActiveTab('overview');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth.php?action=logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken }
      });
    } catch {
      // non-fatal
    }
    localStorage.removeItem('cms_session_token');
    setSessionToken('');
    setCurrentUser(null);
    setCsrfToken('');
  };

  const handleNavigate = (tab, options = {}) => {
    setTabOptions(options);
    if (options.postId) {
      setEditingPostId(options.postId);
    } else if (options.mode === 'create') {
      setEditingPostId(null);
    }
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  };

  const handleSelectPostFromDashboard = (postId) => {
    setEditingPostId(postId);
    setActiveTab('posts');
    setTabOptions({});
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

  // Permission Verification
  const canAccess = (requiredPerm) => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    if (!requiredPerm) return true;
    const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    if (perms.includes('*')) return true;
    return perms.includes(requiredPerm);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('stonekrusher_cms_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Structured Professional Navigation Groups (Donezo Style: MENU & GENERAL)
  const navGroups = [
    {
      title: 'MENU',
      items: [
        { id: 'overview', label: 'Dashboard', icon: '📊', perm: 'posts.view' },
        { id: 'topblogs', label: 'Top Blogs', icon: '🔥', perm: 'posts.view', badge: 'PRO' },
        { id: 'posts', label: 'Tasks & Articles', icon: '📝', perm: 'posts.view', badge: '12+' },
        { id: 'comments', label: 'Customer Comments', icon: '💬', perm: 'posts.view' },
        { id: 'products', label: 'Machinery Catalog', icon: '🚜', perm: 'products.view' },
        { id: 'categories', label: 'Categories & Topics', icon: '🏷️', perm: 'categories.manage' },
        { id: 'media', label: 'Media Library', icon: '🖼️', perm: 'media.view' },
        { id: 'crm', label: 'CRM Leads & RFQ', icon: '📋', perm: 'posts.view' },
        { id: 'support', label: 'Support Tickets', icon: '🎫', perm: 'posts.view' },
        { id: 'seo', label: 'Analytics & SEO', icon: '🌐', perm: 'settings.manage' }
      ]
    },
    {
      title: 'GENERAL',
      items: [
        { id: 'users', label: 'Team & Roles', icon: '👥', perm: 'users.view' },
        { id: 'security', label: 'Security Center', icon: '🛡️', perm: 'security.view' },
        { id: 'settings', label: 'Settings', icon: '⚙️', perm: 'settings.manage' },
        { id: 'system', label: 'System & DB Status', icon: '🗄️', perm: 'settings.manage' }
      ]
    }
  ];

  // Current active navigation item metadata
  let activeGroupTitle = 'MENU';
  let activeItemLabel = 'Dashboard';
  for (const group of navGroups) {
    const found = group.items.find(i => i.id === activeTab);
    if (found) {
      activeGroupTitle = group.title;
      activeItemLabel = found.label;
      break;
    }
  }

  return (
    <div className={`cms-root cms-theme-${theme}`}>

      {/* SIDEBAR NAVIGATION (DONEZO COLLAPSIBLE WITH HOVER TOOLTIP) */}
      <aside className={`cms-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileDrawerOpen ? 'mobile-open' : ''}`}>
        
        {/* Brand Header */}
        <div className="cms-sidebar-header">
          <div
            className="cms-brand"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Click to expand sidebar' : undefined}
            data-tooltip="Expand Sidebar"
            style={{ cursor: 'pointer' }}
          >
            <div className="cms-brand-logo" style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0f4c3a',
              flexShrink: 0
            }}>
              <img src={konstructzLogo} alt="StoneKrusher / KONSTRUCTZ" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            </div>
            {!sidebarCollapsed && (
              <div className="cms-brand-text">
                <span className="cms-brand-title">StoneKrusher</span>
                <span className="cms-brand-subtitle">KONSTRUCTZ FLEET OPS</span>
              </div>
            )}
          </div>
          <button
            className="cms-sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Navigation Items with Floating Tooltip on Hover */}
        <nav className="cms-sidebar-nav">
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter(item => canAccess(item.perm));
            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} style={{ display: 'flex', flexDirection: 'column' }}>
                {!sidebarCollapsed && (
                  <div className="cms-nav-group-label">{group.title}</div>
                )}
                {visibleItems.map((item) => (
                  <button
                    key={item.id}
                    className={`cms-nav-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => handleNavigate(item.id)}
                    data-tooltip={item.label}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <span className="cms-nav-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                    {!sidebarCollapsed && item.badge && (
                      <span className="cms-nav-badge">{item.badge}</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer with Donezo Promo Card */}
        <div className="cms-sidebar-footer" style={{ border: 'none', padding: sidebarCollapsed ? '10px 8px' : '12px 14px' }}>
          {!sidebarCollapsed ? (
            <div className="cms-donezo-sidebar-card">
              <div className="cms-donezo-sidebar-card-badge">LIVE FLEET</div>
              <div className="cms-donezo-sidebar-card-title">StoneKrusher Ops</div>
              <div className="cms-donezo-sidebar-card-subtitle">Live sync & catalog fleet active</div>
              <button className="cms-donezo-sidebar-card-btn" onClick={onBackToSite}>
                Open Public Site ↗
              </button>
            </div>
          ) : (
            <button
              className="cms-nav-item cms-donezo-collapsed-btn"
              onClick={onBackToSite}
              data-tooltip="Open Public Website"
              title="Open Public Website"
            >
              <span className="cms-nav-icon">🌐</span>
            </button>
          )}

          <button
            className="cms-nav-item"
            onClick={handleLogout}
            data-tooltip="Logout of Session"
            title={sidebarCollapsed ? 'Logout' : undefined}
            style={{ color: '#ef4444' }}
          >
            <span className="cms-nav-icon">🚪</span>
            {!sidebarCollapsed && <span>Logout</span>}
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

        {/* TOPBAR (DONEZO STYLE: SEARCH PILL, NOTIFICATION ICONS & USER CAPSULE) */}
        <header className="cms-topbar">
          <div className="cms-topbar-left">
            <button
              className="cms-mobile-menu-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open mobile menu"
            >
              ☰
            </button>

            <button
              className="cms-sidebar-toggle"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{ marginRight: '6px' }}
            >
              {sidebarCollapsed ? '⏩' : '⏪'}
            </button>

            {/* Donezo Pill Search Input */}
            <div className="cms-donezo-search-bar">
              <span className="cms-donezo-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search task, post, product..."
                className="cms-donezo-search-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    handleNavigate('posts');
                  }
                }}
              />
              <span className="cms-donezo-search-badge">⌘K</span>
            </div>
          </div>

          <div className="cms-topbar-right">
            {/* Customer Comments Icon */}
            <button
              className="cms-donezo-icon-btn"
              onClick={() => handleNavigate('comments')}
              title="Customer Comments & Feedback"
              data-tooltip="Customer Comments"
            >
              <span>💬</span>
              <span className="cms-donezo-icon-dot" />
            </button>

            {/* Notification Bell */}
            <button
              className="cms-donezo-icon-btn"
              onClick={() => handleNavigate('crm')}
              title="Inbound Quotes & Leads"
              data-tooltip="Inbound Quotes"
            >
              <span>🔔</span>
              <span className="cms-donezo-icon-dot" />
            </button>

            {/* Theme Toggle */}
            <button
              className="cms-donezo-icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>

            {/* Donezo User Capsule */}
            <div
              className="cms-donezo-user-capsule"
              onClick={() => setShowProfileModal(true)}
              title="View Admin Profile & Security"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowProfileModal(true); }}
            >
              <div className="cms-donezo-user-avatar">
                {(currentUser.full_name || currentUser.username || 'T')[0].toUpperCase()}
              </div>
              <div className="cms-donezo-user-info">
                <span className="cms-donezo-user-name">
                  {currentUser.full_name || currentUser.username || 'StoneKrusher Admin'}
                </span>
                <span className="cms-donezo-user-email">
                  {currentUser.email || `${(currentUser.username || 'admin').toLowerCase()}@stonekrusher.com`}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT CANVAS */}
        <main className="cms-content">
          <CmsTabErrorBoundary
            tabName={activeItemLabel}
            tabKey={activeTab}
            onReset={() => setActiveTab('overview')}
          >
            {(activeTab === 'overview' || activeTab === 'topblogs') && (
              <CmsDashboard
                csrfToken={csrfToken}
                initialSubView={activeTab === 'topblogs' ? 'topBlogs' : 'overview'}
                onNavigateTab={handleNavigate}
                onSelectPost={handleSelectPostFromDashboard}
              />
            )}

            {activeTab === 'comments' && (
              <CmsCommentManager csrfToken={csrfToken} />
            )}

            {activeTab === 'posts' && (
              <CmsBlogManager
                csrfToken={csrfToken}
                editingPostId={editingPostId}
                initialStatusFilter={tabOptions.status || ''}
                onClearEditingId={() => setEditingPostId(null)}
              />
            )}

            {activeTab === 'categories' && (
              <CmsCategoryManager csrfToken={csrfToken} />
            )}

            {activeTab === 'products' && (
              <CmsProductManager
                csrfToken={csrfToken}
                initialStatusFilter={tabOptions.status || ''}
              />
            )}

            {activeTab === 'media' && (
              <CmsMediaLibrary
                csrfToken={csrfToken}
                sessionToken={sessionToken}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'crm' && (
              <CmsCrmLeads
                csrfToken={csrfToken}
                initialFilterStatus={tabOptions.status || 'all'}
              />
            )}

            {activeTab === 'support' && (
              <CmsSupportTracker
                csrfToken={csrfToken}
                initialFilterStatus={tabOptions.status || 'all'}
              />
            )}

            {activeTab === 'seo' && (
              <CmsSeoSuite csrfToken={csrfToken} />
            )}

            {activeTab === 'users' && (
              <CmsUserManager csrfToken={csrfToken} currentUser={currentUser} />
            )}

            {activeTab === 'security' && (
              <CmsSecurityCenter csrfToken={csrfToken} currentUser={currentUser} />
            )}

            {activeTab === 'settings' && (
              <CmsSettings csrfToken={csrfToken} />
            )}

            {activeTab === 'system' && (
              <CmsSystemStatus csrfToken={csrfToken} />
            )}
          </CmsTabErrorBoundary>
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
