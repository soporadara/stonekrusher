import React, { useState, useEffect } from 'react';

export default function CmsSeoSuite({ csrfToken }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pingStatus, setPingStatus] = useState('');
  const [pingError, setPingError] = useState('');
  const [pingLoading, setPingLoading] = useState(false);

  const fetchSeoStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/cms.php?action=seo_stats');
      const json = await res.json();
      if (res.ok && json.success) {
        setStats(json.seo || {});
      } else {
        setError(json.error || 'Failed to load SEO statistics');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to SEO API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeoStats();
  }, []);

  const handlePingSearchEngines = async () => {
    setPingLoading(true);
    setPingStatus('Submitting sitemap and key landing URLs via IndexNow protocol...');
    setPingError('');
    try {
      const res = await fetch('/api/cms.php?action=seo_ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ csrf_token: csrfToken })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPingStatus(json.message || 'IndexNow ping accepted by search engines.');
      } else {
        setPingError(json.error || 'Search engine ping failed.');
        setPingStatus('');
      }
    } catch (err) {
      setPingError('Ping network error: ' + err.message);
      setPingStatus('');
    } finally {
      setPingLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '14px', animation: 'spin 1.2s linear infinite' }}>⚡</div>
        <p style={{ fontWeight: '600' }}>Analyzing Website SEO & Crawler Indexing Telemetry...</p>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>SEO & Search Engine Indexing Suite</h1>
          <p>Monitor search crawler discovery, sitemap integrity, and IndexNow real-time engine pings</p>
        </div>
        <div className="cms-section-actions">
          <button
            className="cms-btn cms-btn-primary"
            onClick={handlePingSearchEngines}
            disabled={pingLoading}
          >
            <span>📡</span> {pingLoading ? 'Pinging Engines...' : 'Ping IndexNow (Bing & Google)'}
          </button>
        </div>
      </div>

      {pingStatus && (
        <div style={{ padding: '12px 18px', background: 'rgba(96, 122, 78, 0.2)', border: '1px solid var(--cms-primary)', color: 'var(--cms-primary)', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
          {pingStatus}
        </div>
      )}

      {pingError && (
        <div style={{ padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
          {pingError}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 18px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* KPI METRICS */}
      <div className="cms-stats-grid">
        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Verified Sitemap URLs</div>
            <div className="cms-stat-value">{s.sitemap_urls || 0}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {s.sitemap_exists ? 'Active in public/sitemap.xml' : 'Sitemap file not found'}
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-green">🗺️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Crawlable Equipment Specs</div>
            <div className="cms-stat-value">{s.crawlable_products || 0}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Pre-rendered static HTML pages
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-blue">🚜</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Equipment Categories</div>
            <div className="cms-stat-value">{s.categories_count || 0}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Distinct product hubs
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-purple">🏷️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">AI & LLM Crawlability</div>
            <div className="cms-stat-value" style={{ color: s.llms_exists ? '#10b981' : '#f59e0b' }}>
              {s.llms_exists ? 'Active' : 'Missing'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              public/llms.txt {s.llms_exists ? 'verified' : 'not found'}
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-amber">🤖</div>
        </div>
      </div>

      {/* SITEMAP & ENGINE STATUS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        
        {/* SITEMAP & DISCOVERY STATUS */}
        <div className="cms-card">
          <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: '700' }}>XML Sitemaps & Search Endpoints</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--cms-border)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Primary Sitemap XML</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-subtle)' }}>/sitemap.xml</div>
              </div>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: s.sitemap_exists ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: s.sitemap_exists ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {s.sitemap_exists ? '200 OK' : 'Missing'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--cms-border)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Sitemap Index XML</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-subtle)' }}>/sitemap_index.xml</div>
              </div>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: s.sitemap_index_exists ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: s.sitemap_index_exists ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {s.sitemap_index_exists ? '200 OK' : 'Missing'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--cms-border)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Robots Directives</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-subtle)' }}>/robots.txt</div>
              </div>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: s.robots_exists ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: s.robots_exists ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {s.robots_exists ? 'Verified' : 'Missing'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>IndexNow Verification Key</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-subtle)', fontFamily: 'monospace' }}>
                  {s.indexnow_key_location || '/4e2c9180ab5f4f899b418a032d8471e6.txt'}
                </div>
              </div>
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '999px', background: 'rgba(96, 122, 78, 0.18)', color: 'var(--cms-primary)', fontWeight: '600' }}>
                Active
              </span>
            </div>
          </div>
        </div>

        {/* SEARCH CONSOLE & ANALYTICS CONNECTIVITY */}
        <div className="cms-card">
          <h3 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: '700' }}>Search Engine Crawlers & Analytics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'var(--cms-bg-muted)', borderRadius: '10px', border: '1px solid var(--cms-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Bing & Yandex IndexNow Protocol</strong>
                <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: '600' }}>
                  Ready
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--cms-text-subtle)' }}>
                Direct HTTP API pushes newly published equipment and blog URLs immediately to Microsoft Bing and Yandex indexes.
              </p>
            </div>

            <div style={{ padding: '12px', background: 'var(--cms-bg-muted)', borderRadius: '10px', border: '1px solid var(--cms-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Google Search Console</strong>
                <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: s.gsc_connected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: s.gsc_connected ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                  {s.gsc_connected ? 'Configured' : 'Not Connected'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--cms-text-subtle)' }}>
                {s.gsc_connected ? 'Live site URL registered in configuration.' : 'Configure Google Search Console property in CMS Website Settings.'}
              </p>
            </div>

            <div style={{ padding: '12px', background: 'var(--cms-bg-muted)', borderRadius: '10px', border: '1px solid var(--cms-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Canonical URL Base</strong>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--cms-primary)' }}>
                  {s.site_url || 'https://stonekrusher.com'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--cms-text-subtle)' }}>
                Used in canonical tags and OpenGraph headers across all 313+ crawlable pages.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
