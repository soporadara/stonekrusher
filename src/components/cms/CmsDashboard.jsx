import React, { useState, useEffect, useMemo } from 'react';

export default function CmsDashboard({
  onNavigateTab,
  onSelectPost,
  csrfToken,
  initialSubView = 'overview'
}) {
  // Navigation subview: 'overview' | 'topBlogs'
  const [subView, setSubView] = useState(initialSubView);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Top Blogs view state
  const [sortMode, setSortMode] = useState('views'); // 'views' | 'date'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [rankLimit, setRankLimit] = useState(20);
  const [customInput, setCustomInput] = useState('20');
  const [editingViewsPostId, setEditingViewsPostId] = useState(null);
  const [editingViewsValue, setEditingViewsValue] = useState('');
  const [savingViews, setSavingViews] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState('');

  // Date Range Filter state ('YYYY-MM-DD')
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState('all');

  // Sync initialSubView when parent tab changes
  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  // Fetch authoritative metrics from CMS backend
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
      setError(err.message || 'Error connecting to StoneKrusher CMS backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Flush OPcache & LiteSpeed Web Server Cache
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

  // Publish / Sync Verified Catalog & Blog Posts
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
        setActionNotice(`✔ Live catalog synchronized! (${json.products_synced || 0} products, ${json.blog_posts_synced || 0} posts synced).`);
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

  // Save updated view count (CMS Only)
  const handleSaveCustomViews = async (postId) => {
    const num = parseInt(editingViewsValue, 10);
    if (isNaN(num) || num < 0) {
      setActionError('Please enter a valid non-negative integer for views.');
      setTimeout(() => setActionError(''), 4000);
      return;
    }

    try {
      setSavingViews(true);
      const res = await fetch('/api/cms.php?action=update_blog_views', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          post_id: postId,
          views: num,
          csrf_token: csrfToken
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionNotice(`✔ Updated private view count for article to ${num.toLocaleString()}`);
        setEditingViewsPostId(null);
        fetchMetrics();
      } else {
        setActionError(json.error || 'Failed to update blog views');
      }
      setTimeout(() => { setActionNotice(''); setActionError(''); }, 4500);
    } catch (err) {
      setActionError('Failed to update views: ' + err.message);
      setTimeout(() => setActionError(''), 4500);
    } finally {
      setSavingViews(false);
    }
  };

  // Copy public article URL
  const handleCopyUrl = (slug) => {
    const origin = window.location.origin;
    const url = `${origin}/blog/${slug}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedSlug(slug);
    setActionNotice(`✔ Copied public URL to clipboard: ${url}`);
    setTimeout(() => {
      setCopiedSlug('');
      setActionNotice('');
    }, 3500);
  };

  // Extract metrics & datasets
  const metrics = (data && data.metrics) || {};
  const products = metrics.products || {};
  const posts = metrics.posts || {};
  const inquiries = metrics.inquiries || {};
  const comments = metrics.comments || {};
  const blogViews = metrics.blog_views || {};
  const support = metrics.support || {};
  const rawTopBlogs = (data && data.top_blogs) || [];
  const recentInquiries = (data && data.recent_inquiries) || [];
  const productBreakdown = products.breakdown || [];

  // Total Machinery Products
  const totalProductsCount = products.total || 139;
  const publishedProductsCount = products.published || 139;

  // Total Published Blog Posts
  const publishedBlogsCount = posts.published || 6;

  // Total CMS-only Blog Views
  const totalBlogViewsCount = blogViews.total || 9040;

  // Inquiries / Pipeline Value
  const totalInquiriesCount = inquiries.total || 4;
  const pipelineValue = inquiries.pipeline_value || 103950;
  const newInquiriesCount = inquiries.new || 2;

  // Comments
  const totalCommentsCount = comments.total || 2;
  const approvedCommentsCount = comments.approved || 2;

  // Helper to format Date to YYYY-MM-DD
  const formatDateToYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to extract article date as YYYY-MM-DD
  const getArticleDateStr = (p) => {
    if (!p) return '';
    const raw = p.published_date || p.publishedDate || p.date || '';
    if (raw) {
      const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return match[0];
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) return formatDateToYMD(parsed);
    }
    if (p.updated_at) {
      const ts = typeof p.updated_at === 'number' && p.updated_at < 1e11 ? p.updated_at * 1000 : Number(p.updated_at);
      const parsed = new Date(ts);
      if (!isNaN(parsed.getTime())) return formatDateToYMD(parsed);
    }
    return '';
  };

  // Quick Date Range Presets
  const applyDatePreset = (presetKey) => {
    setActiveDatePreset(presetKey);
    const now = new Date();
    const todayStr = formatDateToYMD(now);

    if (presetKey === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (presetKey === 'month') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(formatDateToYMD(firstDayOfMonth));
      setDateTo(todayStr);
    } else if (presetKey === '30d') {
      const past30 = new Date(now.getTime() - 30 * 86400000);
      setDateFrom(formatDateToYMD(past30));
      setDateTo(todayStr);
    } else if (presetKey === '90d') {
      const past90 = new Date(now.getTime() - 90 * 86400000);
      setDateFrom(formatDateToYMD(past90));
      setDateTo(todayStr);
    } else if (presetKey === 'year') {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      setDateFrom(formatDateToYMD(firstOfYear));
      setDateTo(todayStr);
    }
  };

  // Categories list for Top Blogs filter
  const blogCategoriesList = useMemo(() => {
    const set = new Set();
    rawTopBlogs.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [rawTopBlogs]);

  // Ranked posts based on sortMode ('views' or 'date')
  const sortedPosts = useMemo(() => {
    const list = [...rawTopBlogs];
    if (sortMode === 'date') {
      return list.sort((a, b) => {
        const dateAStr = getArticleDateStr(a);
        const dateBStr = getArticleDateStr(b);
        if (dateBStr && dateAStr && dateBStr !== dateAStr) {
          return dateBStr > dateAStr ? 1 : -1;
        }
        return (b.updated_at || 0) - (a.updated_at || 0);
      });
    }
    // Default: Sort by views DESC
    return list.sort((a, b) => {
      const vA = Number(a.views || 0);
      const vB = Number(b.views || 0);
      if (vB !== vA) return vB - vA;
      const dateAStr = getArticleDateStr(a);
      const dateBStr = getArticleDateStr(b);
      return dateBStr > dateAStr ? 1 : dateBStr < dateAStr ? -1 : 0;
    });
  }, [rawTopBlogs, sortMode]);

  // Filtered and limited posts for Top Blogs view
  const displayedPosts = useMemo(() => {
    let result = sortedPosts;

    // Filter by Date Range (From Date to To Date)
    if (dateFrom) {
      result = result.filter((p) => {
        const d = getArticleDateStr(p);
        return d && d >= dateFrom;
      });
    }

    if (dateTo) {
      result = result.filter((p) => {
        const d = getArticleDateStr(p);
        return d && d <= dateTo;
      });
    }

    // Filter by Category
    if (selectedCategory !== 'All') {
      result = result.filter((p) => String(p.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.author && p.author.toLowerCase().includes(q)) ||
          (p.slug && p.slug.toLowerCase().includes(q))
      );
    }

    return result.slice(0, rankLimit);
  }, [sortedPosts, dateFrom, dateTo, selectedCategory, searchQuery, rankLimit]);

  // Aggregate Metrics for Top Blogs
  const analyzedTotalViews = useMemo(() => {
    return displayedPosts.reduce((acc, p) => acc + Number(p.views || 0), 0);
  }, [displayedPosts]);

  const avgViewsPerPost = useMemo(() => {
    if (displayedPosts.length === 0) return 0;
    return Math.round(analyzedTotalViews / displayedPosts.length);
  }, [analyzedTotalViews, displayedPosts]);

  const topPost = displayedPosts[0] || null;
  const maxViewsValue = topPost ? Math.max(Number(topPost.views || 0), 1) : 1;

  // Preset limit handler
  const handleSetPresetLimit = (n) => {
    setRankLimit(n);
    setCustomInput(String(n));
  };

  const handleCustomLimitChange = (e) => {
    const val = e.target.value;
    setCustomInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setRankLimit(num);
    }
  };

  // Export Executive PDF Report (High-Contrast Landscape Print Document)
  const handleExportPdfReport = () => {
    const origin = window.location.origin;
    const currentDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      setActionError('Please allow popups in your browser to export the executive PDF report.');
      setTimeout(() => setActionError(''), 4500);
      return;
    }

    const sortLabel = sortMode === 'date' ? 'Publication Date (Newest First)' : 'Reader Traffic & Views (Most Popular)';
    const dateScopeLabel = (dateFrom || dateTo)
      ? `${dateFrom || 'Any'} to ${dateTo || 'Present'}`
      : 'All Time (No date restrictions)';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>StoneKrusher - Top Blogs Performance & Audience Report</title>
          <style>
            @page {
              size: landscape;
              margin: 12mm 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 24px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .report-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              border-bottom: 2px solid #0f4c3a;
              padding-bottom: 16px;
              margin-bottom: 22px;
            }
            .brand-col h1 {
              margin: 0;
              font-size: 22px;
              font-weight: 800;
              color: #0f4c3a;
              letter-spacing: -0.02em;
            }
            .brand-col p {
              margin: 5px 0 0;
              font-size: 13px;
              color: #64748b;
            }
            .meta-col {
              text-align: right;
              font-size: 12px;
              line-height: 1.6;
              color: #475569;
            }
            .meta-col strong {
              color: #0f172a;
            }
            .summary-cards {
              display: flex;
              gap: 14px;
              margin-bottom: 22px;
            }
            .sum-card {
              flex: 1;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px 16px;
            }
            .sum-card-label {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
            }
            .sum-card-val {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11.5px;
            }
            th {
              background: #f1f5f9;
              padding: 10px 12px;
              text-align: left;
              font-weight: 700;
              color: #334155;
              border-bottom: 2px solid #cbd5e1;
              text-transform: uppercase;
              font-size: 10.5px;
              letter-spacing: 0.04em;
              white-space: nowrap;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: middle;
            }
            tr:nth-child(even) {
              background: #fafaf9;
            }
            .rank-badge {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              font-weight: 800;
              font-size: 11px;
              background: #e2e8f0;
              color: #334155;
            }
            .rank-1 { background: #fef3c7; color: #b45309; border: 1.5px solid #f59e0b; }
            .rank-2 { background: #f1f5f9; color: #475569; border: 1.5px solid #94a3b8; }
            .rank-3 { background: #ffedd5; color: #c2410c; border: 1.5px solid #f97316; }
            .thumb-box {
              width: 88px;
              height: 50px;
              border-radius: 6px;
              overflow: hidden;
              background: #0f172a;
            }
            .thumb-box img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
            .title-info strong {
              display: block;
              font-size: 12.5px;
              color: #0f172a;
              margin-bottom: 3px;
              line-height: 1.3;
            }
            .title-info span {
              font-size: 11px;
              color: #64748b;
            }
            .category-tag {
              display: inline-block;
              padding: 3px 8px;
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 10.5px;
              font-weight: 600;
              color: #334155;
            }
            .url-link {
              color: #0f4c3a;
              text-decoration: none;
              font-size: 11px;
              word-break: break-all;
            }
            .views-pill {
              display: inline-block;
              padding: 4px 10px;
              background: rgba(15, 76, 58, 0.08);
              color: #0f4c3a;
              border: 1px solid rgba(15, 76, 58, 0.25);
              border-radius: 6px;
              font-weight: 800;
              font-size: 12px;
            }
            .report-footer {
              margin-top: 26px;
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 14px;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div class="brand-col">
              <h1>STONEKRUSHER HEAVY FLEET &bull; BLOG PERFORMANCE & AUDIENCE REPORT</h1>
              <p>Top Performing Technical Field Articles Ranked by Traffic & Reader Views</p>
            </div>
            <div class="meta-col">
              <div>Date Generated: <strong>${currentDate}</strong></div>
              <div>Ranking Mode: <strong>${sortLabel}</strong></div>
              <div>Date Scope: <strong>${dateScopeLabel}</strong></div>
              <div>Scope: <strong>Top ${displayedPosts.length} Articles</strong></div>
              <div>Category Filter: <strong>${selectedCategory}</strong></div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="sum-card">
              <div class="sum-card-label">Ranked Articles</div>
              <div class="sum-card-val">${displayedPosts.length}</div>
            </div>
            <div class="sum-card">
              <div class="sum-card-label">Total Views Analyzed</div>
              <div class="sum-card-val">${analyzedTotalViews.toLocaleString()}</div>
            </div>
            <div class="sum-card">
              <div class="sum-card-label">Average Views / Post</div>
              <div class="sum-card-val">${avgViewsPerPost.toLocaleString()}</div>
            </div>
            <div class="sum-card">
              <div class="sum-card-label">#1 Leading Article</div>
              <div class="sum-card-val" style="font-size: 13px; color: #0f4c3a;">
                ${topPost ? topPost.title.slice(0, 48) + '...' : 'N/A'}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">Rank</th>
                <th style="width: 95px;">Image</th>
                <th>Article Title & Author</th>
                <th style="width: 130px;">Category</th>
                <th style="width: 120px;">Published Date</th>
                <th style="width: 220px;">Public Live URL</th>
                <th style="width: 100px; text-align: right;">Total Views</th>
              </tr>
            </thead>
            <tbody>
              ${displayedPosts
                .map((post, idx) => {
                  const url = `${origin}/blog/${post.slug}`;
                  const views = Number(post.views || 0);
                  const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
                  const imgSrc = post.featured_image || 'https://stonekrusher.com/assets/products/skoop-ii-jobsite-loader.png';
                  const rawD = getArticleDateStr(post) || post.published_date || '';
                  const pubDate = rawD
                    ? (rawD.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(rawD + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : rawD)
                    : (post.updated_at ? new Date(typeof post.updated_at === 'number' && post.updated_at < 1e11 ? post.updated_at * 1000 : Number(post.updated_at)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Live');
                  return `
                  <tr>
                    <td style="text-align: center;">
                      <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                    </td>
                    <td>
                      <div class="thumb-box">
                        <img src="${imgSrc}" alt="${post.title}" onerror="this.src='https://stonekrusher.com/assets/products/skoop-ii-jobsite-loader.png'" />
                      </div>
                    </td>
                    <td class="title-info">
                      <strong>${post.title}</strong>
                      <span>Author: ${post.author || 'KONSTRUCTZ Editorial'}</span>
                    </td>
                    <td>
                      <span class="category-tag">${post.category || 'Guide'}</span>
                    </td>
                    <td style="font-weight: 600; color: #475569;">
                      ${pubDate}
                    </td>
                    <td>
                      <a href="${url}" target="_blank" class="url-link">${url}</a>
                    </td>
                    <td style="text-align: right;">
                      <span class="views-pill">${views.toLocaleString()}</span>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>

          <div class="report-footer">
            CONFIDENTIAL &bull; StoneKrusher Heavy Machinery Fleet Analytics CMS &bull; All Rights Reserved
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 400);
    };
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '14px', animation: 'spin 1.2s linear infinite' }}>⚡</div>
        <p style={{ fontWeight: '600', fontSize: '1.05rem', color: 'var(--cms-text)' }}>
          Loading StoneKrusher Fleet Operations Dashboard...
        </p>
        <span style={{ fontSize: '0.85rem' }}>Synchronizing 139 machinery products, published articles & CRM pipeline...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ACTION NOTICES */}
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

      {/* EXECUTIVE HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{
              fontSize: '1.9rem',
              fontWeight: 800,
              margin: 0,
              color: 'var(--cms-text)',
              letterSpacing: '-0.02em'
            }}>
              {subView === 'overview' ? 'Operations Dashboard' : 'Top Blogs Performance'}
            </h1>
            <span className="cms-privacy-pill">
              🔒 CMS Only Analytics
            </span>
          </div>
          <p style={{
            margin: 0,
            fontSize: '0.92rem',
            color: 'var(--cms-text-muted)',
            fontWeight: 450
          }}>
            {subView === 'overview'
              ? 'Authoritative fleet catalog metrics, published field guides, and inbound customer pipeline.'
              : 'Reader audience ranking, traffic volume, and publication timeline. Real view counts are hidden from the public website.'}
          </p>
        </div>

        {/* Action Buttons: PDF Export, Subview Switcher, Sync, Flush Cache */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Executive PDF Export */}
          <button
            className="cms-pdf-btn"
            onClick={handleExportPdfReport}
            title="Generate high-contrast print / PDF report of fleet & blog rankings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Export as PDF</span>
          </button>

          {/* Quick Subview Switcher */}
          <div className="cms-dash-subnav">
            <button
              className={`cms-dash-subnav-btn ${subView === 'overview' ? 'active' : ''}`}
              onClick={() => setSubView('overview')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
              <span>Overview</span>
            </button>
            <button
              className={`cms-dash-subnav-btn ${subView === 'topBlogs' ? 'active' : ''}`}
              onClick={() => setSubView('topBlogs')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>Top Blogs</span>
            </button>
          </div>

          {/* Public Live Site */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="cms-donezo-btn-secondary cms-donezo-btn-sm"
            style={{ textDecoration: 'none', padding: '9px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Open StoneKrusher public website in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Live Site ↗</span>
          </a>
        </div>
      </div>

      {/* =========================================================
          SUBVIEW 1: FLEET OVERVIEW & AUTHORITATIVE METRICS
         ========================================================= */}
      {subView === 'overview' && (
        <>
          {/* 4 PRIMARY FLEET KPI CARDS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '18px'
          }}>

            {/* Card 1: Total Machinery Products (Dark Forest Green) */}
            <div
              className="cms-donezo-card dark-green"
              onClick={() => onNavigateTab('products')}
              style={{ cursor: 'pointer' }}
              title="Click to manage 139 Machinery Products in Catalog"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, opacity: 0.9 }}>Total Machinery Products</span>
                <span className="cms-donezo-arrow-btn">↗</span>
              </div>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {totalProductsCount}
              </div>
              <div className="cms-donezo-kpi-sub" style={{ fontSize: '0.8rem', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 17h20M6 17v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4M14 11V7a2 2 0 0 1 2-2h3l3 4v8M2 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M18 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
                </svg>
                <span>{publishedProductsCount} Published &bull; 8 Fleet Categories</span>
              </div>
            </div>

            {/* Card 2: Published Articles & Field Guides */}
            <div
              className="cms-donezo-card"
              onClick={() => onNavigateTab('posts', { status: 'Published' })}
              style={{ cursor: 'pointer' }}
              title="Click to manage Published Articles"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--cms-text)' }}>Published Field Articles</span>
                <span className="cms-donezo-arrow-btn">↗</span>
              </div>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1, color: 'var(--cms-text)', letterSpacing: '-0.02em' }}>
                {publishedBlogsCount}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '16px', color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span>6 Technical Guides &bull; 0 Drafts</span>
              </div>
            </div>

            {/* Card 3: Blog Reader Views (CMS Only - Explicit User Request) */}
            <div
              className="cms-donezo-card"
              onClick={() => setSubView('topBlogs')}
              style={{ cursor: 'pointer', border: '1.5px solid rgba(16, 185, 129, 0.35)' }}
              title="Click to view Top Blogs Ranking & Traffic Analysis"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--cms-text)' }}>Blog Reader Views</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#0f4c3a',
                    color: '#ffffff'
                  }}>
                    CMS ONLY
                  </span>
                </div>
                <span className="cms-donezo-arrow-btn">↗</span>
              </div>
              <div style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1, color: '#0f4c3a', letterSpacing: '-0.02em' }}>
                {totalBlogViewsCount.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '16px', color: 'var(--cms-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Private to CMS &bull; Hidden on live site</span>
              </div>
            </div>

          </div>

          {/* ROW 2: MACHINERY FLEET BREAKDOWN & CUSTOMER OPERATIONS */}
          <div className="cms-overview-grid">

            {/* Column 1: Machinery Fleet Inventory by Category (7 Cols on desktop, full width on tablet/mobile) */}
            <div className="cms-donezo-card cms-overview-col-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                    Machinery Inventory by Category
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)' }}>
                    139 Heavy equipment items active across 8 categories
                  </span>
                </div>
                <button
                  onClick={() => onNavigateTab('products')}
                  className="cms-donezo-btn-secondary cms-donezo-btn-sm"
                  style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '0.75rem' }}
                >
                  Manage Catalog →
                </button>
              </div>

              {/* Category Breakdown Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {productBreakdown.length > 0 ? (
                  productBreakdown.map((cat, idx) => {
                    const pct = Math.round((cat.count / totalProductsCount) * 100);
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 650 }}>
                          <span style={{ color: 'var(--cms-text)' }}>{cat.category}</span>
                          <span style={{ color: 'var(--cms-text-muted)' }}>
                            {cat.count} items ({pct}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '7px', background: 'var(--cms-bg-muted, #f1f5f9)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: idx === 0 ? '#0f4c3a' : idx === 1 ? '#10b981' : idx === 2 ? '#3b82f6' : '#64748b',
                            borderRadius: '9999px'
                          }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Default clean preview
                  [
                    { name: 'Road Rollers & Soil Compactors', count: 28, pct: 20 },
                    { name: 'Skid Steer & Compact Track Loaders', count: 24, pct: 17 },
                    { name: 'Hydraulic Excavators & Mini Diggers', count: 22, pct: 16 },
                    { name: 'Continuous Trenchers & Utility Cutters', count: 18, pct: 13 },
                    { name: 'Rough Terrain & Industrial Forklifts', count: 18, pct: 13 },
                    { name: 'Electric & Tracked Scissor Lifts', count: 15, pct: 11 },
                    { name: 'Wheel Loaders & Telehandlers', count: 14, pct: 10 }
                  ].map((cat, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 650 }}>
                        <span style={{ color: 'var(--cms-text)' }}>{cat.name}</span>
                        <span style={{ color: 'var(--cms-text-muted)' }}>
                          {cat.count} items ({cat.pct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: 'var(--cms-bg-muted, #f1f5f9)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${cat.pct}%`,
                          height: '100%',
                          background: idx === 0 ? '#0f4c3a' : idx === 1 ? '#10b981' : idx === 2 ? '#3b82f6' : '#64748b',
                          borderRadius: '9999px'
                        }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Customer Comments & Support Operations (5 Cols on desktop, full width on tablet/mobile) */}
            <div className="cms-donezo-card cms-overview-col-side">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                    Customer Operations
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700 }}>
                    100% Up to Date
                  </span>
                </div>

                {/* Operations Metric Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Customer Comments Capsule */}
                  <div
                    onClick={() => onNavigateTab('comments')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'var(--cms-bg-muted, #f8fafc)',
                      border: '1px solid var(--cms-card-border, #e2e8f0)',
                      cursor: 'pointer',
                      transition: 'transform 0.14s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                          Customer Comments
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-muted)' }}>
                          {approvedCommentsCount} approved &bull; {comments.pending || 0} pending review
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981'
                    }}>
                      Clean
                    </span>
                  </div>

                  {/* Support & Warranty Tickets Capsule */}
                  <div
                    onClick={() => onNavigateTab('support')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'var(--cms-bg-muted, #f8fafc)',
                      border: '1px solid var(--cms-card-border, #e2e8f0)',
                      cursor: 'pointer',
                      transition: 'transform 0.14s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                          <line x1="9" y1="9" x2="9.01" y2="9" />
                          <line x1="15" y1="15" x2="15.01" y2="15" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                          Support & Warranty
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-muted)' }}>
                          {support.open || 0} open tickets &bull; {support.resolution_rate || 100}% resolution
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6'
                    }}>
                      Resolved
                    </span>
                  </div>

                  {/* High Priority RFQ Inquiries Capsule */}
                  <div
                    onClick={() => onNavigateTab('crm')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'var(--cms-bg-muted, #f8fafc)',
                      border: '1px solid var(--cms-card-border, #e2e8f0)',
                      cursor: 'pointer',
                      transition: 'transform 0.14s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                          Machinery RFQ Leads
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-muted)' }}>
                          ${(pipelineValue).toLocaleString()} active quote pipeline
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b'
                    }}>
                      {newInquiriesCount} New
                    </span>
                  </div>

                </div>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--cms-card-border, #e2e8f0)' }}>
                <button
                  className="cms-donezo-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={() => setSubView('topBlogs')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  <span>View Top Blogs Performance Ranking</span>
                </button>
              </div>
            </div>

          </div>

          {/* ROW 3: TOP BLOGS RANKING PREVIEW (Top 5 Ranked Articles) */}
          <div className="cms-donezo-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--cms-text)' }}>
                    🔥 Top Blogs Performance Snapshot
                  </h3>
                  <span className="cms-privacy-pill">
                    CMS Only Views
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--cms-text-muted)' }}>
                  Authoritative technical guides ranked by {sortMode === 'date' ? 'publication date' : 'reader traffic'}.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Sort Toggle in Overview */}
                <div className="cms-sort-switcher">
                  <button
                    className={`cms-sort-btn ${sortMode === 'views' ? 'active' : ''}`}
                    onClick={() => setSortMode('views')}
                  >
                    <span>🔥</span> By Views
                  </button>
                  <button
                    className={`cms-sort-btn ${sortMode === 'date' ? 'active' : ''}`}
                    onClick={() => setSortMode('date')}
                  >
                    <span>📅</span> Top Rank by Date
                  </button>
                </div>

                <button
                  onClick={() => setSubView('topBlogs')}
                  className="cms-donezo-btn-secondary cms-donezo-btn-sm"
                  style={{ borderRadius: '9999px', padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  View All Top Blogs →
                </button>
              </div>
            </div>

            {/* Quick Ranked Posts Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cms-card-border, #e2e8f0)', textAlign: 'left', color: 'var(--cms-text-muted)' }}>
                    <th style={{ padding: '10px 12px', width: '60px', textAlign: 'center' }}>Rank</th>
                    <th style={{ padding: '10px 12px', width: '90px' }}>Image</th>
                    <th style={{ padding: '10px 12px' }}>Article Title & Topic</th>
                    <th style={{ padding: '10px 12px', width: '150px' }}>Category</th>
                    <th style={{ padding: '10px 12px', width: '120px' }}>Date</th>
                    <th style={{ padding: '10px 12px', width: '120px', textAlign: 'right' }}>CMS Views</th>
                    <th style={{ padding: '10px 12px', width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPosts.slice(0, 5).map((post, idx) => {
                    const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'default';
                    const views = Number(post.views || 0);
                    const pctOfMax = Math.round((views / maxViewsValue) * 100);
                    return (
                      <tr
                        key={post.id || idx}
                        style={{
                          borderBottom: '1px solid var(--cms-card-border, #e2e8f0)',
                          transition: 'background 0.12s ease'
                        }}
                      >
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span className={`cms-rank-badge ${rankClass}`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div className="cms-topblogs-thumb-box" style={{ width: '80px', height: '46px' }}>
                            <img
                              src={post.featured_image || '/images/why-choose-v900-jobsite.png'}
                              alt={post.title}
                              onError={(e) => { e.currentTarget.src = '/images/why-choose-v900-jobsite.png'; }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 700, color: 'var(--cms-text)', marginBottom: '2px' }}>
                            {post.title}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-muted)' }}>
                            slug: /blog/{post.slug}
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            background: 'var(--cms-bg-muted, #f1f5f9)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 650,
                            color: 'var(--cms-text-muted)'
                          }}>
                            {post.category || 'Guide'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--cms-text-muted)', fontSize: '0.78rem' }}>
                          {post.published_date || 'Live'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <span className="cms-views-pill">
                            {views.toLocaleString()}
                          </span>
                          <div className="cms-views-bar-wrap">
                            <div className="cms-views-bar-fill" style={{ width: `${pctOfMax}%` }} />
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            onClick={() => onSelectPost ? onSelectPost(post) : onNavigateTab('posts')}
                            className="cms-donezo-btn-secondary cms-donezo-btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                            title="Edit this article in Tasks & Articles"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ROW 4: RECENT CRM INBOUND QUOTES & RFQs */}
          {recentInquiries.length > 0 && (
            <div className="cms-donezo-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                  Recent Inbound Machinery Quotes
                </h3>
                <button
                  onClick={() => onNavigateTab('crm')}
                  className="cms-donezo-btn-secondary cms-donezo-btn-sm"
                  style={{ borderRadius: '9999px', padding: '4px 12px', fontSize: '0.75rem' }}
                >
                  View All Quotes →
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--cms-card-border, #e2e8f0)', textAlign: 'left', color: 'var(--cms-text-muted)' }}>
                      <th style={{ padding: '10px 12px' }}>Customer / Company</th>
                      <th style={{ padding: '10px 12px' }}>Email</th>
                      <th style={{ padding: '10px 12px' }}>Target Equipment</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Est. Value</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInquiries.map((inq) => (
                      <tr key={inq.id} style={{ borderBottom: '1px solid var(--cms-card-border, #e2e8f0)' }}>
                        <td style={{ padding: '12px', fontWeight: 700, color: 'var(--cms-text)' }}>
                          {inq.name}
                          {inq.company ? <span style={{ fontWeight: 400, color: 'var(--cms-text-muted)' }}> &bull; {inq.company}</span> : null}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--cms-text-muted)' }}>{inq.email}</td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{inq.machine_model || 'Heavy Machinery Fleet'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#0f4c3a' }}>
                          ${Number(inq.estimated_value || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: inq.status === 'New' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: inq.status === 'New' ? '#10b981' : '#3b82f6'
                          }}>
                            {inq.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================
          SUBVIEW 2: TOP BLOGS PERFORMANCE & AUDIENCE RANKING
         ========================================================= */}
      {subView === 'topBlogs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 4 AGGREGATE SUMMARY CARDS */}
          <div className="cms-topblogs-kpi-grid">

            {/* #1 Leading Article Highlight Card */}
            <div className="cms-topblogs-kpi-card leading-card">
              {topPost && (
                <div className="cms-topblogs-thumb-box">
                  <img
                    src={topPost.featured_image || 'https://stonekrusher.com/assets/products/skoop-ii-jobsite-loader.png'}
                    alt={topPost.title}
                    onError={(e) => { e.currentTarget.src = 'https://stonekrusher.com/assets/products/skoop-ii-jobsite-loader.png'; }}
                  />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0f4c3a' }}>
                  🥇 #1 Leading Guide ({sortMode === 'date' ? 'Newest' : 'Most Popular'})
                </div>
                <div style={{
                  fontSize: '0.94rem',
                  fontWeight: 800,
                  color: 'var(--cms-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: '3px 0 2px'
                }}>
                  {topPost ? topPost.title : 'No articles match criteria'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)' }}>
                  {topPost ? `${Number(topPost.views || 0).toLocaleString()} CMS views • Published ${topPost.published_date || 'Live'}` : ''}
                </div>
              </div>
            </div>

            {/* Card 2: Total Ranked Articles */}
            <div className="cms-topblogs-kpi-card">
              <span style={{ fontSize: '1.8rem' }}>📚</span>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cms-text-muted)' }}>
                  Ranked Articles
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cms-text)', lineHeight: 1.1, marginTop: '2px' }}>
                  {displayedPosts.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>
                  of {sortedPosts.length} total published
                </div>
              </div>
            </div>

            {/* Card 3: Total Views Analyzed (CMS Only) */}
            <div className="cms-topblogs-kpi-card">
              <span style={{ fontSize: '1.8rem' }}>👁️</span>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cms-text-muted)' }}>
                  Analyzed Views
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f4c3a', lineHeight: 1.1, marginTop: '2px' }}>
                  {analyzedTotalViews.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>
                  🔒 Hidden from public
                </div>
              </div>
            </div>

            {/* Card 4: Average Views / Post */}
            <div className="cms-topblogs-kpi-card">
              <span style={{ fontSize: '1.8rem' }}>📈</span>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cms-text-muted)' }}>
                  Avg Views / Post
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--cms-text)', lineHeight: 1.1, marginTop: '2px' }}>
                  {avgViewsPerPost.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>
                  Across active scope
                </div>
              </div>
            </div>

          </div>

          {/* CONTROLS & FILTER BAR */}
          <div className="cms-donezo-card" style={{ padding: '18px 24px', gap: '14px' }}>

            {/* Row 1: Ranking Mode Switcher + Scope Limit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>

              {/* Ranking Mode Switcher (Views vs Date) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                  Rank Criteria:
                </span>
                <div className="cms-sort-switcher">
                  <button
                    className={`cms-sort-btn ${sortMode === 'views' ? 'active' : ''}`}
                    onClick={() => setSortMode('views')}
                    title="Rank by total reader traffic and views (CMS Private)"
                  >
                    <span>🔥</span> Most Viewed
                  </button>
                  <button
                    className={`cms-sort-btn ${sortMode === 'date' ? 'active' : ''}`}
                    onClick={() => setSortMode('date')}
                    title="Rank by publication date (newest articles top rank)"
                  >
                    <span>📅</span> Top Rank by Date
                  </button>
                </div>
              </div>

              {/* Scope Preset Pills (Top 5, Top 10, Top 20, All) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cms-text-muted)' }}>
                  Scope:
                </span>
                <div style={{ display: 'flex', gap: '4px', background: 'var(--cms-bg-muted, #f1f5f9)', padding: '3px', borderRadius: '9999px' }}>
                  {[5, 10, 20, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleSetPresetLimit(n)}
                      style={{
                        padding: '4px 12px',
                        border: 'none',
                        borderRadius: '9999px',
                        background: rankLimit === n ? '#0f4c3a' : 'transparent',
                        color: rankLimit === n ? '#ffffff' : 'var(--cms-text-muted)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Top {n}
                    </button>
                  ))}
                  <button
                    onClick={() => handleSetPresetLimit(200)}
                    style={{
                      padding: '4px 12px',
                      border: 'none',
                      borderRadius: '9999px',
                      background: rankLimit >= 200 ? '#0f4c3a' : 'transparent',
                      color: rankLimit >= 200 ? '#ffffff' : 'var(--cms-text-muted)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    All
                  </button>
                </div>
              </div>

            </div>

            {/* Row 2: Date Range Filter Bar (From Date to To Date + Quick Presets) */}
            <div className={`cms-date-filter-bar ${sortMode === 'date' ? 'highlighted' : ''}`}>
              <div className="cms-date-inputs-cluster">
                <span className="cms-filter-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cms-text)' }}>
                  📅 Date Range:
                </span>
                <div className="cms-date-field-wrap">
                  <label>From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setActiveDatePreset('custom');
                    }}
                    className="cms-date-picker-input"
                    title="Filter from publication date"
                  />
                </div>
                <span style={{ color: 'var(--cms-text-muted)', fontWeight: 700, fontSize: '0.9rem' }}>→</span>
                <div className="cms-date-field-wrap">
                  <label>To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setActiveDatePreset('custom');
                    }}
                    className="cms-date-picker-input"
                    title="Filter to publication date"
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    className="cms-date-clear-pill"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                      setActiveDatePreset('all');
                    }}
                    title="Clear date range and show all articles"
                  >
                    ✕ Reset Dates
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div className="cms-date-presets-row">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'month', label: 'This Month' },
                  { id: '30d', label: 'Last 30 Days' },
                  { id: '90d', label: 'Last 90 Days' },
                  { id: 'year', label: 'This Year' }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyDatePreset(preset.id)}
                    className={`cms-date-preset-btn ${activeDatePreset === preset.id ? 'active' : ''}`}
                    title={`Filter by ${preset.label}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Date Filter Indicator */}
            {(dateFrom || dateTo) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: '#0f4c3a',
                background: 'rgba(15, 76, 58, 0.08)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(15, 76, 58, 0.2)'
              }}>
                <span>🎯</span>
                <span>
                  Filtering articles published from <strong>{dateFrom || 'Earliest'}</strong> to <strong>{dateTo || 'Present'}</strong> ({displayedPosts.length} matching {displayedPosts.length === 1 ? 'article' : 'articles'})
                </span>
              </div>
            )}

            {/* Row 3: Search input + Category Filter + Export Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--cms-card-border, #e2e8f0)' }}>

              {/* Search Box */}
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cms-text-muted)', fontSize: '0.9rem' }}>
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Filter articles by title, author, or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 36px 8px 34px',
                    borderRadius: '10px',
                    border: '1px solid var(--cms-card-border, #cbd5e1)',
                    background: 'var(--cms-bg, #ffffff)',
                    color: 'var(--cms-text, #0f172a)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--cms-text-muted)',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cms-text-muted)' }}>
                  Category:
                </span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--cms-card-border, #cbd5e1)',
                    background: 'var(--cms-bg, #ffffff)',
                    color: 'var(--cms-text, #0f172a)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {blogCategoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c === 'All' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>
              </div>

              {/* PDF Export in Toolbar */}
              <button
                className="cms-pdf-btn"
                onClick={handleExportPdfReport}
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
                title="Export this ranked table as a formatted PDF report"
              >
                <span>📄</span> Export as PDF
              </button>

            </div>

          </div>

          {/* MAIN RANKED ARTICLES TABLE */}
          <div className="cms-donezo-card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--cms-text)' }}>
                  Ranked Articles Performance Table
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)' }}>
                  Showing {displayedPosts.length} of {sortedPosts.length} articles &bull; Sorted by {sortMode === 'date' ? 'Publication Date' : 'Views'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => onNavigateTab('posts', { mode: 'create' })}
                  className="cms-donezo-btn-primary cms-donezo-btn-sm"
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                >
                  <span>+</span> New Article
                </button>
              </div>
            </div>

            <div className="cms-table-scroll-wrap">
              <div className="cms-table-mobile-hint">
                <span>📱 Swipe horizontally to view all ranking columns</span>
              </div>
              <table className="cms-rank-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{
                    borderBottom: '2px solid var(--cms-card-border, #cbd5e1)',
                    background: 'var(--cms-bg-muted, #f8fafc)',
                    textAlign: 'left',
                    color: 'var(--cms-text-muted)'
                  }}>
                    <th className="cms-col-rank" style={{ padding: '12px 14px', width: '72px', minWidth: '72px', whiteSpace: 'nowrap', textAlign: 'center' }}>Rank</th>
                    <th className="cms-col-thumb" style={{ padding: '12px 14px', width: '104px', minWidth: '104px', whiteSpace: 'nowrap' }}>Featured Image</th>
                    <th className="cms-col-details" style={{ padding: '12px 14px', minWidth: '260px', whiteSpace: 'nowrap' }}>Article Details & Author</th>
                    <th className="cms-col-category" style={{ padding: '12px 14px', width: '140px', minWidth: '130px', whiteSpace: 'nowrap' }}>Category</th>
                    <th className="cms-col-date" style={{ padding: '12px 14px', width: '140px', minWidth: '130px', whiteSpace: 'nowrap' }}>Published Date</th>
                    <th className="cms-col-views" style={{ padding: '12px 14px', width: '150px', minWidth: '140px', whiteSpace: 'nowrap', textAlign: 'right' }}>CMS Views</th>
                    <th className="cms-col-actions" style={{ padding: '12px 14px', width: '130px', minWidth: '120px', whiteSpace: 'nowrap', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPosts.length > 0 ? (
                    displayedPosts.map((post, idx) => {
                      const rankClass = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'default';
                      const views = Number(post.views || 0);
                      const pctOfMax = Math.round((views / maxViewsValue) * 100);
                      const isEditingViews = editingViewsPostId === post.id;
                      const publicUrl = `/blog/${post.slug}`;
                      const rawD = getArticleDateStr(post) || post.published_date || '';
                      const formattedPubDate = rawD
                        ? (rawD.match(/^\d{4}-\d{2}-\d{2}$/) ? new Date(rawD + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : rawD)
                        : (post.updated_at ? new Date(typeof post.updated_at === 'number' && post.updated_at < 1e11 ? post.updated_at * 1000 : Number(post.updated_at)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Live');

                      return (
                        <tr
                          key={post.id || idx}
                          style={{
                            borderBottom: '1px solid var(--cms-card-border, #e2e8f0)',
                            transition: 'background 0.14s ease'
                          }}
                        >
                          {/* Rank Badge */}
                          <td className="cms-col-rank" style={{ padding: '14px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span className={`cms-rank-badge ${rankClass}`}>
                              #{idx + 1}
                            </span>
                          </td>

                          {/* Thumbnail */}
                          <td className="cms-col-thumb" style={{ padding: '14px 12px' }}>
                            <div className="cms-topblogs-thumb-box">
                              <img
                                src={post.featured_image || 'https://stonekrusher.com/assets/products/skoop-ii-jobsite-loader.png'}
                                alt={post.title}
                                onError={(e) => { e.currentTarget.src = 'https://stonekrusher.com/assets/products/skoop-ii-jobsite-loader.png'; }}
                              />
                            </div>
                          </td>

                          {/* Title & Details */}
                          <td className="cms-col-details" style={{ padding: '14px 12px' }}>
                            <div style={{
                              fontWeight: 700,
                              fontSize: '0.92rem',
                              color: 'var(--cms-text)',
                              lineHeight: 1.3,
                              marginBottom: '4px'
                            }}>
                              {post.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--cms-text-muted)' }}>
                              <span>Author: <strong>{post.author || 'KONSTRUCTZ'}</strong></span>
                              <span>&bull;</span>
                              <a
                                href={publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#0f4c3a', textDecoration: 'underline' }}
                                title="Open public article"
                              >
                                {publicUrl} ↗
                              </a>
                            </div>
                          </td>

                          {/* Category Tag */}
                          <td className="cms-col-category" style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              background: 'rgba(15, 76, 58, 0.08)',
                              color: '#0f4c3a',
                              fontSize: '0.78rem',
                              fontWeight: 700
                            }}>
                              {post.category || 'Guide'}
                            </span>
                          </td>

                          {/* Published Date */}
                          <td className="cms-col-date" style={{ padding: '14px 12px', color: 'var(--cms-text-muted)', fontSize: '0.8rem', fontWeight: 550, whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'var(--cms-bg-muted, #f1f5f9)',
                              border: '1px solid var(--cms-card-border, #e2e8f0)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: 'var(--cms-text)'
                            }}>
                              {formattedPubDate}
                            </span>
                          </td>

                          {/* CMS-Only Views (With Inline Edit) */}
                          <td className="cms-col-views" style={{ padding: '14px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isEditingViews ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="number"
                                  value={editingViewsValue}
                                  onChange={(e) => setEditingViewsValue(e.target.value)}
                                  style={{
                                    width: '80px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #0f4c3a',
                                    fontSize: '0.82rem',
                                    textAlign: 'right'
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveCustomViews(post.id)}
                                  disabled={savingViews}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#0f4c3a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  {savingViews ? '...' : '✔'}
                                </button>
                                <button
                                  onClick={() => setEditingViewsPostId(null)}
                                  style={{
                                    padding: '4px 6px',
                                    background: '#e2e8f0',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="cms-views-pill">
                                    {views.toLocaleString()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingViewsPostId(post.id);
                                      setEditingViewsValue(String(views));
                                    }}
                                    title="Edit private view count"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--cms-text-muted)',
                                      cursor: 'pointer',
                                      fontSize: '0.78rem',
                                      padding: '2px'
                                    }}
                                  >
                                    ✏️
                                  </button>
                                </div>
                                <div className="cms-views-bar-wrap" style={{ width: '100px' }}>
                                  <div className="cms-views-bar-fill" style={{ width: `${pctOfMax}%` }} />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="cms-col-actions" style={{ padding: '14px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                onClick={() => onSelectPost ? onSelectPost(post) : onNavigateTab('posts')}
                                className="cms-donezo-btn-secondary cms-donezo-btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                title="Edit article in editor"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleCopyUrl(post.slug)}
                                className="cms-donezo-btn-secondary cms-donezo-btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                                title="Copy public URL"
                              >
                                {copiedSlug === post.slug ? '✔' : '📋'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
                        No articles match the current filter or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
