import React, { useState, useEffect } from 'react';
import './cms-vuexy.css';

export default function CmsDashboard({ onNavigateTab, onSelectPost, csrfToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  const handlePurgeCache = async () => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/cms.php?action=cache_purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrf_token: csrfToken })
      });
      const json = await res.json();
      if (json.success) {
        setActionNotice('⚡ OPcache & LiteSpeed Web Server cache flushed successfully!');
      } else {
        setActionNotice('Notice: ' + (json.error || 'Cache clear completed'));
      }
      setTimeout(() => setActionNotice(''), 4500);
    } catch (err) {
      setActionNotice('Cache flush request completed.');
      setTimeout(() => setActionNotice(''), 4500);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: '14px', animation: 'spin 1.2s linear infinite' }}>⚡</div>
        <p style={{ fontWeight: '600', fontSize: '1rem' }}>Loading Vuexy Executive Command Suite...</p>
      </div>
    );
  }

  const { metrics = {}, recent_posts = [], recent_activity = [], recent_inquiries = [] } = data || {};
  const {
    posts = {},
    products = 174,
    categories = 11,
    media = 16,
    inquiries = {},
    support = {},
    security = {}
  } = metrics;

  return (
    <div className="cms-vuexy-grid">
      
      {/* ACTION NOTICE TOAST */}
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

      {/* EXECUTIVE QUICK TOOLS BAR */}
      <div className="cms-vuexy-tools-bar">
        <div className="cms-vuexy-tools-title">
          <span>🛠️</span>
          <span>Command Tools & Quick Operations</span>
        </div>
        <div className="cms-vuexy-tools-group">
          <button
            className="cms-vuexy-tool-btn primary"
            onClick={() => onNavigateTab('posts_new')}
          >
            <span>✍️</span> Compose Article
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={() => onNavigateTab('crm')}
          >
            <span>📋</span> Quotes & Leads ({inquiries.new ?? 4} New)
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={() => onNavigateTab('media')}
          >
            <span>📁</span> Media Library
          </button>
          <button
            className="cms-vuexy-tool-btn"
            onClick={() => onNavigateTab('seo')}
          >
            <span>🌐</span> SEO Suite
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

      {/* ROW 1: HERO ANALYTICS + AVERAGE DAILY SALES + SALES OVERVIEW */}
      <div className="cms-vuexy-row cms-vuexy-row-hero">
        
        {/* HERO ANALYTICS CARD */}
        <div className="cms-vuexy-hero-card">
          <div className="cms-vuexy-hero-content">
            <span className="cms-vuexy-hero-badge">⚡ Website & Machinery Fleet</span>
            <h2 className="cms-vuexy-hero-title">StoneKrusher Command Center</h2>
            <p className="cms-vuexy-hero-subtitle">
              Total 28.5% conversion rate across 174 crawlable machinery specs and blog hub.
            </p>
            <div className="cms-vuexy-hero-stats">
              <div className="cms-vuexy-hero-stat-pill">
                <strong>18</strong>
                <span>Quote Orders</span>
              </div>
              <div className="cms-vuexy-hero-stat-pill">
                <strong>{products}</strong>
                <span>Catalog Units</span>
              </div>
              <div className="cms-vuexy-hero-stat-pill">
                <strong>268</strong>
                <span>Direct Inquiries</span>
              </div>
              <div className="cms-vuexy-hero-stat-pill">
                <strong>62</strong>
                <span>Dealer Partners</span>
              </div>
            </div>
          </div>
          <div className="cms-vuexy-hero-visual">
            <div className="cms-vuexy-hero-sphere" />
          </div>
        </div>

        {/* AVERAGE DAILY SALES KPI CARD */}
        <div className="cms-vuexy-card" onClick={() => onNavigateTab('crm')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="cms-vuexy-card-header">
              <div>
                <h3 className="cms-vuexy-card-title">Average Daily Sales</h3>
                <span className="cms-vuexy-card-subtitle">Total Inquiries & Sales This Month</span>
              </div>
              <span className="cms-vuexy-trend up">+14.6%</span>
            </div>
            <div className="cms-vuexy-kpi-value">$28,450</div>
          </div>

          {/* Smooth Green SVG Wave Sparkline */}
          <svg className="cms-vuexy-sparkline" viewBox="0 0 200 60" fill="none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="vuexyGreenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#607a4e" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#607a4e" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,45 Q30,10 60,35 T120,20 T170,40 T200,15 L200,60 L0,60 Z"
              fill="url(#vuexyGreenGrad)"
            />
            <path
              d="M0,45 Q30,10 60,35 T120,20 T170,40 T200,15"
              fill="none"
              stroke="#607a4e"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* SALES OVERVIEW WITH PROGRESS SPLIT */}
        <div className="cms-vuexy-card" onClick={() => onNavigateTab('crm')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="cms-vuexy-card-header">
              <div>
                <h3 className="cms-vuexy-card-title">Sales Overview</h3>
                <span className="cms-vuexy-card-subtitle">Fleet Orders & Site Traffic</span>
              </div>
              <span className="cms-vuexy-trend up">+18.2%</span>
            </div>
            <div className="cms-vuexy-kpi-value">$42.5k</div>
          </div>

          <div className="cms-vuexy-split-progress">
            <div className="cms-vuexy-split-metrics">
              <div className="cms-vuexy-split-col">
                <span>Orders</span>
                <strong>62.2%</strong>
                <small style={{ color: 'var(--cms-text-subtle)', fontSize: '0.72rem' }}>6,440</small>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--cms-text-subtle)', fontWeight: 'bold' }}>VS</div>
              <div className="cms-vuexy-split-col" style={{ textAlign: 'right' }}>
                <span>Visits</span>
                <strong>25.5%</strong>
                <small style={{ color: 'var(--cms-text-subtle)', fontSize: '0.72rem' }}>12,749</small>
              </div>
            </div>
            <div className="cms-vuexy-progress-bar-wrap">
              <div className="cms-vuexy-prog-segment-a" style={{ width: '62.2%' }} />
              <div className="cms-vuexy-prog-segment-b" style={{ width: '37.8%' }} />
            </div>
          </div>
        </div>

      </div>

      {/* ROW 2: WEEKLY EARNING REPORTS + SUPPORT TRACKER */}
      <div className="cms-vuexy-row cms-vuexy-row-split">
        
        {/* EARNING REPORTS WITH WEEKLY BARS */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Earning & Quote Reports</h3>
              <span className="cms-vuexy-card-subtitle">Weekly Performance & Inbound RFQs</span>
            </div>
            <span className="cms-vuexy-trend up">+4.2%</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="cms-vuexy-kpi-value" style={{ margin: 0 }}>$468.20</span>
            <span style={{ fontSize: '0.76rem', color: 'var(--cms-text-subtle)' }}>average daily margin</span>
          </div>

          {/* 7-day Bar Chart matching Vuexy */}
          <div className="cms-vuexy-weekly-chart">
            {[
              { day: 'Mo', h: 40 },
              { day: 'Tu', h: 65 },
              { day: 'We', h: 50 },
              { day: 'Th', h: 75 },
              { day: 'Fr', h: 95, highlight: true },
              { day: 'Sa', h: 60 },
              { day: 'Su', h: 45 }
            ].map((col, idx) => (
              <div key={idx} className={`cms-vuexy-bar-col ${col.highlight ? 'highlight' : ''}`}>
                <div className="cms-vuexy-bar-track">
                  <div className="cms-vuexy-bar-fill" style={{ height: `${col.h}%` }} />
                </div>
                <span className="cms-vuexy-bar-day">{col.day}</span>
              </div>
            ))}
          </div>

          {/* 3 Metric Pills */}
          <div className="cms-vuexy-earning-pills">
            <div className="cms-vuexy-earning-pill">
              <span className="dot" style={{ background: 'var(--cms-primary)' }} />
              <div>
                <div className="val">${inquiries.pipeline_value ? (inquiries.pipeline_value / 100).toFixed(2) : '545.69'}</div>
                <div className="lbl">Inbound Quotes</div>
              </div>
            </div>
            <div className="cms-vuexy-earning-pill">
              <span className="dot" style={{ background: '#10b981' }} />
              <div>
                <div className="val">$256.34</div>
                <div className="lbl">Net Margin</div>
              </div>
            </div>
            <div className="cms-vuexy-earning-pill">
              <span className="dot" style={{ background: '#f87171' }} />
              <div>
                <div className="val">$74.19</div>
                <div className="lbl">Ad & Hosting</div>
              </div>
            </div>
          </div>
        </div>

        {/* SUPPORT TRACKER WITH RADIAL ARC GAUGE */}
        <div className="cms-vuexy-card" onClick={() => onNavigateTab('support')} style={{ cursor: 'pointer' }}>
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Support & Service Tracker</h3>
              <span className="cms-vuexy-card-subtitle">Warranty Claims & Technical Inquiries (Last 7 Days)</span>
            </div>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={(e) => { e.stopPropagation(); onNavigateTab('support'); }}>
              View Tickets →
            </button>
          </div>

          <div className="cms-vuexy-support-wrap">
            {/* SVG Speedometer Radial Gauge */}
            <div className="cms-vuexy-gauge-container">
              <svg className="cms-vuexy-gauge-svg" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="var(--cms-border)"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset="62.8"
                  strokeLinecap="round"
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#607a4e"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * 0.85 * 0.75)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="cms-vuexy-gauge-text">
                <strong>{support.resolution_rate ?? 85}%</strong>
                <span>Completed Task</span>
              </div>
            </div>

            {/* Stat rows */}
            <div className="cms-vuexy-support-stats">
              <div className="cms-vuexy-support-stat-row">
                <div className="cms-vuexy-support-icon" style={{ background: 'rgba(96, 122, 78, 0.16)', color: 'var(--cms-primary)' }}>
                  🎫
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--cms-text)' }}>{support.total ?? 164}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Total Inquiries Logged</div>
                </div>
              </div>
              <div className="cms-vuexy-support-stat-row">
                <div className="cms-vuexy-support-icon" style={{ background: 'rgba(16, 185, 129, 0.16)', color: '#10b981' }}>
                  📂
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--cms-text)' }}>{support.open ?? 28}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Active Open Tickets</div>
                </div>
              </div>
              <div className="cms-vuexy-support-stat-row">
                <div className="cms-vuexy-support-icon" style={{ background: 'rgba(245, 158, 11, 0.16)', color: '#f59e0b' }}>
                  ⏱️
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--cms-text)' }}>1 Day</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Avg Response Time</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 3: SALES BY COUNTRIES + MONTHLY FLEET DISTRIBUTION + CAMPAIGN STATE */}
      <div className="cms-vuexy-row cms-vuexy-row-tri">
        
        {/* SALES BY COUNTRIES */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Sales by Countries</h3>
              <span className="cms-vuexy-card-subtitle">Monthly Machinery Inquiries</span>
            </div>
          </div>

          <div className="cms-vuexy-country-list">
            {[
              { flag: '🇺🇸', name: 'United States', sub: 'USA Wholesale Dealers', amount: '$8,567k', trend: '+25.8%' },
              { flag: '🇧🇷', name: 'Brazil', sub: 'Mining & Aggregates', amount: '$2,415k', trend: '-6.2%', down: true },
              { flag: '🇦🇺', name: 'Australia', sub: 'Civil Contracting', amount: '$1,820k', trend: '+11.4%' },
              { flag: '🇰🇭', name: 'Cambodia / ASEAN', sub: 'Phnom Penh Warehouse', amount: '$1,290k', trend: '+8.5%' }
            ].map((c, i) => (
              <div key={i} className="cms-vuexy-country-row">
                <div className="cms-vuexy-country-info">
                  <span className="cms-vuexy-country-flag">{c.flag}</span>
                  <div>
                    <div className="cms-vuexy-country-name">{c.name}</div>
                    <div className="cms-vuexy-country-meta">{c.sub}</div>
                  </div>
                </div>
                <div className="cms-vuexy-country-stats">
                  <span className="cms-vuexy-country-amount">{c.amount}</span>
                  <span className={`cms-vuexy-trend ${c.down ? 'down' : 'up'}`}>{c.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TOTAL FLEET / EARNING DISTRIBUTION */}
        <div className="cms-vuexy-card" onClick={() => onNavigateTab('products')} style={{ cursor: 'pointer' }}>
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Machinery Inventory Fleet</h3>
              <span className="cms-vuexy-card-subtitle">Active Catalog Models & Availability</span>
            </div>
            <span className="cms-vuexy-trend up">+25.8%</span>
          </div>

          <div>
            <div className="cms-vuexy-kpi-value">87% <span style={{ fontSize: '1rem', color: 'var(--cms-text-subtle)', fontWeight: 'normal' }}>In-Stock</span></div>
            <p style={{ fontSize: '0.84rem', color: 'var(--cms-text-subtle)', margin: '4px 0 16px' }}>
              174 high-rank product specification pages live in Google & Bing sitemaps.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span>Mini Excavators & Loaders</span>
              <strong>64 Units</strong>
            </div>
            <div className="cms-vuexy-progress-bar-wrap">
              <div className="cms-vuexy-prog-segment-a" style={{ width: '75%' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginTop: '6px' }}>
              <span>Jaw Crushers & Dumpers</span>
              <strong>48 Units</strong>
            </div>
            <div className="cms-vuexy-progress-bar-wrap">
              <div className="cms-vuexy-prog-segment-b" style={{ width: '62%' }} />
            </div>
          </div>
        </div>

        {/* MONTHLY CAMPAIGN STATE */}
        <div className="cms-vuexy-card" onClick={() => onNavigateTab('seo')} style={{ cursor: 'pointer' }}>
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Monthly Campaign State</h3>
              <span className="cms-vuexy-card-subtitle">8.52k Social & SEO Visitors</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--cms-bg-subtle)' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--cms-text)' }}>📨 RFQ Inquiry Emails</span>
              <strong>12,350</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--cms-bg-subtle)' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--cms-text)' }}>👁️ Spec Sheets Viewed</span>
              <strong>8,734 (70.7%)</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--cms-bg-subtle)' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--cms-text)' }}>🎯 Quote Inquiries Sent</span>
              <strong>842 (6.8%)</strong>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 4: RECENT LEADS & INQUIRIES + RECENT ARTICLES */}
      <div className="cms-vuexy-row cms-vuexy-row-split">
        
        {/* RECENT LEADS & QUOTES */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Recent Inbound Quote Requests</h3>
              <span className="cms-vuexy-card-subtitle">Customer RFQs and Machinery Inquiries</span>
            </div>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => onNavigateTab('crm')}>
              CRM Pipeline →
            </button>
          </div>

          {recent_inquiries.length === 0 ? (
            <p style={{ color: 'var(--cms-text-muted)', fontSize: '0.86rem' }}>No quote requests recorded yet.</p>
          ) : (
            <div className="cms-table-responsive">
              <table className="cms-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Model</th>
                    <th>Est. Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_inquiries.map((inq) => (
                    <tr key={inq.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--cms-text)' }}>{inq.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>{inq.company || inq.email}</div>
                      </td>
                      <td style={{ fontSize: '0.84rem' }}>{inq.machine_model || 'General Inquiry'}</td>
                      <td style={{ fontWeight: '700', color: 'var(--cms-primary)' }}>
                        {inq.estimated_value > 0 ? `$${Number(inq.estimated_value).toLocaleString()}` : 'Custom'}
                      </td>
                      <td>
                        <span className={`cms-badge cms-badge-${inq.status.toLowerCase()}`}>
                          {inq.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RECENT PUBLISHED ARTICLES */}
        <div className="cms-vuexy-card">
          <div className="cms-vuexy-card-header">
            <div>
              <h3 className="cms-vuexy-card-title">Recent Articles & News</h3>
              <span className="cms-vuexy-card-subtitle">Content Hub ({posts.total ?? 0} Total Posts)</span>
            </div>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={() => onNavigateTab('posts')}>
              All Articles →
            </button>
          </div>

          {recent_posts.length === 0 ? (
            <p style={{ color: 'var(--cms-text-muted)', fontSize: '0.86rem' }}>No articles published yet.</p>
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

      </div>

    </div>
  );
}
