import React, { useState } from 'react';

export default function CmsLogin({ onLoginSuccess, onBackToSite }) {
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('Admin@StoneKrusher2026!');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');

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
    } catch (err) {
      setForgotStatus('Error processing reset request.');
    }
  };

  return (
    <div className="cms-modal-backdrop" style={{ background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0b0f17 100%)' }}>
      <div className="cms-modal" style={{ maxWidth: '440px' }}>
        <div style={{ padding: '32px 32px 24px', textAlign: 'center', borderBottom: '1px solid var(--cms-card-border)' }}>
          <div style={{
            width: '54px',
            height: '54px',
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            color: '#000000',
            fontWeight: '900',
            boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)'
          }}>
            ⚡
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: '800' }}>StoneKrusher CMS</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--cms-text-muted)' }}>
            Machinery Console & Content Management Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
          {error && (
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'var(--cms-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--cms-radius-md)',
              color: 'var(--cms-danger)',
              fontSize: '0.84rem',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="cms-form-group">
            <label htmlFor="cms-username">Username or Email</label>
            <input
              id="cms-username"
              type="text"
              className="cms-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              placeholder="e.g. admin or admin@cwqv.com"
            />
          </div>

          <div className="cms-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="cms-password" style={{ margin: 0 }}>Password</label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--cms-primary)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                onClick={() => setShowForgot(true)}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="cms-password"
                type={showPassword ? 'text' : 'password'}
                className="cms-input"
                style={{ paddingRight: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--cms-text-subtle)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ accentColor: 'var(--cms-primary)' }}
              />
              <span>Keep me signed in</span>
            </label>
            <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Max 10 failed attempts</span>
          </div>

          <button
            type="submit"
            className="cms-btn cms-btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onBackToSite}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cms-text-muted)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ← Back to StoneKrusher Public Site
            </button>
          </div>
        </form>
      </div>

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
                    placeholder="admin@cwqv.com"
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
