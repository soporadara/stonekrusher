import React, { useState, useEffect } from 'react';

export default function CmsSecurityCenter({ csrfToken, currentUser }) {
  const [metrics, setMetrics] = useState({});
  const [activeTab, setActiveTab] = useState('logins'); // 'logins', 'blocks', 'sessions', 'audit'
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Blocks
  const [blocks, setBlocks] = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTarget, setBlockTarget] = useState('');
  const [blockReason, setBlockReason] = useState('Repeated suspicious requests');
  const [blockDuration, setBlockDuration] = useState('24');

  // Sessions
  const [sessions, setSessions] = useState([]);

  // Purge
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeStatus, setPurgeStatus] = useState('');

  const fetchSecurityMetrics = async () => {
    try {
      const res = await fetch('/api/cms.php?action=security_metrics');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics || {});
      }
    } catch (err) {}
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logType = activeTab === 'audit' ? 'audit' : 'logins';
      let url = `/api/cms.php?action=security_logs&log_type=${logType}&page=${page}&limit=15`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status_filter=${encodeURIComponent(statusFilter)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlocks = async () => {
    try {
      const res = await fetch('/api/cms.php?action=security_blocks_list');
      const data = await res.json();
      if (data.success) {
        setBlocks(data.blocks || []);
      }
    } catch (err) {}
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/cms.php?action=security_sessions_list');
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchSecurityMetrics();
  }, []);

  useEffect(() => {
    if (activeTab === 'logins' || activeTab === 'audit') {
      fetchLogs();
    } else if (activeTab === 'blocks') {
      fetchBlocks();
    } else if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, page, statusFilter]);

  const handleSaveBlock = async (e) => {
    e.preventDefault();
    if (!blockTarget.trim()) return;

    try {
      const res = await fetch('/api/cms.php?action=security_block_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          target: blockTarget.trim(),
          type: 'ip',
          reason: blockReason.trim(),
          duration_hours: parseInt(blockDuration, 10)
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowBlockModal(false);
        setBlockTarget('');
        fetchBlocks();
        fetchSecurityMetrics();
      } else {
        alert(data.error || 'Failed to block target');
      }
    } catch (err) {
      alert('Error creating security block');
    }
  };

  const handleUnblock = async (id, target) => {
    if (!confirm(`Unblock IP ${target}?`)) return;
    try {
      const res = await fetch('/api/cms.php?action=security_block_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchBlocks();
        fetchSecurityMetrics();
      }
    } catch (err) {
      alert('Error removing block');
    }
  };

  const handleRevokeSession = async (sessionId) => {
    if (!confirm('Revoke this active session? The user will be required to re-authenticate.')) return;
    try {
      const res = await fetch('/api/cms.php?action=security_revoke_session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if (data.success) {
        fetchSessions();
        fetchSecurityMetrics();
      }
    } catch (err) {
      alert('Error revoking session');
    }
  };

  const handlePurgeLogs = async () => {
    setPurgeStatus('Purging expired logs...');
    try {
      const res = await fetch('/api/cms.php?action=security_purge_logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });
      const data = await res.json();
      if (data.success) {
        setPurgeStatus(data.message);
        fetchSecurityMetrics();
        fetchLogs();
      } else {
        setPurgeStatus(data.error || 'Purge failed');
      }
    } catch (err) {
      setPurgeStatus('Error executing purge operation');
    }
  };

  return (
    <div>
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Security Center & Access Control</h1>
          <p>Failed-login protection, lockout policies, IP firewall blocks, and audit trails</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-danger" onClick={() => setShowBlockModal(true)}>
            <span>🚫</span> Block IP Address
          </button>
          {currentUser?.role === 'super_admin' && (
            <button className="cms-btn cms-btn-secondary" onClick={() => setShowPurgeModal(true)}>
              <span>🧹</span> Purge Expired Logs
            </button>
          )}
        </div>
      </div>

      {/* SECURITY STATS TILES */}
      <div className="cms-stats-grid">
        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Failed Attempts (24h)</div>
            <div className="cms-stat-value" style={{ color: metrics.failed_24h > 5 ? 'var(--cms-warning)' : 'var(--cms-text)' }}>
              {metrics.failed_24h ?? 0}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Threshold: 10 consecutive
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-red">⚠️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Successful Logins (24h)</div>
            <div className="cms-stat-value">{metrics.success_24h ?? 0}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Authenticated sessions
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-green">✅</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Active IP Blocks</div>
            <div className="cms-stat-value">{metrics.blocked_ips ?? 0}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Blocked by firewall rule
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-purple">🛡️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Active Lockouts</div>
            <div className="cms-stat-value" style={{ color: metrics.locked_users > 0 ? 'var(--cms-danger)' : 'var(--cms-success)' }}>
              {metrics.locked_users ?? 0}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Duration: 15 min lock
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-blue">🔒</div>
        </div>
      </div>

      {/* SECURITY TABS */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--cms-card-border)', marginBottom: '20px' }}>
        <button
          className={`cms-btn ${activeTab === 'logins' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
          onClick={() => { setActiveTab('logins'); setPage(1); }}
        >
          🔑 Login Activity ({metrics.total_attempts ?? 0})
        </button>
        <button
          className={`cms-btn ${activeTab === 'blocks' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
          onClick={() => { setActiveTab('blocks'); }}
        >
          🚫 Firewall IP Blocks ({metrics.blocked_ips ?? 0})
        </button>
        <button
          className={`cms-btn ${activeTab === 'sessions' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
          onClick={() => { setActiveTab('sessions'); }}
        >
          💻 Active Sessions ({metrics.active_sessions ?? 0})
        </button>
        <button
          className={`cms-btn ${activeTab === 'audit' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
          onClick={() => { setActiveTab('audit'); setPage(1); }}
        >
          📋 System Audit Log
        </button>
      </div>

      {/* TAB 1: LOGIN ACTIVITY */}
      {activeTab === 'logins' && (
        <div className="cms-table-wrapper">
          <div className="cms-table-toolbar">
            <div className="cms-table-search">
              <span className="cms-table-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by username, IP, or failure reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
              />
            </div>
            <div className="cms-table-filters">
              <select
                className="cms-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">Status: All Attempts</option>
                <option value="success">Success Only</option>
                <option value="failed">Failed Attempts</option>
              </select>
              <button className="cms-btn cms-btn-secondary" onClick={fetchLogs}>Filter</button>
            </div>
          </div>

          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Identifier</th>
                  <th>Outcome</th>
                  <th>IP Address</th>
                  <th>Reason / Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>Loading records...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>No login attempts match filters.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--cms-text-subtle)', fontFamily: 'var(--cms-font-mono)' }}>
                        {new Date(log.created_at * 1000).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {log.identifier}
                      </td>
                      <td>
                        <span className={`cms-badge ${log.success ? 'cms-badge-success' : 'cms-badge-danger'}`}>
                          {log.success ? '✓ Success' : '✕ Failed'}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.8rem' }}>{log.ip_address}</code>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--cms-text-muted)' }}>
                        {log.failure_reason || (log.success ? 'Valid credentials' : '—')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="cms-pagination">
            <div>Showing {logs.length} of {total} attempts</div>
            <div className="cms-page-controls">
              <button className="cms-btn cms-btn-secondary cms-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ padding: '0 8px', fontWeight: '600' }}>Page {page} of {totalPages}</span>
              <button className="cms-btn cms-btn-secondary cms-btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FIREWALL BLOCKS */}
      {activeTab === 'blocks' && (
        <div className="cms-table-wrapper">
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Target IP</th>
                  <th>Reason</th>
                  <th>Blocked By</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blocks.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No IP addresses are currently blocked.</td></tr>
                ) : (
                  blocks.map((blk) => {
                    const isExpired = blk.expires_at && blk.expires_at < Math.floor(Date.now() / 1000);
                    return (
                      <tr key={blk.id}>
                        <td>
                          <code style={{ fontSize: '0.84rem', fontWeight: '700' }}>{blk.target}</code>
                        </td>
                        <td style={{ color: 'var(--cms-text-muted)' }}>{blk.reason}</td>
                        <td style={{ fontSize: '0.82rem' }}>{blk.created_by}</td>
                        <td style={{ fontSize: '0.82rem', fontFamily: 'var(--cms-font-mono)' }}>
                          {blk.expires_at ? new Date(blk.expires_at * 1000).toLocaleString() : 'Permanent'}
                        </td>
                        <td>
                          <span className={`cms-badge ${isExpired ? 'cms-badge-muted' : 'cms-badge-danger'}`}>
                            {isExpired ? 'Expired' : 'Active Block'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="cms-btn cms-btn-secondary cms-btn-sm"
                            onClick={() => handleUnblock(blk.id, blk.target)}
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="cms-table-wrapper">
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Client / Browser</th>
                  <th>Last Active</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>No active sessions found.</td></tr>
                ) : (
                  sessions.map((sess, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{sess.username}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>{sess.role}</div>
                      </td>
                      <td>
                        <code>{sess.ip_address}</code>
                      </td>
                      <td style={{ fontSize: '0.76rem', color: 'var(--cms-text-muted)', maxWidth: '300px' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {sess.user_agent || 'Unknown'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'var(--cms-font-mono)' }}>
                        {new Date(sess.last_activity * 1000).toLocaleTimeString()}
                      </td>
                      <td>
                        {sess.is_current ? (
                          <span className="cms-badge cms-badge-success">This Session</span>
                        ) : (
                          <button
                            className="cms-btn cms-btn-danger cms-btn-sm"
                            onClick={() => handleRevokeSession(sess.raw_id)}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="cms-table-wrapper">
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>Loading audit records...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px' }}>No audit events found.</td></tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--cms-text-subtle)', fontFamily: 'var(--cms-font-mono)' }}>
                        {new Date(item.created_at * 1000).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {item.username || 'System'}
                      </td>
                      <td>
                        <span className="cms-badge cms-badge-muted">{item.action}</span>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {item.resource_type}: {item.resource_id}
                      </td>
                      <td>
                        <code>{item.ip_address}</code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="cms-pagination">
            <div>Showing {logs.length} of {total} audit records</div>
            <div className="cms-page-controls">
              <button className="cms-btn cms-btn-secondary cms-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ padding: '0 8px', fontWeight: '600' }}>Page {page} of {totalPages}</span>
              <button className="cms-btn cms-btn-secondary cms-btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK IP MODAL */}
      {showBlockModal && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal" style={{ maxWidth: '440px' }}>
            <div className="cms-modal-header">
              <h3>Manually Block IP Address</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowBlockModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveBlock}>
              <div className="cms-modal-body">
                <div className="cms-form-group">
                  <label>IP Address *</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={blockTarget}
                    onChange={(e) => setBlockTarget(e.target.value)}
                    required
                    placeholder="e.g. 198.51.100.42"
                  />
                </div>
                <div className="cms-form-group">
                  <label>Block Reason</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g. Automated login probe"
                  />
                </div>
                <div className="cms-form-group">
                  <label>Duration</label>
                  <select
                    className="cms-select"
                    style={{ width: '100%' }}
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                  >
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                    <option value="0">Permanent Rule</option>
                  </select>
                </div>
              </div>
              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowBlockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-danger">
                  Apply Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PURGE CONFIRMATION MODAL */}
      {showPurgeModal && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal" style={{ maxWidth: '460px' }}>
            <div className="cms-modal-header">
              <h3 style={{ color: 'var(--cms-warning)' }}>⚠️ Purge Security Logs</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowPurgeModal(false)}>✕</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: '0.88rem', lineHeight: 1.5, marginTop: 0 }}>
                This operation will prune login attempt history and general action logs older than the configured retention policy (90 days).
              </p>
              <p style={{ fontSize: '0.84rem', color: 'var(--cms-text-subtle)' }}>
                Notice: An immutable record of this purge itself will be preserved in the audit log for compliance.
              </p>
              {purgeStatus && (
                <div style={{ padding: '10px 12px', background: 'var(--cms-info-bg)', color: 'var(--cms-info)', borderRadius: 'var(--cms-radius-md)', fontSize: '0.82rem' }}>
                  {purgeStatus}
                </div>
              )}
            </div>
            <div className="cms-modal-footer">
              <button className="cms-btn cms-btn-secondary" onClick={() => setShowPurgeModal(false)}>
                Close
              </button>
              <button className="cms-btn cms-btn-danger" onClick={handlePurgeLogs}>
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
