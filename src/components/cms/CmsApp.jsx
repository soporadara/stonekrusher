import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [headerSearch, setHeaderSearch] = useState('');
  const [tooltipPos, setTooltipPos] = useState(null); // { left: number, top: number, text: string }

  const [expandedMenus, setExpandedMenus] = useState(() => ({
    'grp-dashboard': true,
    'grp-editorial': true,
    'grp-sales': true,
    'grp-admin': true
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
    hideTooltip();
  };

  const handleSelectPostFromDashboard = (postId) => {
    setEditingPostId(postId);
    setActiveTab('posts');
    setTabOptions({});
  };

  // Floating Portal Tooltip for Collapsed Sidebar
  const showTooltip = (e, text) => {
    if (!sidebarCollapsed || typeof window === 'undefined') return;
    const target = e.currentTarget || e.target;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    setTooltipPos({
      left: rect.right + 10,
      top: rect.top + rect.height / 2,
      text,
    });
  };

  const hideTooltip = () => {
    setTooltipPos(null);
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
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );

  const IconMachinery = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17h20M6 17v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4M14 11V7a2 2 0 0 1 2-2h3l3 4v8M2 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M18 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
    </svg>
  );

  const IconEditorial = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );

  const IconMedia = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );

  const IconSales = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );

  const IconSeo = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );

  const IconAdmin = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );

  const IconChevron = ({ open }) => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const IconChevronLeft = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );

  const IconChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  const IconPlus = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const IconLogout = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  const IconX = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  const IconComments = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );

  const IconBell = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );

  const IconSun = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  const IconGlobe = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );

  const toggleSidebar = () => {
    hideTooltip();
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
          badge: '139',
          quickAddTab: 'products',
          quickAddOptions: { mode: 'create' },
          quickAddTitle: 'Add Product'
        },
        {
          id: 'grp-editorial',
          label: 'Article',
          icon: <IconEditorial />,
          perm: 'posts.view',
          quickAddTab: 'posts',
          quickAddOptions: { mode: 'create' },
          quickAddTitle: 'Write Article',
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

  // Resolve user initials and titles
  const userInitials = (currentUser?.full_name || currentUser?.username || 'A')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AD';

  const userDisplayName = currentUser?.full_name || currentUser?.username || 'Administrator';
  const userRoleTitle = currentUser?.role === 'super_admin' ? 'Super Admin' : (currentUser?.role === 'admin' ? 'Admin' : 'Staff & Security');

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

      {/* SIDEBAR NAVIGATION (RAFELBLOG + STONEKRUSHER MODERN INDUSTRIAL HYBRID) */}
      <aside className={`cms-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileDrawerOpen ? 'mobile-open' : ''}`}>
        
        {/* Floating Collapse / Expand Edge Button (Rafelblog Style) */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="cms-floating-collapse-btn hidden md:flex items-center justify-center group"
          onMouseEnter={e => {
            showTooltip(e, sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar');
          }}
          onMouseMove={e => showTooltip(e, sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar')}
          onMouseLeave={hideTooltip}
          aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>

        {/* Brand Header */}
        <div className="cms-sidebar-header">
          <div
            className="cms-brand"
            onClick={() => handleNavigate('overview')}
            onMouseEnter={e => showTooltip(e, 'Dashboard')}
            onMouseLeave={hideTooltip}
            style={{ cursor: 'pointer', width: '100%', textDecoration: 'none' }}
          >
            <div className="cms-brand-logo">
              <img src={konstructzLogo} alt="StoneKrusher / KONSTRUCTZ" />
            </div>
            {!sidebarCollapsed && (
              <div className="cms-brand-text">
                <span className="cms-brand-title">StoneKrusher</span>
                <span className="cms-brand-subtitle">KONSTRUCTZ FLEET OPS</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Menu */}
        <nav className="cms-sidebar-nav custom-admin-scroll" onScroll={hideTooltip}>
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
                {!sidebarCollapsed ? (
                  <div className="cms-nav-group-label">{section.groupTitle}</div>
                ) : (
                  sIdx > 0 && <div className="cms-nav-collapsed-divider" />
                )}

                {visibleItems.map(item => {
                  if (item.subItems) {
                    const visibleSubs = item.subItems.filter(sub => canAccess(sub.perm));
                    if (visibleSubs.length === 0) return null;
                    const isChildActive = visibleSubs.some(sub => sub.id === activeTab);
                    const isOpen = !!expandedMenus[item.id];

                    return (
                      <div key={item.id} className="cms-nav-group-wrapper" data-active-nav={isChildActive ? 'true' : 'false'}>
                        <div
                          className={`cms-nav-item cms-nav-parent ${isChildActive ? 'active-parent' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
                          onClick={(e) => handleParentClick(item, e)}
                          onMouseEnter={e => showTooltip(e, item.label)}
                          onMouseLeave={hideTooltip}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="cms-nav-parent-main">
                            <div className="cms-nav-icon-box">
                              {item.icon}
                            </div>
                            {!sidebarCollapsed && <span className="cms-nav-label">{item.label}</span>}
                          </div>

                          {!sidebarCollapsed && (
                            <div className="cms-nav-right-actions">
                              {item.quickAddTab && (
                                <span
                                  className="cms-nav-quick-add"
                                  title={item.quickAddTitle || 'Quick Create'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigate(item.quickAddTab, item.quickAddOptions || {});
                                  }}
                                >
                                  <IconPlus />
                                </span>
                              )}
                              {isChildActive && (
                                <span className="cms-nav-active-dot" />
                              )}
                              <span
                                className="cms-nav-chevron"
                                onClick={(e) => handleChevronClick(item.id, e)}
                                title={isOpen ? 'Collapse submenu' : 'Expand submenu'}
                              >
                                <IconChevron open={isOpen} />
                              </span>
                            </div>
                          )}
                        </div>

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
                                  {isActive && !sub.badge && (
                                    <span className="cms-submenu-active-dot" />
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
                    <div key={item.id} className="cms-nav-group-wrapper" data-active-nav={isActive ? 'true' : 'false'}>
                      <button
                        type="button"
                        className={`cms-nav-item ${isActive ? 'active' : ''} ${sidebarCollapsed ? 'is-collapsed' : ''}`}
                        onClick={() => handleNavigate(item.id)}
                        onMouseEnter={e => showTooltip(e, item.label)}
                        onMouseLeave={hideTooltip}
                      >
                        <div className="cms-nav-parent-main">
                          <div className="cms-nav-icon-box">
                            {item.icon}
                          </div>
                          {!sidebarCollapsed && <span className="cms-nav-label">{item.label}</span>}
                        </div>

                        {!sidebarCollapsed && (
                          <div className="cms-nav-right-actions">
                            {item.quickAddTab && (
                              <span
                                className="cms-nav-quick-add"
                                title={item.quickAddTitle || 'Quick Create'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigate(item.quickAddTab, item.quickAddOptions || {});
                                }}
                              >
                                <IconPlus />
                              </span>
                            )}
                            {item.badge && (
                              <span className="cms-nav-badge">{item.badge}</span>
                            )}
                            {isActive && !item.badge && (
                              <span className="cms-nav-active-dot" />
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer User Card & Actions */}
        <div className="cms-sidebar-footer">
          {/* User Account Card (Rafelblog Style) */}
          <div
            className="cms-sidebar-user-card"
            onClick={() => setShowProfileModal(true)}
            onMouseEnter={e => showTooltip(e, `${userDisplayName} (Account & Security)`)}
            onMouseLeave={hideTooltip}
            title={sidebarCollapsed ? `${userDisplayName} (Account & Security)` : undefined}
            role="button"
            tabIndex={0}
          >
            <div className="cms-sidebar-user-avatar">
              {currentUser?.avatar_url ? (
                <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.src = konstructzLogo; }} />
              ) : (
                <img src={konstructzLogo} alt="StoneKrusher" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain', background: '#0f4c3a', padding: '3px' }} />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="cms-sidebar-user-details">
                <span className="cms-sidebar-user-name">{userDisplayName}</span>
                <span className="cms-sidebar-user-sub">{userRoleTitle}</span>
              </div>
            )}
          </div>

          {/* Compact Action Pills */}
          <div className="cms-sidebar-footer-actions">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="cms-sidebar-action-btn"
              onMouseEnter={e => showTooltip(e, 'Open Live Website')}
              onMouseLeave={hideTooltip}
              title={sidebarCollapsed ? 'Open Live Website' : undefined}
            >
              <IconGlobe />
              {!sidebarCollapsed && <span>Live Site</span>}
            </a>

            <button
              type="button"
              className="cms-sidebar-action-btn cms-sidebar-logout-btn"
              onClick={handleLogout}
              onMouseEnter={e => showTooltip(e, 'Sign Out')}
              onMouseLeave={hideTooltip}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <IconLogout />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Floating Tooltip Portal for Collapsed Sidebar */}
      {typeof document !== 'undefined' && sidebarCollapsed && tooltipPos && createPortal(
        <div
          className="cms-sidebar-floating-tooltip"
          style={{
            position: 'fixed',
            left: tooltipPos.left,
            top: tooltipPos.top,
            transform: 'translateY(-50%)',
            background: theme === 'dark' ? '#091017' : '#0f172a',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.45), 0 4px 10px -2px rgba(0, 0, 0, 0.3)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)'}`,
            letterSpacing: '0.015em',
            animation: 'cmsTooltipIn 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <span>{tooltipPos.text}</span>
          <div
            style={{
              position: 'absolute',
              left: -5,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: `5px solid ${theme === 'dark' ? '#091017' : '#0f172a'}`
            }}
          />
        </div>,
        document.body
      )}

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

        {/* TOPBAR (RAFELBLOG + STONEKRUSHER HYBRID PERFECTION) */}
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

            {/* Modern Search Input with Clear Button */}
            <div className="cms-donezo-search-bar">
              <span className="cms-donezo-search-icon">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search fleet, articles, inquiries..."
                value={headerSearch}
                onChange={e => setHeaderSearch(e.target.value)}
                className="cms-donezo-search-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && headerSearch.trim()) {
                    handleNavigate('posts', { search: headerSearch.trim() });
                  }
                }}
              />
              {headerSearch ? (
                <button
                  type="button"
                  className="cms-search-clear-btn"
                  onClick={() => setHeaderSearch('')}
                  title="Clear search"
                >
                  <IconX />
                </button>
              ) : (
                <span className="cms-donezo-search-badge">⌘K</span>
              )}
            </div>
          </div>

          <div className="cms-topbar-right">
            {/* Live Site Link Pill */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="cms-topbar-pill-btn"
              title="Open Live Public Website"
            >
              <IconGlobe />
              <span className="hidden sm:inline">Live Site</span>
            </a>

            {/* Theme Toggle Pill */}
            <button
              type="button"
              className="cms-topbar-pill-btn cms-theme-toggle-pill"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? (
                <>
                  <IconSun />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <IconMoon />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Comments Icon */}
            <button
              className="cms-donezo-icon-btn"
              onClick={() => handleNavigate('comments')}
              title="Customer Reviews & Comments"
            >
              <IconComments />
              <span className="cms-donezo-icon-dot" />
            </button>

            {/* Inbound Quotes & Leads Bell */}
            <button
              className="cms-donezo-icon-btn"
              onClick={() => handleNavigate('crm')}
              title="Inbound Quotes & RFQs"
            >
              <IconBell />
              <span className="cms-donezo-icon-dot" />
            </button>

            {/* Vertical Divider */}
            <div className="cms-topbar-divider" />

            {/* User Profile Capsule */}
            <div
              className="cms-donezo-user-capsule"
              onClick={() => setShowProfileModal(true)}
              title="View Profile & Security"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowProfileModal(true); }}
            >
              <div className="cms-donezo-user-avatar-wrap">
                <div className="cms-donezo-user-avatar">
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.src = konstructzLogo; }} />
                  ) : (
                    <img src={konstructzLogo} alt="StoneKrusher" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain', background: '#0f4c3a', padding: '3px' }} />
                  )}
                </div>
                <span className="cms-user-status-dot-indicator" title="Active session" />
              </div>
              <div className="cms-donezo-user-info">
                <span className="cms-donezo-user-name">
                  {userDisplayName}
                </span>
                <span className="cms-donezo-user-email">
                  {userRoleTitle}
                </span>
              </div>
              <svg className="cms-user-capsule-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
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
