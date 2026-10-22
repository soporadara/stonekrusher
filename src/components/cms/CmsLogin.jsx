import { useState, useEffect, useRef } from 'react';
import logoAsset from '../../assets/konstructz_logo.png';
import heroAsset from '../../assets/loader_carrying_gravel.png';
import './cms-login.css';

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconEye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

const IconShield = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const IconBox = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
  </svg>
);

const IconEdit = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export default function CmsLogin({ onLoginSuccess, onBackToSite }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleButtonRef = useRef(null);
  const rememberRef = useRef(remember);
  const onLoginSuccessRef = useRef(onLoginSuccess);

  useEffect(() => { rememberRef.current = remember; }, [remember]);
  useEffect(() => { onLoginSuccessRef.current = onLoginSuccess; }, [onLoginSuccess]);

  // Discover whether Google sign-in is configured (the Client ID is public).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth.php?action=google_config')
      .then((res) => res.json())
      .then((cfg) => {
        if (!cancelled && cfg && cfg.enabled && cfg.client_id) setGoogleClientId(cfg.client_id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load Google Identity Services and render the official button.
  useEffect(() => {
    if (!googleClientId) return undefined;
    let cancelled = false;

    const handleCredential = async (response) => {
      setError('');
      setGoogleLoading(true);
      try {
        const res = await fetch('/api/auth.php?action=google_login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential, remember: rememberRef.current })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Google sign-in failed. Please try again.');
        }
        onLoginSuccessRef.current(data.user, data.csrf_token);
      } catch (err) {
        setError(err.message);
      } finally {
        setGoogleLoading(false);
      }
    };

    const renderButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      googleButtonRef.current.innerHTML = '';
      const width = Math.min(360, Math.max(220, googleButtonRef.current.clientWidth || 340));
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'left',
        width
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
  }, [googleClientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          remember
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      onLoginSuccess(data.user, data.csrf_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotStatus('Submitting...');
    try {
      const res = await fetch('/api/auth.php?action=forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      const data = await res.json();
      setForgotStatus(data.message || 'If that email exists, reset instructions have been issued.');
    } catch {
      setForgotStatus('Error processing reset request.');
    }
  };

  return (
    <div className="cms-login-shell">
      {/* Brand / hero panel */}
      <aside className="cms-login-hero" style={{ backgroundImage: `url(${heroAsset})` }}>
        <div className="cms-login-hero-overlay" />
        <div className="cms-login-hero-content">
          <div className="cms-login-brand">
            <span className="cms-login-logo-badge">
              <img src={logoAsset} alt="StoneKrusher wolf logo" />
            </span>
            <span className="cms-login-brand-text">
              <strong>StoneKrusher</strong>
              <small>Machinery Console</small>
            </span>
          </div>

          <div className="cms-login-hero-copy">
            <span className="cms-login-eyebrow">Content Management Portal</span>
            <h2>Run your machinery business from one command center.</h2>
            <p>Publish articles, manage the equipment catalog and keep every upload and login under watch.</p>

            <ul className="cms-login-features">
              <li><span><IconEdit /></span> Blog publishing with drafts, scheduling and revisions</li>
              <li><span><IconBox /></span> Equipment and product catalog management</li>
              <li><span><IconShield /></span> Session security, lockouts and full audit trail</li>
            </ul>
          </div>

          <div className="cms-login-hero-foot">© {new Date().getFullYear()} StoneKrusher · Authorized personnel only</div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="cms-login-panel">
        <div className="cms-login-glow cms-login-glow-a" />
        <div className="cms-login-glow cms-login-glow-b" />

        <div className="cms-login-card">
          <div className="cms-login-card-head">
            <span className="cms-login-logo-badge cms-login-logo-badge-lg">
              <img src={logoAsset} alt="StoneKrusher wolf logo" />
            </span>
            <h1>Welcome back</h1>
            <p>Sign in to manage StoneKrusher</p>
          </div>

          <form onSubmit={handleSubmit} noValidate={false}>
            {error && (
              <div className="cms-login-error" role="alert">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="cms-login-field">
              <label htmlFor="cms-username">Username or Email</label>
              <div className="cms-login-input-wrap">
                <span className="cms-login-input-icon"><IconUser /></span>
                <input
                  id="cms-username"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter your username or email"
                />
              </div>
            </div>

            <div className="cms-login-field">
              <div className="cms-login-label-row">
                <label htmlFor="cms-password">Password</label>
                <button type="button" className="cms-login-link" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              </div>
              <div className="cms-login-input-wrap">
                <span className="cms-login-input-icon"><IconLock /></span>
                <input
                  id="cms-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  style={{ paddingRight: '46px' }}
                />
                <button
                  type="button"
                  className="cms-login-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <IconEye off={showPassword} />
                </button>
              </div>
            </div>

            <div className="cms-login-options">
              <label className="cms-login-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button type="submit" className="cms-login-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="cms-login-spinner" aria-hidden="true" />
                  Authenticating...
                </>
              ) : (
                <>Sign In to Dashboard <span aria-hidden="true">→</span></>
              )}
            </button>

            {googleClientId && (
              <div className="cms-login-google">
                <div className="cms-login-divider"><span>or continue with</span></div>
                <div className={`cms-login-google-btn${googleLoading ? ' is-loading' : ''}`} ref={googleButtonRef} aria-label="Sign in with Google" />
                {googleLoading && <p className="cms-login-google-status">Verifying your Google account...</p>}
                <p className="cms-login-google-hint">Only email addresses already added to the CMS can sign in with Google.</p>
              </div>
            )}
          </form>

          <div className="cms-login-secure">
            <IconShield />
            <span>Protected session · Account locks after 10 failed attempts</span>
          </div>

          <button type="button" className="cms-login-back" onClick={onBackToSite}>
            ← Back to StoneKrusher public site
          </button>
        </div>
      </main>

      {showForgot && (
        <div className="cms-modal-backdrop" style={{ zIndex: 120 }}>
          <div className="cms-modal" style={{ maxWidth: '400px' }}>
            <div className="cms-modal-header">
              <h3>Reset Password</h3>
              <button
                className="cms-btn-icon cms-btn-secondary"
                onClick={() => setShowForgot(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleForgotSubmit}>
              <div className="cms-modal-body">
                <p style={{ fontSize: '0.86rem', color: 'var(--cms-text-muted)', marginTop: 0 }}>
                  Enter your administrative email address to generate a single-use password reset authorization token.
                </p>
                <div className="cms-form-group">
                  <label>Administrator Email</label>
                  <input
                    type="email"
                    className="cms-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                  />
                </div>
                {forgotStatus && (
                  <div style={{ padding: '10px 12px', background: 'var(--cms-info-bg)', color: 'var(--cms-info)', borderRadius: 'var(--cms-radius-md)', fontSize: '0.82rem' }}>
                    {forgotStatus}
                  </div>
                )}
              </div>
              <div className="cms-modal-footer">
                <button
                  type="button"
                  className="cms-btn cms-btn-secondary"
                  onClick={() => setShowForgot(false)}
                >
                  Close
                </button>
                <button type="submit" className="cms-btn cms-btn-primary">
                  Request Reset Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
