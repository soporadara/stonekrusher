import { useState, useEffect, useRef } from 'react';

const IconEye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M1 1l22 22" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function CmsProfileModal({ isOpen, onClose, currentUser, onUserUpdated, csrfToken }) {
  const [activeTab, setActiveTab] = useState('google'); // 'google', 'profile', 'password'
  
  // Profile Form
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Password Form
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

  // Initialize Google Identity Services button inside the profile modal
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
    if (!window.confirm('Are you sure you want to disconnect your Google account from this CMS profile? You will still be able to sign in with your email and password.')) {
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

  // Profile Save Handler
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth.php?action=update_profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update profile.');
      }
      setProfileMsg({ type: 'success', text: data.message || 'Profile updated successfully.' });
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          full_name: fullName.trim(),
          email: email.trim()
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

  return (
    <div className="cms-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cms-modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="cms-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>My Profile & Security</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-subtle)' }}>
                Account: <strong>{currentUser.username}</strong> ({currentUser.role_display || currentUser.role})
              </span>
            </div>
          </div>
          <button className="cms-btn-icon cms-btn-secondary" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--cms-card-border)', background: 'var(--cms-bg-subtle)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'google' ? 'var(--cms-card-bg)' : 'transparent',
              color: activeTab === 'google' ? 'var(--cms-primary)' : 'var(--cms-text-muted)',
              borderBottom: activeTab === 'google' ? '2px solid var(--cms-primary)' : '2px solid transparent',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🔗</span>
            <span>Google Login</span>
            {currentUser.is_google_linked ? (
              <span style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '999px', background: 'var(--cms-success-bg)', color: 'var(--cms-success)' }}>Linked</span>
            ) : (
              <span style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: 'var(--cms-text-subtle)' }}>Unlinked</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'profile' ? 'var(--cms-card-bg)' : 'transparent',
              color: activeTab === 'profile' ? 'var(--cms-primary)' : 'var(--cms-text-muted)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--cms-primary)' : '2px solid transparent',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>👤</span>
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'password' ? 'var(--cms-card-bg)' : 'transparent',
              color: activeTab === 'password' ? 'var(--cms-primary)' : 'var(--cms-text-muted)',
              borderBottom: activeTab === 'password' ? '2px solid var(--cms-primary)' : '2px solid transparent',
              fontWeight: '700',
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>🔒</span>
            <span>Password</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="cms-modal-body" style={{ padding: '22px' }}>
          
          {/* TAB 1: GOOGLE LINKING */}
          {activeTab === 'google' && (
            <div>
              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: '700' }}>
                  Google 1-Click Authentication
                </h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--cms-text-muted)', lineHeight: '1.5' }}>
                  Link your verified Google account to enable secure 1-click login on the StoneKrusher CMS sign-in page.
                  You can always continue logging in with your email and password at any time.
                </p>
              </div>

              {googleMsg.text && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.84rem',
                    background: googleMsg.type === 'success' ? 'var(--cms-success-bg)' : 'var(--cms-danger-bg)',
                    color: googleMsg.type === 'success' ? 'var(--cms-success)' : 'var(--cms-danger)',
                    border: `1px solid ${googleMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {googleMsg.text}
                </div>
              )}

              {currentUser.is_google_linked ? (
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.28)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.6rem' }}>✅</span>
                      <div>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--cms-text)' }}>
                          Google Account Connected
                        </strong>
                        <div style={{ fontSize: '0.82rem', color: 'var(--cms-success)', marginTop: '2px' }}>
                          {currentUser.google_email}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '999px', background: 'var(--cms-success-bg)', color: 'var(--cms-success)', fontWeight: '600' }}>
                      Authorized for 1-Click Login
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--cms-text-subtle)', lineHeight: '1.5' }}>
                    {currentUser.google_linked_at
                      ? `Linked on ${new Date(currentUser.google_linked_at * 1000).toLocaleDateString()} at ${new Date(currentUser.google_linked_at * 1000).toLocaleTimeString()}. `
                      : ''}
                    On the login screen, click "Continue with Google" to access your console instantly. Your email and password login remains fully active.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '6px' }}>
                    <button
                      type="button"
                      className="cms-btn cms-btn-sm"
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--cms-danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      onClick={handleUnlinkGoogle}
                      disabled={googleUnlinking}
                    >
                      {googleUnlinking ? 'Disconnecting...' : 'Disconnect Google Account'}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: 'var(--cms-card-hover)',
                    border: '1px solid var(--cms-card-border)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔐</div>
                  <h5 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: '700' }}>
                    No Google Account Linked Yet
                  </h5>
                  <p style={{ margin: '0 auto 16px', fontSize: '0.82rem', color: 'var(--cms-text-muted)', maxWidth: '420px', lineHeight: '1.5' }}>
                    Click below to sign in with your Google account. It will be securely tied to your CMS user profile (<strong>{currentUser.username}</strong>).
                  </p>

                  {googleClientId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div ref={googleBtnRef} style={{ minHeight: '44px' }} />
                      {googleLinking && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--cms-primary)' }}>
                          Verifying and linking Google account...
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: 'var(--cms-warning)', padding: '10px', background: 'var(--cms-warning-bg)', borderRadius: '8px' }}>
                      Google Client ID has not been configured in Settings yet. An administrator can add it under <strong>Settings → Google Sign-In</strong>.
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '20px', padding: '12px 14px', borderRadius: '8px', background: 'var(--cms-bg-subtle)', border: '1px solid var(--cms-card-border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-subtle)', lineHeight: '1.5', display: 'block' }}>
                  ℹ️ <strong>Security notice:</strong> Linking your Google account does not disable your password. It adds an authorized OAuth identity so you can sign in with either credential.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE DETAILS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              {profileMsg.text && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.84rem',
                    background: profileMsg.type === 'success' ? 'var(--cms-success-bg)' : 'var(--cms-danger-bg)',
                    color: profileMsg.type === 'success' ? 'var(--cms-success)' : 'var(--cms-danger)',
                    border: `1px solid ${profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {profileMsg.text}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label>Username</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={currentUser.username}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>Permanent administrative handle</span>
                </div>

                <div className="cms-form-group" style={{ margin: 0 }}>
                  <label>Assigned Role</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={currentUser.role_display || currentUser.role}
                    disabled
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>Managed in Users & Roles</span>
                </div>
              </div>

              <div className="cms-form-group">
                <label htmlFor="prof-fullname">Full Name</label>
                <input
                  id="prof-fullname"
                  type="text"
                  className="cms-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Administrator"
                />
              </div>

              <div className="cms-form-group">
                <label htmlFor="prof-email">CMS Login Email Address</label>
                <input
                  id="prof-email"
                  type="email"
                  className="cms-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>
                  This is the email address used to sign in with password and receive password reset tokens.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
                <button type="submit" className="cms-btn cms-btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword}>
              {passwordMsg.text && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.84rem',
                    background: passwordMsg.type === 'success' ? 'var(--cms-success-bg)' : 'var(--cms-danger-bg)',
                    color: passwordMsg.type === 'success' ? 'var(--cms-success)' : 'var(--cms-danger)',
                    border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {passwordMsg.text}
                </div>
              )}

              <div className="cms-form-group">
                <label htmlFor="pass-current">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="pass-current"
                    type={showCurrentPass ? 'text' : 'password'}
                    className="cms-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your current password"
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

              <div className="cms-form-group">
                <label htmlFor="pass-new">New Password (minimum 8 characters)</label>
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
                    placeholder="Enter new strong password"
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

              <div className="cms-form-group">
                <label htmlFor="pass-confirm">Confirm New Password</label>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
                <button type="submit" className="cms-btn cms-btn-primary" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* FOOTER */}
        <div className="cms-modal-footer">
          <button type="button" className="cms-btn cms-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
