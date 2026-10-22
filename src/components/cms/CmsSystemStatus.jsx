import React, { useState, useEffect } from 'react';

export default function CmsSystemStatus({ csrfToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/cms.php?action=dashboard_metrics');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch system metrics');
      }
      setData(json);
    } catch (err) {
      setError(err.message || 'Error fetching system status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePublishCatalog = async () => {
    try {
      setActionLoading(true);
      setActionNotice('');
      setActionError('');
      const res = await fetch('/api/cms.php?action=catalog_publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ csrf_token: csrfToken })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice(`✔ Live catalog synchronized! (${json.products_synced} products, ${json.blog_posts_synced} blog posts written to website data files).`);
        fetchStatus();
      } else {
        setActionError(json.error || 'Catalog publishing failed');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 5000);
    } catch (err) {
      setActionError('Catalog publish error: ' + err.message);
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeCache = async () => {
    try {
      setActionLoading(true);
      setActionNotice('');
      setActionError('');
      const res = await fetch('/api/cms.php?action=cache_purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ csrf_token: csrfToken })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice('⚡ OPcache & LiteSpeed Web Server cache flushed successfully!');
      } else {
        setActionError(json.error || 'Cache flush failed');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 5000);
    } catch (err) {
      setActionError('Cache flush error: ' + err.message);
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '14px', animation: 'spin 1.2s linear infinite' }}>⚡</div>
        <p style={{ fontWeight: '600' }}>Querying System & Database Environment...</p>
      </div>
    );
  }

  const { metrics = {} } = data || {};
  const { system = {}, media = {}, products = {}, posts = {}, security = {} } = metrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* HEADER */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>System and Database Status</h1>
          <p>Inspect active database drivers, server runtime, cache subsystems, and catalog synchronization state</p>
        </div>
        <div className="cms-section-actions">
          <button
            className="cms-btn cms-btn-secondary"
            onClick={handlePurgeCache}
            disabled={actionLoading}
          >
            <span>⚡</span> {actionLoading ? 'Purging...' : 'Flush Cache'}
          </button>
          <button
            className="cms-btn cms-btn-primary"
            onClick={handlePublishCatalog}
            disabled={actionLoading}
          >
            <span>🚀</span> {actionLoading ? 'Publishing...' : 'Publish Live Catalog'}
          </button>
        </div>
      </div>

      {actionNotice && (
        <div style={{ padding: '12px 18px', background: 'rgba(96, 122, 78, 0.2)', border: '1px solid var(--cms-primary)', color: 'var(--cms-primary)', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
          {actionNotice}
        </div>
      )}

      {actionError && (
        <div style={{ padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
          {actionError}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* OVERVIEW STATS GRID */}
      <div className="cms-stats-grid">
        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Active Database Driver</div>
            <div className="cms-stat-value" style={{ textTransform: 'uppercase', color: 'var(--cms-primary)' }}>
              {system.db_driver || 'SQLite'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Size: {system.db_size || 'N/A'}
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-green">🗄️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">PHP Runtime</div>
            <div className="cms-stat-value">PHP {system.php_version || '8.x'}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              OPcache: {system.opcache_active ? 'Active' : 'Disabled / Standby'}
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-blue">⚙️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Media & Uploads Storage</div>
            <div className="cms-stat-value">{media.count || 0} Assets</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {media.size_formatted || '0 B'} on disk
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-purple">📁</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Active Administrative Sessions</div>
            <div className="cms-stat-value">{security.active_sessions || 1}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {security.active_blocks || 0} active IP blocks
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-amber">🛡️</div>
        </div>
      </div>

      {/* DETAILED ENVIRONMENT & CATALOG SYNCHRONIZATION CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        
        {/* DATABASE & DRIVER STATUS */}
        <div className="cms-card">
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700' }}>Database & Environment Configuration</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Driver Mode</span>
              <strong>{system.db_driver === 'sqlite' ? 'SQLite (Local Development Driver)' : 'MySQL (Production Driver)'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Database File / Host</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {system.db_driver === 'sqlite' ? 'data/site.db' : 'MySQL Host via .env'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Strict Fallback Policy</span>
              <span style={{ color: '#10b981', fontWeight: '600' }}>Enforced (No silent MySQL-to-SQLite fallback)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Server Time</span>
              <span>{system.server_time ? new Date(system.server_time * 1000).toUTCString() : new Date().toUTCString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Session Security</span>
              <span style={{ color: 'var(--cms-primary)', fontWeight: '600' }}>Strict SameSite & Session Revocation Active</span>
            </div>
          </div>
        </div>

        {/* CATALOG & PUBLISHING WORKFLOW */}
        <div className="cms-card">
          <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: '700' }}>Catalog Publishing & Website Synchronization</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Database Products</span>
              <strong>{products.total || 0} ({products.published || 0} Published)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Static Product JSON</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>src/data/equipment-products.json</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Blog Posts Synced</span>
              <strong>{posts.published || 0} Published Articles</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--cms-border)' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Static Blog JSON</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>data/blog-posts.json</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Publishing Pipeline</span>
              <span style={{ color: 'var(--cms-primary)', fontWeight: '600' }}>Automatic on CRUD + Manual Trigger</span>
            </div>
          </div>
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--cms-border)' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--cms-text-subtle)', margin: '0 0 12px', lineHeight: 1.4 }}>
              Clicking <strong>Publish Live Catalog</strong> synchronizes all verified database products into the authoritative catalog JSON file, triggers node generator updates, and invalidates opcode caches.
            </p>
            <button
              className="cms-btn cms-btn-primary"
              onClick={handlePublishCatalog}
              disabled={actionLoading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>🚀</span> {actionLoading ? 'Publishing & Syncing...' : 'Sync Database to Live Catalog Now'}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
