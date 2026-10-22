import React, { useState, useEffect } from 'react';

export default function CmsSettings({ csrfToken }) {
  const [settings, setSettings] = useState({
    site_name: 'KONSTRUCTZ Machinery',
    site_url: 'https://stonekrusher.com',
    admin_email: 'sales@cwqv.com',
    max_failed_logins: '10',
    lockout_duration_minutes: '15',
    session_lifetime_hours: '8',
    audit_log_retention_days: '90',
    default_theme: 'dark',
    enable_2fa: '0',
    posts_per_page: '10',
    google_client_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/cms.php?action=settings_get');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');

    try {
      const res = await fetch('/api/cms.php?action=settings_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('Settings saved successfully.');
        setTimeout(() => setStatusMsg(''), 3000);
      } else {
        alert(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      alert('Error saving settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>CMS Configuration & Security Policies</h1>
          <p>Global site settings, lockout thresholds, session lifetimes, and audit retention</p>
        </div>
      </div>

      {statusMsg && (
        <div style={{ padding: '12px 16px', background: 'var(--cms-success-bg)', color: 'var(--cms-success)', borderRadius: 'var(--cms-radius-md)', marginBottom: '20px', fontWeight: '600' }}>
          ✓ {statusMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '800px' }}>
        
        {/* SITE IDENTITY */}
        <div className="cms-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700' }}>Site Identity</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="cms-form-group">
              <label>Organization / Site Name</label>
              <input
                type="text"
                className="cms-input"
                value={settings.site_name}
                onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
              />
            </div>
            <div className="cms-form-group">
              <label>Public Website URL</label>
              <input
                type="url"
                className="cms-input"
                value={settings.site_url}
                onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
              />
            </div>
          </div>
          <div className="cms-form-group" style={{ marginBottom: 0 }}>
            <label>Administrative Notification Email</label>
            <input
              type="email"
              className="cms-input"
              value={settings.admin_email}
              onChange={(e) => setSettings({ ...settings, admin_email: e.target.value })}
            />
          </div>
        </div>

        {/* SECURITY & FAILED LOGIN POLICY */}
        <div className="cms-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700', color: 'var(--cms-primary)' }}>
            🛡️ Security & Failed-Login Defense Policy
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="cms-form-group">
              <label>Max Consecutive Failed Logins Before Lockout</label>
              <input
                type="number"
                min="3"
                max="50"
                className="cms-input"
                value={settings.max_failed_logins}
                onChange={(e) => setSettings({ ...settings, max_failed_logins: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Default: 10 attempts</span>
            </div>
            <div className="cms-form-group">
              <label>Account Lockout Duration (Minutes)</label>
              <input
                type="number"
                min="5"
                max="1440"
                className="cms-input"
                value={settings.lockout_duration_minutes}
                onChange={(e) => setSettings({ ...settings, lockout_duration_minutes: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Default: 15 minutes</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="cms-form-group">
              <label>Standard Session Lifetime (Hours)</label>
              <input
                type="number"
                min="1"
                max="72"
                className="cms-input"
                value={settings.session_lifetime_hours}
                onChange={(e) => setSettings({ ...settings, session_lifetime_hours: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Default: 8 hours (Remember me: 30 days)</span>
            </div>
            <div className="cms-form-group">
              <label>Audit Log Retention Policy (Days)</label>
              <input
                type="number"
                min="30"
                max="365"
                className="cms-input"
                value={settings.audit_log_retention_days}
                onChange={(e) => setSettings({ ...settings, audit_log_retention_days: e.target.value })}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Default: 90 days before eligible for purge</span>
            </div>
          </div>
        </div>

        {/* GOOGLE SIGN-IN */}
        <div className="cms-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: '700' }}>Google Sign-In</h3>
          <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--cms-text-muted)', lineHeight: 1.6 }}>
            Let staff sign in with their Google account. Only Google emails that match an existing CMS user can sign in, and accounts are never created automatically. Leave empty to turn Google sign-in off.
          </p>
          <div className="cms-form-group" style={{ marginBottom: '12px' }}>
            <label>Google OAuth Web Client ID</label>
            <input
              type="text"
              className="cms-input"
              placeholder="1234567890-abcdefg.apps.googleusercontent.com"
              autoComplete="off"
              spellCheck="false"
              value={settings.google_client_id || ''}
              onChange={(e) => setSettings({ ...settings, google_client_id: e.target.value })}
            />
          </div>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--cms-text-subtle)', lineHeight: 1.7 }}>
            <li>In Google Cloud Console, open APIs &amp; Services, then Credentials, and create an OAuth client ID of type &quot;Web application&quot;.</li>
            <li>Add <strong>{typeof window !== 'undefined' ? window.location.origin : 'https://stonekrusher.com'}</strong> under &quot;Authorized JavaScript origins&quot;. No redirect URI is needed.</li>
            <li>Paste the Client ID above and save. The Google button then appears on the login page.</li>
          </ol>
        </div>

        {/* INTERFACE PREFERENCES */}
        <div className="cms-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700' }}>Interface & Publishing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="cms-form-group" style={{ marginBottom: 0 }}>
              <label>Default Interface Theme</label>
              <select
                className="cms-select"
                style={{ width: '100%' }}
                value={settings.default_theme}
                onChange={(e) => setSettings({ ...settings, default_theme: e.target.value })}
              >
                <option value="dark">Dark Theme (Standard)</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
            <div className="cms-form-group" style={{ marginBottom: 0 }}>
              <label>Articles Per Page</label>
              <select
                className="cms-select"
                style={{ width: '100%' }}
                value={settings.posts_per_page}
                onChange={(e) => setSettings({ ...settings, posts_per_page: e.target.value })}
              >
                <option value="10">10 Articles</option>
                <option value="20">20 Articles</option>
                <option value="50">50 Articles</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" className="cms-btn cms-btn-primary" disabled={saving}>
          {saving ? 'Saving Changes...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
}
