import React, { useState, useEffect } from 'react';
import './cms-vuexy.css';

export default function CmsDashboard({ onNavigateTab, onSelectPost, csrfToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/cms.php?action=dashboard_metrics');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch dashboard metrics');
      }
      setData(json);
    } catch (err) {
      setError(err.message || 'Error connecting to CMS backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

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
        setActionError(json.error || 'Server rejected cache flush request');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 4500);
    } catch (err) {
      setActionError('Cache flush request failed: ' + err.message);
      setTimeout(() => setActionError(''), 4500);
    } finally {
      setActionLoading(false);
    }
  };

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
        setActionNotice(`✔ Live catalog published! (${json.products_synced} products, ${json.blog_posts_synced} blog posts synchronized).`);
        fetchMetrics();
      } else {
        setActionError(json.error || 'Catalog publishing failed');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 5000);
    } catch (err) {
      setActionError('Catalog publish failed: ' + err.message);
      setTimeout(() => setActionError(''), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '14px', animation: 'spin 1.2s linear infinite' }}>⚡</div>
        <p style={{ fontWeight: '600', fontSize: '1.05rem', color: 'var(--cms-text)' }}>
          Loading StoneKrusher Command Center...
        </p>
        <span style={{ fontSize: '0.85rem' }}>Querying authoritative database metrics and telemetry...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{
          maxWidth: '520px',
          margin: '0 auto',
          padding: '28px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '16px'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px', color: '#ef4444' }}>Dashboard Metric Service Unavailable</h3>
          <p style={{ margin: '0 0 16px', color: 'var(--cms-text-muted)', fontSize: '0.9rem' }}>{error}</p>
          <button className="cms-btn cms-btn-primary" onClick={fetchMetrics}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { metrics = {}, recent_posts = [], recent_activity = [], recent_inquiries = [] } = data || {};
  const {
    posts = {},
    products = {},
    media = {},
    inquiries = {},
    support = {},
    security = {},
    system = {},
    analytics = {},
    activity_chart = []
  } = metrics;

  const maxActivityValue = Math.max(1, ...activity_chart.map(a => Math.max(a.inquiries || 0, a.activity || 0)));

  return (
    <div className="cms-vuexy-grid" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ACTION NOTICE / ERROR TOASTS */}
      {actionNotice && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(96, 122, 78, 0.18)',
          border: '1px solid var(--cms-primary)',
          color: 'var(--cms-primary)',
          borderRadius: '12px',
          fontSize: '0.9rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.2s ease'
        }}>
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice('')}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          borderRadius: '12px',
          fontSize: '0.9rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.2s ease'
        }}>
          <span>{actionError}</span>
          <button
            onClick={() => setActionError('')}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* QUICK COMMAND TOOLS BAR */}
      <div className="cms-vuexy-tools-bar">
        <div className="cms-vuexy-tools-title">
          <span>🛠️</span>
          <span>Executive Actions & Live Synchronization</span>
        </div>
        <div className="cms-vuexy-tools-group">
          <button
            className="cms-vuexy-tool-btn primary"
            onClick={() => onNavigateTab('posts', { mode: 'create' })}
          >
            <span>✍️</span> Compose Article
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={() => onNavigateTab('products')}
          >
            <span>🚜</span> Catalog ({products.published || 0} Live)
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={() => onNavigateTab('crm')}
          >
            <span>📋</span> Quotes ({inquiries.new || 0} New)
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={handlePublishCatalog}
            disabled={actionLoading}
            title="Publish verified database products to public website catalog"
          >
            <span>🚀</span> {actionLoading ? 'Syncing...' : 'Publish Live Catalog'}
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={handlePurgeCache}
            disabled={actionLoading}
            title="Flush PHP OPcache & LiteSpeed Web Cache"
          >
            <span>⚡</span> {actionLoading ? 'Purging...' : 'Flush Server Cache'}
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={() => onNavigateTab('security')}
          >
            <span>🛡️</span> Security Health
          </button>
        </div>
      </div>

      {/* ROW 1: PRIMARY AUTHORITATIVE METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
        
        {/* PRODUCTS & CATALOG CARD */}
        <div
          className="cms-vuexy-card"
          onClick={() => onNavigateTab('products')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
          title="Click to manage machinery products"
        >
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Machinery Catalog</h3>
              <span className="cms-vuexy-card-subtitle">Equipment & attachments fleet</span>
            </div>
            <span style={{ fontSize: '1.4rem' }}>🚜</span>
          </div>
          <div className="cms-vuexy-kpi-value">{products.total ?? 0}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span
              onClick={(e) => { e.stopPropagation(); onNavigateTab('products', { status: 'Published' }); }}
              style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(96, 122, 78, 0.18)', color: 'var(--cms-primary)', fontWeight: '600' }}
            >
              {products.published ?? 0} Published
            </span>
            <span style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'var(--cms-bg-muted)', color: 'var(--cms-text-subtle)' }}>
              {products.categories ?? 0} Categories
            </span>
          </div>
        </div>

        {/* BLOG ARTICLES CARD */}
        <div
          className="cms-vuexy-card"
          onClick={() => onNavigateTab('posts')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
          title="Click to manage blog articles"
        >
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Blog Articles</h3>
              <span className="cms-vuexy-card-subtitle">Operator guides & SEO news</span>
            </div>
            <span style={{ fontSize: '1.4rem' }}>📝</span>
          </div>
          <div className="cms-vuexy-kpi-value">{posts.total ?? 0}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span
              onClick={(e) => { e.stopPropagation(); onNavigateTab('posts', { status: 'Published' }); }}
              style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: '600' }}
            >
              {posts.published ?? 0} Published
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); onNavigateTab('posts', { status: 'Draft' }); }}
              style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: '600' }}
            >
              {posts.draft ?? 0} Drafts
            </span>
            {(posts.trash ?? 0) > 0 && (
              <span
                onClick={(e) => { e.stopPropagation(); onNavigateTab('posts', { status: 'Trash' }); }}
                style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: '600' }}
              >
                {posts.trash} Trash
              </span>
            )}
          </div>
        </div>

        {/* CRM QUOTE LEADS CARD */}
        <div
          className="cms-vuexy-card"
          onClick={() => onNavigateTab('crm')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
          title="Click to view CRM inquiries"
        >
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Inbound RFQ Leads</h3>
              <span className="cms-vuexy-card-subtitle">Active customer inquiries</span>
            </div>
            <span style={{ fontSize: '1.4rem' }}>📋</span>
          </div>
          <div className="cms-vuexy-kpi-value">{inquiries.total ?? 0}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span
              onClick={(e) => { e.stopPropagation(); onNavigateTab('crm', { status: 'New' }); }}
              style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(96, 122, 78, 0.22)', color: 'var(--cms-primary)', fontWeight: '700' }}
            >
              {inquiries.new ?? 0} New
            </span>
            <span style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'var(--cms-bg-muted)', color: 'var(--cms-text-subtle)' }}>
              Pipeline: {inquiries.pipeline_value_formatted ?? '$0'}
            </span>
          </div>
        </div>

        {/* SUPPORT TICKETS CARD */}
        <div
          className="cms-vuexy-card"
          onClick={() => onNavigateTab('support')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
          title="Click to view support tickets"
        >
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Support & Service</h3>
              <span className="cms-vuexy-card-subtitle">Warranty & maintenance tickets</span>
            </div>
            <span style={{ fontSize: '1.4rem' }}>🎫</span>
          </div>
          <div className="cms-vuexy-kpi-value">{support.total ?? 0}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span
              onClick={(e) => { e.stopPropagation(); onNavigateTab('support', { status: 'Open' }); }}
              style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: '600' }}
            >
              {support.open ?? 0} Open
            </span>
            <span style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: '600' }}
            >
              {support.resolution_rate ?? 0}% Resolved
            </span>
          </div>
        </div>

      </div>

      {/* ROW 2: REAL 7-DAY ACTIVITY CHART + EXTERNAL INTEGRATIONS + SYSTEM HEALTH */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
        
        {/* REAL 7-DAY ACTIVITY CHART */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Real 7-Day Activity Telemetry</h3>
              <span className="cms-vuexy-card-subtitle">Verified database operations & inbound requests</span>
            </div>
          </div>

          <div style={{ margin: '14px 0 6px', height: '140px', display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
            {activity_chart.length > 0 ? (
              activity_chart.map((day, idx) => {
                const totalDayOps = (day.inquiries || 0) + (day.activity || 0);
                const barHeightPercent = maxActivityValue > 0 ? Math.max(12, Math.round((totalDayOps / maxActivityValue) * 100)) : 10;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--cms-text-subtle)', marginBottom: '4px', fontWeight: '600' }}>
                      {totalDayOps}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '28px',
                        height: `${barHeightPercent}%`,
                        background: totalDayOps > 0 ? 'var(--cms-primary)' : 'var(--cms-border)',
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'height 0.3s ease'
                      }}
                      title={`${day.date}: ${day.inquiries} Inquiries, ${day.activity} Audit Operations`}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)', marginTop: '8px', fontWeight: '500' }}>
                      {day.day}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--cms-text-subtle)', fontSize: '0.85rem', padding: '20px 0' }}>
                No database activity recorded in the past 7 days.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--cms-border)', paddingTop: '10px', marginTop: '6px' }}>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.75rem', color: 'var(--cms-text-subtle)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cms-primary)' }} />
                Content & Security Audits
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>
              Queried from cms_audit_logs
            </span>
          </div>
        </div>

        {/* HONEST ANALYTICS & INTEGRATION STATUS */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">External Analytics & Crawlers</h3>
              <span className="cms-vuexy-card-subtitle">Integration configuration status</span>
            </div>
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              onClick={() => onNavigateTab('settings')}
            >
              Configure →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            {/* Google Analytics 4 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--cms-bg-muted)',
              border: '1px solid var(--cms-border)'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--cms-text)' }}>Google Analytics 4</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-subtle)' }}>
                  {analytics.ga4?.connected ? `Measurement ID: ${analytics.ga4.id}` : 'Visitor tracking unconfigured'}
                </div>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '999px',
                background: analytics.ga4?.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                color: analytics.ga4?.connected ? '#10b981' : '#ef4444'
              }}>
                {analytics.ga4?.status_label || 'Not Configured'}
              </span>
            </div>

            {/* Google Search Console */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--cms-bg-muted)',
              border: '1px solid var(--cms-border)'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--cms-text)' }}>Google Search Console</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-subtle)' }}>
                  {analytics.gsc?.connected ? `Site: ${analytics.gsc.url}` : 'Search indexing API unconfigured'}
                </div>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '999px',
                background: analytics.gsc?.connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                color: analytics.gsc?.connected ? '#10b981' : '#ef4444'
              }}>
                {analytics.gsc?.status_label || 'Not Configured'}
              </span>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--cms-text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
              ℹ️ Live visitor volume, conversions, and organic search rankings require external Google Analytics & Search Console credentials. Configure them in CMS Configuration.
            </p>
          </div>
        </div>

        {/* SYSTEM & DATABASE STATUS CARD */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">System & Storage Health</h3>
              <span className="cms-vuexy-card-subtitle">Runtime environment</span>
            </div>
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              onClick={() => onNavigateTab('system')}
            >
              Details →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Database Driver</span>
              <strong style={{ textTransform: 'uppercase', color: 'var(--cms-primary)' }}>{system.db_driver || 'SQLite'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Database Size</span>
              <span>{system.db_size || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>Media Storage</span>
              <span>{media.count || 0} files ({media.size_formatted || '0 B'})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>PHP Runtime</span>
              <span>PHP {system.php_version || '8.x'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--cms-text-subtle)' }}>OPcache Status</span>
              <span style={{ color: system.opcache_active ? '#10b981' : 'var(--cms-text-subtle)', fontWeight: '600' }}>
                {system.opcache_active ? 'Active' : 'Disabled / Standby'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 3: RECENT CONTENT & CRM INQUIRIES TABLES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
        
        {/* RECENT BLOG POSTS */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Recent Blog Articles</h3>
              <span className="cms-vuexy-card-subtitle">Latest editorial changes</span>
            </div>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => onNavigateTab('posts')}>
              View All ({posts.total || 0}) →
            </button>
          </div>

          <div style={{ marginTop: '12px', overflowX: 'auto' }}>
            {recent_posts.length > 0 ? (
              <table className="cms-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_posts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: '600', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </td>
                      <td style={{ color: 'var(--cms-text-subtle)' }}>{p.category}</td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: p.status === 'Published' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: p.status === 'Published' ? '#10b981' : '#f59e0b',
                          fontWeight: '600'
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="cms-btn cms-btn-secondary cms-btn-sm"
                          onClick={() => onSelectPost ? onSelectPost(p.id) : onNavigateTab('posts')}
                          style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--cms-text-muted)', fontSize: '0.85rem' }}>
                No blog articles published yet. Click "Compose Article" above to create one.
              </div>
            )}
          </div>
        </div>

        {/* RECENT INQUIRIES & RFQS */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Recent Inbound RFQs</h3>
              <span className="cms-vuexy-card-subtitle">Customer machinery inquiries</span>
            </div>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => onNavigateTab('crm')}>
              All Leads ({inquiries.total || 0}) →
            </button>
          </div>

          <div style={{ marginTop: '12px', overflowX: 'auto' }}>
            {recent_inquiries.length > 0 ? (
              <table className="cms-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Equipment</th>
                    <th>Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_inquiries.map((inq) => (
                    <tr
                      key={inq.id}
                      onClick={() => onNavigateTab('crm')}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: '600' }}>
                        <div>{inq.name}</div>
                        {inq.company && <small style={{ color: 'var(--cms-text-subtle)' }}>{inq.company}</small>}
                      </td>
                      <td style={{ color: 'var(--cms-text-subtle)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inq.machine_model || 'General RFQ'}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {inq.estimated_value ? `$${Number(inq.estimated_value).toLocaleString()}` : '—'}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: inq.status === 'New' ? 'rgba(96, 122, 78, 0.22)' : 'var(--cms-bg-muted)',
                          color: inq.status === 'New' ? 'var(--cms-primary)' : 'var(--cms-text)',
                          fontWeight: '600'
                        }}>
                          {inq.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--cms-text-muted)', fontSize: '0.85rem' }}>
                No customer inquiries received yet.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ROW 4: RECENT AUDIT TRAIL / SECURITY LOGS */}
      <div className="cms-vuexy-card">
        <div className="cms-vuexy-card-header">
          <div>
            <h3 className="cms-vuexy-card-title">Security & Audit Activity Trail</h3>
            <span className="cms-vuexy-card-subtitle">Real persisted administrative operations</span>
          </div>
          <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => onNavigateTab('security')}>
            Security Center →
          </button>
        </div>

        <div style={{ marginTop: '12px', overflowX: 'auto' }}>
          {recent_activity.length > 0 ? (
            <table className="cms-table" style={{ width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>User</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {recent_activity.map((act) => (
                  <tr key={act.id}>
                    <td style={{ color: 'var(--cms-text-subtle)', whiteSpace: 'nowrap' }}>
                      {new Date(act.created_at * 1000).toLocaleString()}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(96, 122, 78, 0.14)',
                        color: 'var(--cms-primary)',
                        fontWeight: '600',
                        fontSize: '0.75rem'
                      }}>
                        {act.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--cms-text-muted)' }}>
                      {act.resource_type} {act.resource_id ? `#${act.resource_id}` : ''}
                    </td>
                    <td style={{ fontWeight: '500' }}>{act.username || 'System'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: 'var(--cms-text-subtle)' }}>
                      {act.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--cms-text-muted)', fontSize: '0.85rem' }}>
              No audit trail events logged yet.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
