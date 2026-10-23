import React, { useState, useEffect } from 'react';

export default function CmsDashboard({ onNavigateTab, onSelectPost, csrfToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Time Tracker state (ticking digital timer)
  const [trackerSeconds, setTrackerSeconds] = useState(5048); // default to 01:24:08 matching design
  const [trackerRunning, setTrackerRunning] = useState(true);

  useEffect(() => {
    let interval = null;
    if (trackerRunning) {
      interval = setInterval(() => {
        setTrackerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trackerRunning]);

  const formatTimer = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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
        setActionNotice(`✔ Live catalog published! (${json.products_synced || 0} products, ${json.blog_posts_synced || 0} posts synced).`);
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
          Loading Donezo / StoneKrusher Dashboard...
        </p>
        <span style={{ fontSize: '0.85rem' }}>Synchronizing fleet metrics, inquiries and database telemetry...</span>
      </div>
    );
  }

  const metrics = (data && data.metrics) || {};
  const {
    posts = {},
    products = {},
    inquiries = {}
  } = metrics;

  // Real or Fallback values aligned with the Donezo image
  const totalProjectsCount = products.total || 24;
  const endedProjectsCount = posts.published || 10;
  const runningProjectsCount = inquiries.total || 12;
  const pendingProjectCount = inquiries.new || 2;

  // Weekly analytics data matching Donezo pill bar chart
  const weeklyAnalytics = [
    { day: 'S', height: '60%', type: 'hatched', value: 8 },
    { day: 'M', height: '85%', type: 'solid-green', value: 14 },
    { day: 'T', height: '70%', type: 'sage', value: 10 },
    { day: 'W', height: '100%', type: 'dark-green', value: 18, isPeak: true },
    { day: 'T', height: '55%', type: 'hatched', value: 7 },
    { day: 'F', height: '75%', type: 'hatched', value: 11 },
    { day: 'S', height: '65%', type: 'hatched', value: 9 }
  ];

  // Quick project tasks
  const projectTasks = [
    { id: 1, title: 'Develop API Endpoints', due: 'Nov 24, 2026', icon: '⚡', color: '#3b82f6' },
    { id: 2, title: 'Onboarding Flow', due: 'Nov 28, 2026', icon: '🌐', color: '#10b981' },
    { id: 3, title: 'Build Dashboard', due: 'Dec 01, 2026', icon: '📊', color: '#f59e0b' },
    { id: 4, title: 'Optimize Page Load', due: 'Dec 06, 2026', icon: '🚀', color: '#8b5cf6' },
    { id: 5, title: 'Cross-Browser Testing', due: 'Dec 12, 2026', icon: '🎯', color: '#ec4899' }
  ];

  // Team Collaboration rows
  const teamMembers = [
    {
      id: 1,
      name: 'Alexandra Deff',
      role: 'Working on GitHub Project Repository',
      status: 'Completed',
      statusType: 'success',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'
    },
    {
      id: 2,
      name: 'Edwin Adenike',
      role: 'Working on Integrate User Authentication System',
      status: 'In Progress',
      statusType: 'info',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80'
    },
    {
      id: 3,
      name: 'Isaac Oluwatemilorun',
      role: 'Working on Develop Search and Filter Functionality',
      status: 'Pending',
      statusType: 'warning',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80'
    },
    {
      id: 4,
      name: 'David Oshodi',
      role: 'Working on Responsive Layout for Homepage',
      status: 'In Progress',
      statusType: 'info',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&auto=format&fit=crop&q=80'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>

      {/* FEEDBACK TOASTS */}
      {actionNotice && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(16, 185, 129, 0.14)',
          border: '1px solid #10b981',
          color: '#10b981',
          borderRadius: '16px',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>✔ {actionNotice}</span>
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
          background: 'rgba(239, 68, 68, 0.14)',
          border: '1px solid #ef4444',
          color: '#ef4444',
          borderRadius: '16px',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>⚠️ {actionError}</span>
          <button
            onClick={() => setActionError('')}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER SECTION (DONEZO STYLE) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.9rem',
            fontWeight: 800,
            margin: '0 0 4px',
            color: 'var(--cms-text)',
            letterSpacing: '-0.02em'
          }}>
            Dashboard
          </h1>
          <p style={{
            margin: 0,
            fontSize: '0.92rem',
            color: 'var(--cms-text-muted)',
            fontWeight: 450
          }}>
            Plan, prioritize, and accomplish your tasks with ease.
          </p>
        </div>

        {/* Header Action Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="cms-donezo-btn-primary"
            onClick={() => onNavigateTab('posts', { mode: 'create' })}
          >
            <span>+</span> Add Project
          </button>
          <button
            className="cms-donezo-btn-secondary"
            onClick={handlePublishCatalog}
            disabled={actionLoading}
            title="Publish verified products & blog articles to public website"
          >
            <span>🚀</span> {actionLoading ? 'Syncing...' : 'Import Data'}
          </button>
          <button
            className="cms-donezo-btn-secondary"
            onClick={handlePurgeCache}
            disabled={actionLoading}
            title="Flush PHP OPcache & LiteSpeed Server Cache"
            style={{ padding: '10px 16px' }}
          >
            <span>⚡</span> Flush Cache
          </button>
        </div>
      </div>

      {/* ROW 1: 4 DONEZO STAT CARDS (1 DARK GREEN + 3 CRISP WHITE) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '18px'
      }}>

        {/* Card 1: Total Projects (Dark Green Card from Donezo Image) */}
        <div
          className="cms-donezo-card dark-green"
          onClick={() => onNavigateTab('products')}
          style={{ cursor: 'pointer' }}
          title="Click to view Machinery Catalog"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.9 }}>Total Projects</span>
            <span className="cms-donezo-arrow-btn">↗</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {totalProjectsCount}
          </div>
          <div className="cms-donezo-kpi-sub" style={{ fontSize: '0.8rem', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📹</span>
            <span>Increased from last month</span>
          </div>
        </div>

        {/* Card 2: Ended Projects (Published Articles) */}
        <div
          className="cms-donezo-card"
          onClick={() => onNavigateTab('posts', { status: 'Published' })}
          style={{ cursor: 'pointer' }}
          title="Click to view Published Articles"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--cms-text)' }}>Ended Projects</span>
            <span className="cms-donezo-arrow-btn">↗</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--cms-text)', letterSpacing: '-0.02em' }}>
            {endedProjectsCount}
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: '16px', color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⏱️</span>
            <span>Increased from last month</span>
          </div>
        </div>

        {/* Card 3: Running Projects (Active Quotes & Inquiries) */}
        <div
          className="cms-donezo-card"
          onClick={() => onNavigateTab('crm')}
          style={{ cursor: 'pointer' }}
          title="Click to view Inbound Quotes"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--cms-text)' }}>Running Projects</span>
            <span className="cms-donezo-arrow-btn">↗</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--cms-text)', letterSpacing: '-0.02em' }}>
            {runningProjectsCount}
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: '16px', color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💼</span>
            <span>Increased from last month</span>
          </div>
        </div>

        {/* Card 4: Pending Project (Customer Comments & Reviews) */}
        <div
          className="cms-donezo-card"
          onClick={() => onNavigateTab('comments')}
          style={{ cursor: 'pointer' }}
          title="Click to moderate Customer Comments"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--cms-text)' }}>Pending Project</span>
            <span className="cms-donezo-arrow-btn">↗</span>
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--cms-text)', letterSpacing: '-0.02em' }}>
            {pendingProjectCount}
          </div>
          <div style={{ fontSize: '0.8rem', marginTop: '16px', color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💬</span>
            <span>On Discuss</span>
          </div>
        </div>

      </div>

      {/* ROW 2: MIDDLE 3-COLUMN GRID (PROJECT ANALYTICS + REMINDERS + PROJECT QUICK LIST) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '18px'
      }}>

        {/* 1. Project Analytics Card (Weekly Pill Bar Chart) */}
        <div className="cms-donezo-card" style={{ gridColumn: 'span 5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
              Project Analytics
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)', fontWeight: 600 }}>This Week</span>
          </div>

          {/* Pill Bar Chart Canvas */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: '180px',
            padding: '10px 6px 0',
            gap: '12px'
          }}>
            {weeklyAnalytics.map((bar, idx) => {
              let backgroundStyle = '';
              if (bar.type === 'hatched') {
                backgroundStyle = 'repeating-linear-gradient(45deg, #d1d5db, #d1d5db 4px, #f3f4f6 4px, #f3f4f6 8px)';
              } else if (bar.type === 'sage') {
                backgroundStyle = '#52b788';
              } else if (bar.type === 'dark-green') {
                backgroundStyle = '#0f4c3a';
              } else {
                backgroundStyle = '#2d6a4f';
              }

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    height: '100%',
                    justifyContent: 'flex-end',
                    gap: '10px'
                  }}
                >
                  {bar.isPeak && (
                    <div style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      background: '#0f4c3a',
                      color: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginBottom: '-4px'
                    }}>
                      Peak
                    </div>
                  )}
                  <div
                    title={`${bar.day}: ${bar.value} tasks/inquiries`}
                    style={{
                      width: '100%',
                      maxWidth: '34px',
                      height: bar.height,
                      borderRadius: '9999px',
                      background: backgroundStyle,
                      boxShadow: bar.isPeak ? '0 6px 14px rgba(15,76,58,0.3)' : 'none',
                      transition: 'transform 0.18s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scaleY(1.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scaleY(1)'; }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-subtle)', fontWeight: 600 }}>
                    {bar.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Reminders Card */}
        <div className="cms-donezo-card" style={{ gridColumn: 'span 3', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cms-text-muted)' }}>
              Reminders
            </span>
            <h4 style={{
              margin: '14px 0 6px',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--cms-text)',
              lineHeight: 1.3
            }}>
              Meeting with Arc Company
            </h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--cms-text-muted)' }}>
              Time : 02.00 pm - 04.00 pm
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              className="cms-donezo-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onNavigateTab('support')}
            >
              <span>🎥</span> Start Meeting
            </button>
          </div>
        </div>

        {/* 3. Project Quick List Card */}
        <div className="cms-donezo-card" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
              Project
            </h3>
            <button
              onClick={() => onNavigateTab('posts', { mode: 'create' })}
              className="cms-donezo-btn-secondary cms-donezo-btn-sm"
              style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '0.75rem' }}
            >
              + New
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {projectTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => onNavigateTab('posts')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '6px 8px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cms-bg-muted)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  fontSize: '1rem',
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--cms-bg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {t.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.86rem',
                    fontWeight: 650,
                    color: 'var(--cms-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--cms-text-subtle)' }}>
                    Due date : {t.due}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ROW 3: BOTTOM 3-COLUMN GRID (TEAM COLLABORATION + PROJECT PROGRESS + TIME TRACKER) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '18px'
      }}>

        {/* 1. Team Collaboration Card */}
        <div className="cms-donezo-card" style={{ gridColumn: 'span 5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
              Team Collaboration
            </h3>
            <button
              onClick={() => onNavigateTab('users')}
              className="cms-donezo-btn-secondary cms-donezo-btn-sm"
              style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '0.75rem' }}
            >
              + Add Member
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {teamMembers.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <img
                    src={m.avatar}
                    alt={m.name}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--cms-text)', lineHeight: 1.2 }}>
                      {m.name}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--cms-text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '220px'
                    }}>
                      {m.role}
                    </div>
                  </div>
                </div>

                {/* Status Pill Badge */}
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                  background: m.statusType === 'success' ? 'rgba(16, 185, 129, 0.15)' : m.statusType === 'warning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: m.statusType === 'success' ? '#10b981' : m.statusType === 'warning' ? '#f59e0b' : '#3b82f6',
                  whiteSpace: 'nowrap'
                }}>
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Project Progress (Semi-Circular Donut Gauge) */}
        <div className="cms-donezo-card" style={{ gridColumn: 'span 4', textAlign: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'left', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
              Project Progress
            </h3>
          </div>

          {/* SVG Semi-Circular Donut Gauge */}
          <div style={{ position: 'relative', width: '220px', height: '115px', margin: '10px auto 0' }}>
            <svg viewBox="0 0 200 110" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <pattern id="gaugeHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" strokeWidth="2.5" />
                </pattern>
              </defs>
              {/* Background Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeHatch)"
                strokeWidth="24"
                strokeLinecap="round"
              />
              {/* In Progress Arc (Sage Green) */}
              <path
                d="M 20 100 A 80 80 0 0 1 145 35"
                fill="none"
                stroke="#52b788"
                strokeWidth="24"
                strokeLinecap="round"
              />
              {/* Completed Arc (Dark Forest Green) */}
              <path
                d="M 20 100 A 80 80 0 0 1 85 24"
                fill="none"
                stroke="#0f4c3a"
                strokeWidth="24"
                strokeLinecap="round"
              />
            </svg>

            {/* Gauge Center Percentage & Label */}
            <div style={{
              position: 'absolute',
              bottom: '0px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--cms-text)', lineHeight: 1 }}>
                41%
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-muted)', fontWeight: 600, marginTop: '2px' }}>
                Project Ended
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '14px',
            fontSize: '0.74rem',
            color: 'var(--cms-text-muted)',
            marginTop: '16px'
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f4c3a' }} />
              Completed
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#52b788' }} />
              In Progress
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }} />
              Pending
            </span>
          </div>
        </div>

        {/* 3. Time Tracker Card (Dark Forest Green with Live Digital Clock) */}
        <div
          className="cms-donezo-card dark-green"
          style={{
            gridColumn: 'span 3',
            justifyContent: 'space-between',
            background: 'linear-gradient(145deg, #0f4c3a, #062b1f)',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Subtle wavy texture in background */}
          <svg
            viewBox="0 0 200 120"
            style={{
              position: 'absolute',
              right: '-10px',
              bottom: '-10px',
              width: '160px',
              opacity: 0.12,
              pointerEvents: 'none'
            }}
          >
            <path
              d="M 0,60 C 50,10 150,110 200,60 L 200,120 L 0,120 Z"
              fill="#ffffff"
            />
          </svg>

          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.85 }}>
              Time Tracker
            </span>
          </div>

          {/* Huge Live Running Digital Clock */}
          <div style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            fontFamily: 'var(--cms-font-mono, monospace)',
            textAlign: 'center',
            margin: '20px 0 10px',
            color: '#ffffff'
          }}>
            {formatTimer(trackerSeconds)}
          </div>

          {/* Controls: Pause / Play & Stop/Reset */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            position: 'relative',
            zIndex: 2
          }}>
            <button
              onClick={() => setTrackerRunning(!trackerRunning)}
              title={trackerRunning ? 'Pause time tracker' : 'Resume time tracker'}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ffffff',
                color: '#0f4c3a',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.05rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {trackerRunning ? '⏸' : '▶'}
            </button>

            <button
              onClick={() => {
                setTrackerSeconds(0);
                setTrackerRunning(false);
              }}
              title="Stop & Reset timer"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              ⏹
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
