import React, { useState, useEffect } from 'react';

export default function CmsDashboard({ onNavigateTab, onSelectPost }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cms.php?action=dashboard_metrics');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to fetch dashboard metrics');
      }
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚡</div>
        <p>Loading administrative dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cms-card" style={{ borderColor: 'var(--cms-danger)' }}>
        <p style={{ color: 'var(--cms-danger)', margin: 0 }}>Error: {error}</p>
        <button className="cms-btn cms-btn-secondary cms-btn-sm" style={{ marginTop: '12px' }} onClick={fetchMetrics}>
          Retry
        </button>
      </div>
    );
  }

  const { metrics, recent_posts = [], recent_activity = [] } = data || {};
  const { posts = {}, products = 0, categories = 0, media = 0, security = {} } = metrics || {};

  return (
    <div>
      {/* SECTION HEADER */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Dashboard Overview</h1>
          <p>Real-time content metrics, machinery catalog overview, and security monitoring</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-primary" onClick={() => onNavigateTab('posts_new')}>
            <span>✍️</span> New Blog Post
          </button>
          <button className="cms-btn cms-btn-secondary" onClick={() => onNavigateTab('products')}>
            <span>🚜</span> Products Catalog
          </button>
          <button className="cms-btn cms-btn-secondary" onClick={() => onNavigateTab('security')}>
            <span>🛡️</span> Security Center
          </button>
        </div>
      </div>

      {/* KPI STATS GRID */}
      <div className="cms-stats-grid">
        <div className="cms-stat-card" onClick={() => onNavigateTab('posts')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="cms-stat-label">Published Articles</div>
            <div className="cms-stat-value">{posts.published ?? 0}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {posts.draft ?? 0} Drafts · {posts.scheduled ?? 0} Scheduled · {posts.trash ?? 0} Trash
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-amber">
            📝
          </div>
        </div>

        <div className="cms-stat-card" onClick={() => onNavigateTab('products')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="cms-stat-label">Machinery Units</div>
            <div className="cms-stat-value">{products}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Loaders, excavators, forklifts
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-blue">
            🚜
          </div>
        </div>

        <div className="cms-stat-card" onClick={() => onNavigateTab('categories')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="cms-stat-label">Categories</div>
            <div className="cms-stat-value">{categories}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Machines, Guides, Industry, Safety
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-purple">
            🏷️
          </div>
        </div>

        <div className="cms-stat-card" onClick={() => onNavigateTab('security')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="cms-stat-label">Security Health</div>
            <div className="cms-stat-value" style={{ color: security.active_lockouts > 0 ? 'var(--cms-danger)' : 'var(--cms-success)' }}>
              {security.active_lockouts > 0 ? `${security.active_lockouts} Locked` : 'Healthy'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {security.failed_logins_24h ?? 0} fails (24h) · {security.active_blocks ?? 0} blocked IPs
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-green">
            🛡️
          </div>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT: RECENT POSTS + RECENT ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* RECENT POSTS */}
        <div className="cms-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>Recent Articles</h3>
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              onClick={() => onNavigateTab('posts')}
            >
              View All ({posts.total ?? 0})
            </button>
          </div>

          {recent_posts.length === 0 ? (
            <p style={{ color: 'var(--cms-text-muted)', fontSize: '0.85rem' }}>No articles published yet.</p>
          ) : (
            <div className="cms-table-responsive">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_posts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: '600', maxWidth: '200px' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {p.title}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)' }}>{p.category}</span>
                      </td>
                      <td>
                        <span className={`cms-badge cms-badge-${(p.status || 'published').toLowerCase()}`}>
                          {p.status || 'Published'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="cms-btn cms-btn-secondary cms-btn-sm"
                          onClick={() => onSelectPost(p.id)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECURITY & ACTION AUDIT TRAIL */}
        <div className="cms-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>Security & Audit Stream</h3>
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              onClick={() => onNavigateTab('security')}
            >
              Audit Logs →
            </button>
          </div>

          {recent_activity.length === 0 ? (
            <p style={{ color: 'var(--cms-text-muted)', fontSize: '0.85rem' }}>No recent audit events.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recent_activity.map((act) => {
                const dateStr = new Date(act.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isFail = act.action.includes('fail') || act.action.includes('locked');
                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: 'var(--cms-bg-subtle)',
                      border: '1px solid var(--cms-card-border)',
                      borderRadius: 'var(--cms-radius-md)',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1rem' }}>{isFail ? '⚠️' : '🛡️'}</span>
                      <div>
                        <div style={{ fontWeight: '600', color: isFail ? 'var(--cms-danger)' : 'var(--cms-text)' }}>
                          {act.action}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>
                          {act.username || 'System'} · IP: {act.ip_address}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', fontFamily: 'var(--cms-font-mono)' }}>
                      {dateStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
