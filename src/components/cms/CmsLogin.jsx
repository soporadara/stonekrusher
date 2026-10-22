import { useState, useEffect, useRef, useCallback } from 'react';
import logoAsset from '../../assets/konstructz_logo.png';
import './cms-login.css';

const DEFAULT_ATTEMPT_LIMIT = 10;

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
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

const IconBan = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </svg>
);

function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}h ${pad(m)}m ${pad(sec)}s` : `${pad(m)}m ${pad(sec)}s`;
}

export default function CmsLogin({ onLoginSuccess, onBackToSite }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(null); // { remaining, limit } after a failed sign-in
  const [blocked, setBlocked] = useState(null); // { until: ms timestamp | null, permanent, limit }
  const [now, setNow] = useState(() => Date.now());
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleButtonRef = useRef(null);
  const rememberRef = useRef(remember);
  const onLoginSuccessRef = useRef(onLoginSuccess);
  const [attemptLimit, setAttemptLimit] = useState(DEFAULT_ATTEMPT_LIMIT);
  const isBlocked = Boolean(blocked);

  useEffect(() => { rememberRef.current = remember; }, [remember]);
  useEffect(() => { onLoginSuccessRef.current = onLoginSuccess; }, [onLoginSuccess]);

  // Shared handler for every failed sign-in response (password or Google).
  const applyFailure = useCallback((data, fallbackMessage) => {
    if (data && data.blocked) {
      const startedAt = Date.now();
      setNow(startedAt);
      if (data.attempts_limit) setAttemptLimit(data.attempts_limit);
      setBlocked({
        until: data.retry_after ? startedAt + data.retry_after * 1000 : null,
        permanent: Boolean(data.permanent)
      });
      setError('');
      setAttempts(null);
      return;
    }
    setError((data && data.error) || fallbackMessage);
    if (data && typeof data.attempts_remaining === 'number') {
      const limit = data.attempts_limit || DEFAULT_ATTEMPT_LIMIT;
      setAttemptLimit(limit);
      setAttempts({ remaining: data.attempts_remaining, limit });
    } else {
      setAttempts(null);
    }
  }, []);

  // Countdown while this device is blocked; unblock the form when it expires.
  useEffect(() => {
    if (!blocked || !blocked.until) return undefined;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= blocked.until) {
        setBlocked(null);
        setAttempts(null);
        setError('');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [blocked]);

  // Discover Google sign-in config; also learn right away if this device is already blocked.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth.php?action=google_config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cancelled || !cfg) return;
        if (cfg.blocked) {
          applyFailure(cfg, '');
        } else if (cfg.enabled && cfg.client_id) {
          setGoogleClientId(cfg.client_id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [applyFailure]);

  // Load Google Identity Services and render the official button.
  useEffect(() => {
    if (!googleClientId || isBlocked) return undefined;
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
          applyFailure(data, 'Google sign-in failed. Please try again.');
        } else {
          onLoginSuccessRef.current(data.user, data.csrf_token);
        }
      } catch {
        setError('Unable to reach the server. Please check your connection and try again.');
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
      const width = Math.min(380, Math.max(220, googleButtonRef.current.clientWidth || 340));
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
  }, [googleClientId, isBlocked, applyFailure]);

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
        applyFailure(data, 'Authentication failed. Please check your credentials.');
        setPassword('');
      } else {
        onLoginSuccess(data.user, data.csrf_token);
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
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

  const isCritical = attempts && attempts.remaining <= 3;
  const secondsLeft = blocked && blocked.until ? Math.max(0, Math.ceil((blocked.until - now) / 1000)) : null;

  return (
    <div className="cms-login-shell">
      <div className="cms-login-bg" aria-hidden="true">
        <span className="cms-login-orb cms-login-orb-a" />
        <span className="cms-login-orb cms-login-orb-b" />
        <span className="cms-login-orb cms-login-orb-c" />
        <span className="cms-login-grid" />
      </div>

      <button type="button" className="cms-login-return" onClick={onBackToSite}>
        <span aria-hidden="true">←</span> Return to StoneKrusher
      </button>

      <main className="cms-login-center">
        <div className="cms-login-card">
          <div className="cms-login-logo">
            <img src={logoAsset} alt="StoneKrusher wolf logo" />
          </div>

          <h1>{isBlocked ? 'Access blocked' : 'Sign in'}</h1>
          <p className="cms-login-sub">StoneKrusher Content Management System</p>

          {isBlocked ? (
            <div className="cms-login-blocked" role="alert">
              <span className="cms-login-blocked-icon"><IconBan /></span>
              <h2>This device has been blocked</h2>
              <p>
                We detected {attemptLimit} failed sign-in attempts from this device, so access to the
                StoneKrusher CMS has been blocked to protect the site.
              </p>
              {blocked.permanent ? (
                <div className="cms-login-blocked-timer is-permanent">
                  <span>Block status</span>
                  <strong>Until an administrator lifts it</strong>
                </div>
              ) : (
                <div className="cms-login-blocked-timer">
                  <span>You can try again in</span>
                  <strong>{formatCountdown(secondsLeft ?? 0)}</strong>
                </div>
              )}
              <p className="cms-login-blocked-help">
                Believe this is a mistake? Contact a StoneKrusher administrator and ask them to remove the block
                under Security.
              </p>
              <button type="button" className="cms-login-submit cms-login-submit-ghost" onClick={onBackToSite}>
                Return to StoneKrusher
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="cms-login-form">
              {error && (
                <div className={`cms-login-error${isCritical ? ' is-critical' : ''}`} role="alert">
                  <IconAlert />
                  <div className="cms-login-error-body">
                    <strong>{error}</strong>
                    {attempts && (
                      <>
                        <span>
                          {attempts.remaining === 1
                            ? 'Last attempt! One more failure and this device will be blocked.'
                            : `${attempts.remaining} attempts left before this device is blocked.`}
                        </span>
                        <div className="cms-login-meter" role="img" aria-label={`${attempts.limit - attempts.remaining} of ${attempts.limit} attempts used`}>
                          {Array.from({ length: attempts.limit }, (_, i) => (
                            <i key={i} className={i < attempts.limit - attempts.remaining ? 'is-used' : ''} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <label className="cms-login-sr" htmlFor="cms-username">Username or email</label>
              <input
                id="cms-username"
                className="cms-login-input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="Username or email"
              />

              <label className="cms-login-sr" htmlFor="cms-password">Password</label>
              <div className="cms-login-pass">
                <input
                  id="cms-password"
                  className="cms-login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
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

              <div className="cms-login-options">
                <label className="cms-login-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <button type="button" className="cms-login-link" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="cms-login-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="cms-login-spinner" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>

              {googleClientId && (
                <div className="cms-login-google">
                  <div className="cms-login-divider"><span>or continue with</span></div>
                  <div className={`cms-login-google-btn${googleLoading ? ' is-loading' : ''}`} ref={googleButtonRef} aria-label="Sign in with Google" />
                  {googleLoading && <p className="cms-login-google-status">Verifying your Google account...</p>}
                  <p className="cms-login-google-hint">Sign in with your linked Google account, or sign in above with your email and password.</p>
                </div>
              )}
            </form>
          )}

          <div className="cms-login-shield">
            <span className="cms-login-shield-title"><IconShield /> StoneKrusher Shield Active</span>
            <span className="cms-login-shield-text">
              Protected by automated IP threat defense and brute-force lockout guard.
              Devices are blocked after {attemptLimit} failed sign-ins.
            </span>
          </div>
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
