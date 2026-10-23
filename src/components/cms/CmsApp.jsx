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
import CmsProfileModal from './CmsProfileModal';
import CmsTabErrorBoundary from './CmsTabErrorBoundary';
import CmsCommentManager from './CmsCommentManager';
import konstructzLogo from '../../assets/konstructz_logo.png';

const SUBMENU_PARENT_MAP = {
  overview: 'grp-dashboard',
  analytics: 'grp-dashboard',
  topblogs: 'grp-dashboard',
  posts: 'grp-editorial',
  'create-post': 'grp-editorial',
  categories: 'grp-editorial',
  comments: 'grp-editorial',
  crm: 'grp-sales',
  leads: 'grp-sales',
  support: 'grp-sales',
  users: 'grp-admin',
  security: 'grp-admin',
  settings: 'grp-admin'
};

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
  const [expandedMenus, setExpandedMenus] = useState(() => ({
    'grp-dashboard': true,
    'grp-editorial': true,
    'grp-sales': false,
    'grp-admin': false
  }));

  // Auto-expand parent group when activeTab changes
  useEffect(() => {
    const parentId = SUBMENU_PARENT_MAP[activeTab];
    if (parentId) {
      setExpandedMenus(prev => ({ ...prev, [parentId]: true }));
    }
  }, [activeTab]);

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

  const handleLoginSuccess = (user, csrfTok, sessionTok) => {
    setCurrentUser(user);
    setCsrfToken(csrfTok);
    const sTok = sessionTok || user?.session_token || user?.token || '';
    if (sTok && sTok.length === 64) {
      setSessionToken(sTok);
      localStorage.setItem('cms_session_token', sTok);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const redirectTarget = urlParams.get('redirect');
    if (redirectTarget && (redirectTarget.startsWith('/medialibrary') || redirectTarget.startsWith('/'))) {
      window.location.href = redirectTarget;
      return;
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

  // Modern Vector SVG Icons for Professional Enterprise UI
  const IconDashboard = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );

  const IconMachinery = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17h20M6 17v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4M14 11V7a2 2 0 0 1 2-2h3l3 4v8M2 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M18 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
    </svg>
  );

  const IconEditorial = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );

  const IconMedia = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );

  const IconSales = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );

  const IconSeo = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );

  const IconAdmin = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );

  const IconChevron = ({ open }) => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)'
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  const IconLogout = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );

  const IconSidebarToggle = ({ collapsed }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      {collapsed ? (
        <polyline points="13 9 16 12 13 15" />
      ) : (
        <polyline points="16 9 13 12 16 15" />
      )}
    </svg>
  );

  const IconSearch = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );

  const IconComments = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );

  const IconBell = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );

  const IconSun = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );

  const IconMoon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  const IconMenu = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );

  const IconExternalLink = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );

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

  // Structured Navigation with Short, Clean Professional Labels
  const navSections = [
    {
      groupTitle: 'OPERATIONS',
      items: [
        {
          id: 'grp-dashboard',
          label: 'Dashboard',
          icon: <IconDashboard />,
          perm: 'posts.view',
          subItems: [
            { id: 'overview', label: 'Overview', perm: 'posts.view' },
            { id: 'topblogs', label: 'Analytics', perm: 'posts.view', badge: 'PRO' }
          ]
        },
        {
          id: 'products',
          label: 'Product',
          icon: <IconMachinery />,
          perm: 'products.view',
          badge: '139'
        },
        {
          id: 'grp-editorial',
          label: 'Article',
          icon: <IconEditorial />,
          perm: 'posts.view',
          subItems: [
            { id: 'posts', label: 'Articles', perm: 'posts.view' },
            { id: 'categories', label: 'Categories', perm: 'categories.manage' },
            { id: 'comments', label: 'Comments', perm: 'posts.view' }
          ]
        },
        {
          id: 'media',
          label: 'Media',
          icon: <IconMedia />,
          perm: 'media.view'
        },
        {
          id: 'grp-sales',
          label: 'Customer',
          icon: <IconSales />,
          perm: 'posts.view',
          subItems: [
            { id: 'crm', label: 'Leads', perm: 'posts.view' },
            { id: 'support', label: 'Support', perm: 'posts.view' }
          ]
        },
        {
          id: 'seo',
          label: 'SEO',
          icon: <IconSeo />,
          perm: 'settings.manage'
        }
      ]
    },
    {
      groupTitle: 'SETTINGS',
      items: [
        {
          id: 'grp-admin',
          label: 'Settings',
          icon: <IconAdmin />,
          perm: 'security.view',
          subItems: [
            { id: 'users', label: 'Team', perm: 'users.view' },
            { id: 'security', label: 'Security', perm: 'security.view' },
            { id: 'settings', label: 'General', perm: 'settings.manage' }
          ]
        }
      ]
    }
  ];


  const handleParentClick = (item, e) => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedMenus(prev => ({ ...prev, [item.id]: true }));
      if (item.subItems && item.subItems.length > 0) {
        const firstPerm = item.subItems.find(sub => canAccess(sub.perm));
        if (firstPerm) handleNavigate(firstPerm.id);
      }
      return;
    }
    setExpandedMenus(prev => {
      const nextOpen = !prev[item.id];
      if (nextOpen && item.subItems && item.subItems.length > 0) {
        const childActive = item.subItems.some(sub => sub.id === activeTab);
        if (!childActive) {
          const firstPerm = item.subItems.find(sub => canAccess(sub.perm));
          if (firstPerm) handleNavigate(firstPerm.id);
        }
      }
      return { ...prev, [item.id]: nextOpen };
    });
  };

  const handleChevronClick = (itemId, e) => {
    e.stopPropagation();
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedMenus(prev => ({ ...prev, [itemId]: true }));
      return;
    }
    setExpandedMenus(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Resolve current active item label for breadcrumbs / error boundaries
  let activeSectionTitle = 'OPERATIONS';
  let activeItemLabel = 'Dashboard';
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.id === activeTab) {
        activeSectionTitle = section.groupTitle;
        activeItemLabel = item.label;
        break;
      }
      if (item.subItems) {
        const foundSub = item.subItems.find(s => s.id === activeTab);
        if (foundSub) {
          activeSectionTitle = section.groupTitle;
          activeItemLabel = foundSub.label;
          break;
        }
      }
    }
  }

  return (
    <div className={`cms-root cms-theme-${theme}`}>

      {/* SIDEBAR NAVIGATION (DONEZO COLLAPSIBLE WITH SUBMENUS & HOVER TOOLTIP) */}
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
                <span className="cms-brand-subtitle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  KONSTRUCTZ FLEET OPS
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items with Main Menu & Submenus */}
        <nav className="cms-sidebar-nav">
          {navSections.map((section, sIdx) => {
            const visibleItems = section.items.filter(item => {
              if (item.subItems) {
                return item.subItems.some(sub => canAccess(sub.perm));
              }
              return canAccess(item.perm);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className="cms-nav-section">
                {!sidebarCollapsed && (
                  <div className="cms-nav-group-label">{section.groupTitle}</div>
                )}
                {visibleItems.map(item => {
                  if (item.subItems) {
                    const visibleSubs = item.subItems.filter(sub => canAccess(sub.perm));
                    if (visibleSubs.length === 0) return null;
                    const isChildActive = visibleSubs.some(sub => sub.id === activeTab);
                    const isOpen = !!expandedMenus[item.id];

                    return (
                      <div key={item.id} className="cms-nav-group-wrapper">
                        <button
                          type="button"
                          className={`cms-nav-item cms-nav-parent ${isChildActive ? 'active-parent' : ''}`}
                          onClick={(e) => handleParentClick(item, e)}
                          data-tooltip={item.label}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <div className="cms-nav-parent-main">
                            <span className="cms-nav-icon">{item.icon}</span>
                            {!sidebarCollapsed && <span className="cms-nav-label">{item.label}</span>}
                          </div>
                          {!sidebarCollapsed && (
                            <span
                              className="cms-nav-chevron"
                              onClick={(e) => handleChevronClick(item.id, e)}
                              title={isOpen ? 'Collapse submenu' : 'Expand submenu'}
                            >
                              <IconChevron open={isOpen} />
                            </span>
                          )}
                        </button>

                        {!sidebarCollapsed && isOpen && (
                          <div className="cms-nav-submenu">
                            {visibleSubs.map(sub => {
                              const isActive = activeTab === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  className={`cms-submenu-item ${isActive ? 'active' : ''}`}
                                  onClick={() => handleNavigate(sub.id)}
                                >
                                  <div className="cms-submenu-item-left">
                                    <span className="cms-submenu-dot" />
                                    <span className="cms-submenu-label">{sub.label}</span>
                                  </div>
                                  {sub.badge && (
                                    <span className={`cms-nav-badge ${sub.badge === 'PRO' ? 'pro' : ''}`}>
                                      {sub.badge}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Direct item without sub-items
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`cms-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavigate(item.id)}
                      data-tooltip={item.label}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="cms-nav-icon">{item.icon}</span>
                      {!sidebarCollapsed && <span className="cms-nav-label">{item.label}</span>}
                      {!sidebarCollapsed && item.badge && (
                        <span className="cms-nav-badge">{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="cms-sidebar-footer" style={{ border: 'none', padding: sidebarCollapsed ? '10px 8px' : '12px 14px', gap: '8px' }}>
          <button
            className="cms-nav-item"
            onClick={onBackToSite}
            data-tooltip="Open Public Website"
            title={sidebarCollapsed ? 'Open Public Website' : undefined}
          >
            <span className="cms-nav-icon"><IconExternalLink /></span>
            {!sidebarCollapsed && <span>Public Site</span>}
          </button>

          <button
            className="cms-nav-item cms-logout-btn"
            onClick={handleLogout}
            data-tooltip="Sign out of administrative session"
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            style={{ color: '#ef4444' }}
          >
            <span className="cms-nav-icon"><IconLogout /></span>
            {!sidebarCollapsed && <span>Sign Out</span>}
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
              <IconMenu />
            </button>

            <button
              className="cms-sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <IconSidebarToggle collapsed={sidebarCollapsed} />
            </button>

            {/* Donezo Pill Search Input */}
            <div className="cms-donezo-search-bar">
              <span className="cms-donezo-search-icon">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search fleet, articles, RFQs..."
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
              title="Customer Reviews & Comments"
              data-tooltip="Customer Comments"
            >
              <IconComments />
              <span className="cms-donezo-icon-dot" />
            </button>

            {/* Notification Bell */}
            <button
              className="cms-donezo-icon-btn"
              onClick={() => handleNavigate('crm')}
              title="Inbound Quotes & RFQs"
              data-tooltip="Inbound Quotes"
            >
              <IconBell />
              <span className="cms-donezo-icon-dot" />
            </button>

            {/* Theme Toggle */}
            <button
              className="cms-donezo-icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
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
