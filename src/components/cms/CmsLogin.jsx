import { useState, useEffect, useRef, useCallback } from 'react';
import logoAsset from '../../assets/konstructz_logo.png';
import './cms-login.css';

const DEFAULT_ATTEMPT_LIMIT = 10;

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconKey = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3L21 2" />
    <path d="M17 6l3 3" />
    <path d="M14 9l2 2" />
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
  const [attempts, setAttempts] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleButtonRef = useRef(null);
  const rememberRef = useRef(remember);
  const onLoginSuccessRef = useRef(onLoginSuccess);
  const [attemptLimit, setAttemptLimit] = useState(DEFAULT_ATTEMPT_LIMIT);
  const isBlocked = Boolean(blocked);

  useEffect(() => { rememberRef.current = remember; }, [remember]);
  useEffect(() => { onLoginSuccessRef.current = onLoginSuccess; }, [onLoginSuccess]);

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
          onLoginSuccessRef.current(data.user, data.csrf_token, data.session_token || data.token);
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
      const containerWidth = googleButtonRef.current.clientWidth || 360;
      const width = Math.min(420, Math.max(260, containerWidth));
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
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
        onLoginSuccess(data.user, data.csrf_token, data.session_token || data.token);
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
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
      </div>

      <button type="button" className="cms-login-return" onClick={onBackToSite}>
        <span aria-hidden="true">←</span> Return to StoneKrusher
      </button>

      <main className="cms-login-center">
        <div className="cms-login-card">
          <div className="cms-login-logo">
            <img src={logoAsset} alt="StoneKrusher" />
          </div>

          <h1 className="cms-login-title">{isBlocked ? 'Access Blocked' : 'Sign in'}</h1>

          {isBlocked ? (
            <div className="cms-login-blocked" role="alert">
              <span className="cms-login-blocked-icon"><IconBan /></span>
              <h2>This device has been blocked</h2>
              <p>
                We detected {attemptLimit} failed sign-in attempts from this device. Access to the
                StoneKrusher CMS has been suspended to protect the site.
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
                Believe this is a mistake? Contact a StoneKrusher administrator to remove the block under Security.
              </p>
              <button type="button" className="cms-login-submit cms-login-submit-ghost" onClick={onBackToSite}>
                Return to Website
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

              <div className="cms-login-field">
                <input
                  id="cms-username"
                  className="cms-login-input"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Username"
                  aria-label="Username"
                />
              </div>

              <div className="cms-login-field">
                <input
                  id="cms-password"
                  className="cms-login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  aria-label="Password"
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
                  <span className="cms-login-checkbox-custom" aria-hidden="true">
                    <svg viewBox="0 0 12 10" width="10" height="8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1.5 5 4.5 8 10.5 2" />
                    </svg>
                  </span>
                  <span>Remember Me</span>
                </label>
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
                  <div className="cms-login-divider"><span>OR SIGN IN WITH</span></div>
                  
                  {/* Styled Google Sign In Button */}
                  <div className="cms-login-google-wrapper">
                    <button
                      type="button"
                      className="cms-login-google-pill"
                      onClick={() => {
                        const googleBtn = googleButtonRef.current?.querySelector('div[role="button"]') || googleButtonRef.current?.querySelector('iframe');
                        if (googleBtn) {
                          googleBtn.click();
                        } else if (window.google?.accounts?.id) {
                          window.google.accounts.id.prompt();
                        }
                      }}
                      aria-label="Sign in with Google"
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      <span>Sign in with Google</span>
                    </button>
                    {/* Hidden Google GSI Render Target for seamless authentication flow */}
                    <div
                      className="cms-login-google-hidden-btn"
                      ref={googleButtonRef}
                      aria-hidden="true"
                    />
                  </div>

                  {googleLoading && <p className="cms-login-google-status">Verifying your Google account...</p>}
                </div>
              )}
            </form>
          )}

          <p className="cms-login-defense-text">
            Protected by StoneKrusher Shield. Auto-ban defense triggers after {attemptLimit} failed attempts.
          </p>
        </div>
      </main>
    </div>
  );
}
