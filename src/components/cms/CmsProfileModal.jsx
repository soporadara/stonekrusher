import { useState, useEffect, useRef } from 'react';
import konstructzLogo from '../../assets/konstructz_logo.png';

// Authentic Multicolored Google G Icon
const IconGoogle = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden="true">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z" />
    <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.43l4.03-3.14z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z" />
  </svg>
);

const IconUser = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconEye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="7" r="3" />
      </>
    )}
  </svg>
);

export default function CmsProfileModal({ isOpen, onClose, currentUser, onUserUpdated, csrfToken }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'google', 'password'
  
  // Profile Form States (Allows username changing + logo avatar)
  const [username, setUsername] = useState(currentUser?.username || '');
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Sync state when currentUser updates or modal opens
  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username || '');
      setFullName(currentUser.full_name || '');
      setEmail(currentUser.email || '');
      setAvatarUrl(currentUser.avatar_url || '');
    }
  }, [currentUser, isOpen]);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // Google Linking State
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLinking, setGoogleLinking] = useState(false);
  const [googleUnlinking, setGoogleUnlinking] = useState(false);
  const [googleMsg, setGoogleMsg] = useState({ type: '', text: '' });
  const googleBtnRef = useRef(null);

  // Fetch Google client ID configuration
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth.php?action=google_config')
      .then((r) => r.json())
      .then((cfg) => {
        if (!cancelled && cfg && cfg.enabled && cfg.client_id) {
          setGoogleClientId(cfg.client_id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Initialize Google Identity Services button inside the modal
  useEffect(() => {
    if (!isOpen || activeTab !== 'google' || !googleClientId || currentUser?.is_google_linked) {
      return undefined;
    }

    let cancelled = false;

    const handleGoogleCredential = async (response) => {
      setGoogleMsg({ type: '', text: '' });
      setGoogleLinking(true);
      try {
        const res = await fetch('/api/auth.php?action=google_link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to link Google account.');
        }
        setGoogleMsg({ type: 'success', text: data.message || 'Google account linked successfully!' });
        if (onUserUpdated) {
          onUserUpdated({
            ...currentUser,
            is_google_linked: true,
            google_email: data.google_email,
            google_linked_at: data.google_linked_at
          });
        }
      } catch (err) {
        setGoogleMsg({ type: 'danger', text: err.message });
      } finally {
        setGoogleLinking(false);
      }
    };

    const renderButton = () => {
      if (cancelled || !window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'filled_blue',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width: 280
      });
    };

    if (window.google && window.google.accounts && window.google.accounts.id) {
      renderButton();
    } else {
      let script = document.getElementById('google-gsi-client');
      if (!script) {
        script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderButton);
      return () => { cancelled = true; script.removeEventListener('load', renderButton); };
    }
    return () => { cancelled = true; };
  }, [isOpen, activeTab, googleClientId, currentUser, csrfToken, onUserUpdated]);

  if (!isOpen || !currentUser) return null;

  // Unlink Google Account Handler
  const handleUnlinkGoogle = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google account from this CMS profile? You can always continue signing in with your username and password.')) {
      return;
    }
    setGoogleMsg({ type: '', text: '' });
    setGoogleUnlinking(true);
    try {
      const res = await fetch('/api/auth.php?action=google_unlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to unlink Google account.');
      }
      setGoogleMsg({ type: 'success', text: data.message || 'Google account unlinked.' });
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          is_google_linked: false,
          google_email: null,
          google_linked_at: null
        });
      }
    } catch (err) {
      setGoogleMsg({ type: 'danger', text: err.message });
    } finally {
      setGoogleUnlinking(false);
    }
  };

  // Profile Save Handler (Supports Username, Name, Email, Avatar URL)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 3) {
      setProfileMsg({ type: 'danger', text: 'Username must be at least 3 characters long.' });
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth.php?action=update_profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          username: trimmedUsername,
          full_name: fullName.trim(),
          email: email.trim(),
          avatar_url: avatarUrl.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      setProfileMsg({ type: 'success', text: data.message || 'Profile updated successfully!' });
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          username: data.user?.username || trimmedUsername,
          full_name: data.user?.full_name || fullName.trim(),
          email: data.user?.email || email.trim(),
          avatar_url: data.user?.avatar_url || (avatarUrl.trim() || null)
        });
      }
    } catch (err) {
      setProfileMsg({ type: 'danger', text: err.message });
    } finally {
      setProfileSaving(false);
    }
  };

  // Password Change Handler
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'danger', text: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'danger', text: 'New passwords do not match.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth.php?action=change_password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password.');
      }
      setPasswordMsg({ type: 'success', text: data.message || 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ type: 'danger', text: err.message });
    } finally {
      setPasswordSaving(false);
    }
  };

  // Determine avatar source (defaults to official StoneKrusher/KONSTRUCTZ brand logo)
  const effectiveAvatar = avatarUrl.trim() || currentUser?.avatar_url || konstructzLogo;

  return (
    <div className="cms-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cms-modal cms-profile-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* ENHANCED MODAL HEADER */}
        <div className="cms-modal-header" style={{ padding: '20px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#0f4c3a',
                border: '2px solid var(--cms-primary, #15803d)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(15, 76, 58, 0.25)'
              }}
            >
              <img
                src={effectiveAvatar}
                alt="StoneKrusher Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }}
                onError={(e) => { e.target.src = konstructzLogo; }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--cms-text)' }}>
                  My Profile & Security
                </h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--cms-text-subtle)', display: 'block', marginTop: '2px' }}>
                Signed in as <strong style={{ color: 'var(--cms-text)' }}>@{currentUser.username}</strong> • <span style={{ color: 'var(--cms-primary)', fontWeight: 650 }}>{currentUser.role_display || currentUser.role}</span>
              </span>
            </div>
          </div>
          <button className="cms-btn-icon cms-btn-secondary" onClick={onClose} aria-label="Close" style={{ borderRadius: '50%', width: '34px', height: '34px' }}>
            ✕
          </button>
        </div>

        {/* MODERN NAVIGATION TABS */}
        <div className="cms-modal-tabs" style={{ padding: '8px 16px 0', gap: '8px' }}>
          <button
            type="button"
            className={`cms-modal-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <IconUser />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            className={`cms-modal-tab-btn ${activeTab === 'google' ? 'active' : ''}`}
            onClick={() => setActiveTab('google')}
          >
            <IconGoogle size={18} />
            <span>Google Login</span>
            {currentUser.is_google_linked ? (
              <span className="cms-modal-tab-badge linked">Linked</span>
            ) : (
              <span className="cms-modal-tab-badge unlinked">Unlinked</span>
            )}
          </button>

          <button
            type="button"
            className={`cms-modal-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            <IconLock />
            <span>Password & Security</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="cms-modal-body" style={{ padding: '26px' }}>
          
          {/* TAB 1: PROFILE DETAILS & AVATAR (Allows editing username & logo) */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              {profileMsg.text && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '18px',
                    fontSize: '0.86rem',
                    fontWeight: 500,
                    background: profileMsg.type === 'success' ? 'var(--cms-success-bg, #ecfdf5)' : 'var(--cms-danger-bg, #fef2f2)',
                    color: profileMsg.type === 'success' ? 'var(--cms-success, #059669)' : 'var(--cms-danger, #dc2626)',
                    border: `1px solid ${profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {profileMsg.text}
                </div>
              )}

              {/* HERO PROFILE CARD WITH BRAND LOGO AVATAR */}
              <div className="cms-profile-hero-card">
                <div className="cms-profile-avatar-wrap">
                  <img
                    src={effectiveAvatar}
                    alt="Profile Avatar"
                    className="cms-profile-avatar-img"
                    onError={(e) => { e.target.src = konstructzLogo; }}
                  />
                  <span className="cms-profile-avatar-dot" title="Active Session" />
                </div>

                <div className="cms-profile-hero-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 className="cms-profile-hero-name">
                      {fullName || username || 'Administrator'}
                    </h4>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(21, 128, 61, 0.12)', color: 'var(--cms-primary, #15803d)' }}>
                      {currentUser.role_display || currentUser.role || 'Super Admin'}
                    </span>
                  </div>

                  <span className="cms-profile-hero-handle">
                    @{username || currentUser.username}
                  </span>

                  <div className="cms-profile-avatar-actions">
                    <button
                      type="button"
                      className="cms-btn cms-btn-outline cms-btn-xs"
                      onClick={() => setAvatarUrl('')}
                      title="Reset avatar to official StoneKrusher Brand Logo"
                    >
                      <img src={konstructzLogo} alt="" style={{ width: '13px', height: '13px', objectFit: 'contain' }} />
                      <span>Use Brand Logo</span>
                    </button>
                    <button
                      type="button"
                      className="cms-btn cms-btn-outline cms-btn-xs"
                      onClick={() => {
                        const url = prompt('Enter custom profile picture image URL (HTTPS):', avatarUrl);
                        if (url !== null) setAvatarUrl(url.trim());
                      }}
                    >
                      <span>Custom Photo URL</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-COLUMN FORM GRID */}
              <div className="cms-profile-form-grid">
                {/* Username Input (NOW FULLY EDITABLE AS REQUESTED!) */}
                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label htmlFor="prof-username" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Username *
                  </label>
                  <input
                    id="prof-username"
                    type="text"
                    className="cms-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-@]/g, ''))}
                    required
                    minLength={3}
                    placeholder="e.g. soporadara or admin"
                    style={{ fontWeight: 600 }}
                  />
                  <span className="cms-field-help">
                    Your unique administrative sign-in handle and audit log identifier.
                  </span>
                </div>

                {/* Assigned Role Display */}
                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Assigned Role
                  </label>
                  <input
                    type="text"
                    className="cms-input"
                    value={currentUser.role_display || currentUser.role}
                    disabled
                    style={{ opacity: 0.7, cursor: 'not-allowed', background: 'var(--cms-bg, #f8fafc)' }}
                  />
                  <span className="cms-field-help">
                    Managed by Super Admin in Settings → Users & Roles.
                  </span>
                </div>
              </div>

              <div className="cms-profile-form-grid">
                {/* Full Name */}
                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label htmlFor="prof-fullname" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Full Name
                  </label>
                  <input
                    id="prof-fullname"
                    type="text"
                    className="cms-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. KONSTRUCTZ Super Admin"
                  />
                  <span className="cms-field-help">
                    Displayed in editorial author cards, fleet activity, and customer tickets.
                  </span>
                </div>

                {/* Profile Picture / Avatar URL */}
                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label htmlFor="prof-avatar" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Profile Picture URL
                  </label>
                  <input
                    id="prof-avatar"
                    type="text"
                    className="cms-input"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Leave blank to use StoneKrusher logo"
                  />
                  <span className="cms-field-help">
                    Direct HTTPS link to image. Leave empty to use the official wolf logo.
                  </span>
                </div>
              </div>

              {/* CMS Login Email Address */}
              <div className="cms-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="prof-email" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  CMS Login Email Address *
                </label>
                <input
                  id="prof-email"
                  type="email"
                  className="cms-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@kiuq.com"
                />
                <span className="cms-field-help">
                  Primary email used for password authentication and password reset recovery tokens.
                </span>
              </div>

              {/* SAVE BUTTON */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="submit"
                  className="cms-btn cms-btn-primary"
                  disabled={profileSaving}
                  style={{ padding: '10px 24px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{profileSaving ? 'Saving Profile...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: GOOGLE 1-CLICK AUTHENTICATION */}
          {activeTab === 'google' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: 'var(--cms-bg, #f8fafc)',
                    border: '1px solid var(--cms-card-border, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <IconGoogle size={26} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--cms-text)' }}>
                    Google 1-Click Authentication
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--cms-text-muted)', lineHeight: '1.45' }}>
                    Link your verified Google Workspace or Gmail account for instant 1-click single sign-on.
                  </p>
                </div>
              </div>

              {googleMsg.text && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '18px',
                    fontSize: '0.86rem',
                    background: googleMsg.type === 'success' ? 'var(--cms-success-bg, #ecfdf5)' : 'var(--cms-danger-bg, #fef2f2)',
                    color: googleMsg.type === 'success' ? 'var(--cms-success, #059669)' : 'var(--cms-danger, #dc2626)',
                    border: `1px solid ${googleMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {googleMsg.text}
                </div>
              )}

              {currentUser.is_google_linked ? (
                <div className="cms-google-connected-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                        }}
                      >
                        <IconGoogle size={22} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.98rem', color: 'var(--cms-text)', display: 'block' }}>
                          Google Account Connected
                        </strong>
                        <div style={{ fontSize: '0.84rem', color: 'var(--cms-success, #059669)', fontWeight: 600, marginTop: '2px' }}>
                          {currentUser.google_email}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.74rem', padding: '5px 12px', borderRadius: '999px', background: 'var(--cms-success-bg, #ecfdf5)', color: 'var(--cms-success, #059669)', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      ✓ Authorized for 1-Click Login
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--cms-text-subtle)', lineHeight: '1.55' }}>
                    {currentUser.google_linked_at
                      ? `Linked on ${new Date(currentUser.google_linked_at * 1000).toLocaleDateString()} at ${new Date(currentUser.google_linked_at * 1000).toLocaleTimeString()}. `
                      : ''}
                    On the login screen, click "Continue with Google" to access your console instantly. Your email and password sign-in remains active in parallel.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    <button
                      type="button"
                      className="cms-btn cms-btn-danger cms-btn-sm"
                      onClick={handleUnlinkGoogle}
                      disabled={googleUnlinking}
                      style={{ padding: '8px 16px', fontWeight: 650 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      <span>{googleUnlinking ? 'Disconnecting...' : 'Disconnect Google Account'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cms-google-unlinked-box">
                  <div style={{ marginBottom: '14px' }}>
                    <IconGoogle size={44} />
                  </div>
                  <h5 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--cms-text)' }}>
                    No Google Account Linked Yet
                  </h5>
                  <p style={{ margin: '0 auto 20px', fontSize: '0.84rem', color: 'var(--cms-text-muted)', maxWidth: '460px', lineHeight: '1.5' }}>
                    Connect your Google account to log in with 1 click without entering a password. It will be securely tied to your admin handle (<strong>@{currentUser.username}</strong>).
                  </p>

                  {googleClientId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div ref={googleBtnRef} style={{ minHeight: '44px' }} />
                      {googleLinking && (
                        <span style={{ fontSize: '0.82rem', color: 'var(--cms-primary)', fontWeight: 600 }}>
                          Verifying and linking Google account...
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.84rem', color: 'var(--cms-warning, #d97706)', padding: '12px 18px', background: 'var(--cms-warning-bg, #fffbeb)', borderRadius: '10px', border: '1px solid rgba(217, 119, 6, 0.25)' }}>
                      Google Client ID has not been configured in Settings yet. An administrator can add it under <strong>Settings → Security & Google Sign-In</strong>.
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '10px', background: 'var(--cms-bg, #f8fafc)', border: '1px solid var(--cms-card-border, #e2e8f0)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--cms-text-subtle)', lineHeight: '1.5', display: 'block' }}>
                  <strong>Security assurance:</strong> Google Sign-In uses standard OAuth 2.0 / OpenID Connect authentication. StoneKrusher only receives your verified identity claim. Your Google password is never seen or stored.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--cms-text)' }}>
                  Change Administrative Password
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--cms-text-muted)' }}>
                  Use a strong passphrase with at least 8 characters, numbers, and symbols.
                </p>
              </div>

              {passwordMsg.text && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '18px',
                    fontSize: '0.86rem',
                    background: passwordMsg.type === 'success' ? 'var(--cms-success-bg, #ecfdf5)' : 'var(--cms-danger-bg, #fef2f2)',
                    color: passwordMsg.type === 'success' ? 'var(--cms-success, #059669)' : 'var(--cms-danger, #dc2626)',
                    border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {passwordMsg.text}
                </div>
              )}

              <div className="cms-form-group">
                <label htmlFor="pass-current" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  Current Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="pass-current"
                    type={showCurrentPass ? 'text' : 'password'}
                    className="cms-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--cms-text-subtle)',
                      cursor: 'pointer'
                    }}
                    aria-label="Toggle password visibility"
                  >
                    <IconEye off={showCurrentPass} />
                  </button>
                </div>
              </div>

              <div className="cms-profile-form-grid" style={{ marginTop: '16px' }}>
                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label htmlFor="pass-new" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    New Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="pass-new"
                      type={showNewPass ? 'text' : 'password'}
                      className="cms-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--cms-text-subtle)',
                        cursor: 'pointer'
                      }}
                      aria-label="Toggle password visibility"
                    >
                      <IconEye off={showNewPass} />
                    </button>
                  </div>
                </div>

                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label htmlFor="pass-confirm" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                    Confirm New Password *
                  </label>
                  <input
                    id="pass-confirm"
                    type={showNewPass ? 'text' : 'password'}
                    className="cms-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px' }}>
                <button
                  type="submit"
                  className="cms-btn cms-btn-primary"
                  disabled={passwordSaving}
                  style={{ padding: '10px 24px', fontSize: '0.88rem', fontWeight: 700 }}
                >
                  <IconLock />
                  <span>{passwordSaving ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="cms-modal-footer" style={{ padding: '16px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--cms-text-subtle)' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Active Session • StoneKrusher Fleet Ops</span>
          </div>
          <button type="button" className="cms-btn cms-btn-secondary" onClick={onClose} style={{ padding: '8px 20px', fontWeight: 650 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
