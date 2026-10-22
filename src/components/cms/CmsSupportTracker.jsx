import React, { useState, useEffect } from 'react';

export default function CmsSupportTracker({ csrfToken }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [notice, setNotice] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    equipment_model: 'Stone Krusher Jaw Crusher 180',
    serial_number: '',
    subject: '',
    priority: 'Medium',
    status: 'Open',
    category: 'Technical',
    description: '',
    resolution_notes: ''
  });

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const url = `/api/cms.php?action=support_tickets_list&status=${filterStatus}&priority=${filterPriority}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setTickets(json.tickets || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterPriority]);

  const handleStatusChange = async (ticket, newStatus) => {
    try {
      const res = await fetch('/api/cms.php?action=support_ticket_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ticket,
          status: newStatus,
          csrf_token: csrfToken
        })
      });
      const json = await res.json();
      if (json.success) {
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));
        setNotice(`Ticket ${ticket.ticket_number} status updated to ${newStatus}`);
        setTimeout(() => setNotice(''), 3000);
      }
    } catch {
      // non-fatal
    }
  };

  const handleSaveTicket = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/cms.php?action=support_ticket_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          csrf_token: csrfToken
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowNewModal(false);
        setFormData({
          customer_name: '',
          customer_email: '',
          equipment_model: 'Stone Krusher Jaw Crusher 180',
          serial_number: '',
          subject: '',
          priority: 'Medium',
          status: 'Open',
          category: 'Technical',
          description: '',
          resolution_notes: ''
        });
        fetchTickets();
        setNotice('Support ticket created successfully!');
        setTimeout(() => setNotice(''), 3500);
      }
    } catch {
      // non-fatal
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this support ticket?')) return;
    try {
      const res = await fetch('/api/cms.php?action=support_ticket_delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, csrf_token: csrfToken })
      });
      const json = await res.json();
      if (json.success) {
        setTickets(prev => prev.filter(t => t.id !== id));
        setSelectedTicket(null);
      }
    } catch {
      // non-fatal
    }
  };

  const openCount = tickets.filter(t => t.status === 'Open').length;
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'Resolved').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Support & Warranty Tracker</h1>
          <p>Manage machinery maintenance issues, warranty tickets, and operator inquiries</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-primary" onClick={() => setShowNewModal(true)}>
            <span>🎫</span> Open Support Ticket
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '10px 16px', background: 'rgba(96, 122, 78, 0.2)', border: '1px solid var(--cms-primary)', color: 'var(--cms-primary)', borderRadius: '10px', fontWeight: '600', fontSize: '0.88rem' }}>
          {notice}
        </div>
      )}

      {/* KPI METRICS */}
      <div className="cms-stats-grid">
        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Total Logged</div>
            <div className="cms-stat-value">{tickets.length}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Service & warranty requests
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-blue">🎫</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Open / Action Needed</div>
            <div className="cms-stat-value" style={{ color: openCount > 0 ? '#ef4444' : 'inherit' }}>
              {openCount}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Awaiting technician reply
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-amber">⚠️</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">In Progress</div>
            <div className="cms-stat-value">{inProgressCount}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Parts shipped or under inspection
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-purple">🔧</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Resolved Rate</div>
            <div className="cms-stat-value" style={{ color: '#10b981' }}>
              {tickets.length > 0 ? Math.round((resolvedCount / tickets.length) * 100) : 85}%
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {resolvedCount} resolved tickets
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-green">✅</div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="cms-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'Open', 'In Progress', 'Resolved'].map(st => (
            <button
              key={st}
              className={`cms-btn ${filterStatus === st ? 'cms-btn-primary' : 'cms-btn-secondary'} cms-btn-sm`}
              onClick={() => setFilterStatus(st)}
            >
              {st === 'all' ? 'All Tickets' : st}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--cms-text-subtle)' }}>Priority:</span>
          {['all', 'Urgent', 'High', 'Medium', 'Low'].map(pr => (
            <button
              key={pr}
              className={`cms-btn ${filterPriority === pr ? 'cms-btn-primary' : 'cms-btn-secondary'} cms-btn-sm`}
              onClick={() => setFilterPriority(pr)}
            >
              {pr === 'all' ? 'All' : pr}
            </button>
          ))}
        </div>
      </div>

      {/* TICKETS TABLE */}
      <div className="cms-card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛠️</div>
            <p>No support tickets found matching current filters.</p>
          </div>
        ) : (
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Customer</th>
                  <th>Equipment / Serial</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((tkt) => (
                  <tr key={tkt.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--cms-font-mono)', fontWeight: '700', color: 'var(--cms-primary)' }}>
                        {tkt.ticket_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--cms-text)' }}>{tkt.customer_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>{tkt.customer_email}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{tkt.equipment_model || 'N/A'}</div>
                      {tkt.serial_number && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--cms-text-subtle)' }}>SN: {tkt.serial_number}</div>
                      )}
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: '500' }}>
                        {tkt.subject}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        background: tkt.priority === 'High' || tkt.priority === 'Urgent' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: tkt.priority === 'High' || tkt.priority === 'Urgent' ? '#ef4444' : '#d97706'
                      }}>
                        {tkt.priority}
                      </span>
                    </td>
                    <td>
                      <select
                        value={tkt.status}
                        onChange={(e) => handleStatusChange(tkt, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--cms-border)',
                          background: 'var(--cms-card-bg)',
                          color: 'var(--cms-text)',
                          fontSize: '0.78rem',
                          fontWeight: '600'
                        }}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.76rem', color: 'var(--cms-text-subtle)' }}>
                        {new Date(tkt.created_at * 1000).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="cms-btn cms-btn-secondary cms-btn-sm"
                          onClick={() => setSelectedTicket(tkt)}
                        >
                          View
                        </button>
                        <button
                          className="cms-btn cms-btn-danger cms-btn-sm"
                          onClick={() => handleDelete(tkt.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedTicket && (
        <div className="cms-modal-backdrop" style={{ zIndex: 110 }}>
          <div className="cms-modal" style={{ maxWidth: '600px' }}>
            <div className="cms-modal-header">
              <h3>Ticket {selectedTicket.ticket_number}: {selectedTicket.subject}</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setSelectedTicket(null)}>✕</button>
            </div>
            <div className="cms-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--cms-bg-subtle)', padding: '12px', borderRadius: '10px' }}>
                <div><strong>Customer:</strong> {selectedTicket.customer_name}</div>
                <div><strong>Email:</strong> {selectedTicket.customer_email}</div>
                <div><strong>Equipment:</strong> {selectedTicket.equipment_model}</div>
                <div><strong>Serial #:</strong> {selectedTicket.serial_number || 'N/A'}</div>
                <div><strong>Category:</strong> {selectedTicket.category}</div>
                <div><strong>Priority:</strong> {selectedTicket.priority}</div>
              </div>

              <div>
                <strong>Problem Description:</strong>
                <p style={{ margin: '6px 0 0', padding: '10px', background: 'var(--cms-card-bg)', border: '1px solid var(--cms-border)', borderRadius: '8px', fontSize: '0.86rem', lineHeight: '1.5' }}>
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolution_notes && (
                <div>
                  <strong>Resolution & Technical Notes:</strong>
                  <p style={{ margin: '6px 0 0', padding: '10px', background: 'rgba(96, 122, 78, 0.1)', border: '1px solid rgba(96, 122, 78, 0.3)', borderRadius: '8px', fontSize: '0.84rem' }}>
                    {selectedTicket.resolution_notes}
                  </p>
                </div>
              )}
            </div>
            <div className="cms-modal-footer">
              <a
                href={`mailto:${selectedTicket.customer_email}?subject=Regarding StoneKrusher Ticket ${selectedTicket.ticket_number}`}
                className="cms-btn cms-btn-primary"
              >
                ✉️ Contact Customer
              </a>
              <button className="cms-btn cms-btn-secondary" onClick={() => setSelectedTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showNewModal && (
        <div className="cms-modal-backdrop" style={{ zIndex: 110 }}>
          <div className="cms-modal" style={{ maxWidth: '640px' }}>
            <div className="cms-modal-header">
              <h3>Create Support & Service Ticket</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTicket}>
              <div className="cms-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="cms-form-group">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      className="cms-input"
                      required
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    />
                  </div>
                  <div className="cms-form-group">
                    <label>Customer Email *</label>
                    <input
                      type="email"
                      className="cms-input"
                      required
                      value={formData.customer_email}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="cms-form-group">
                    <label>Machine Model</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={formData.equipment_model}
                      onChange={(e) => setFormData({ ...formData, equipment_model: e.target.value })}
                    />
                  </div>
                  <div className="cms-form-group">
                    <label>Equipment Serial Number</label>
                    <input
                      type="text"
                      className="cms-input"
                      placeholder="e.g. SK-JC180-2026"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cms-form-group">
                  <label>Subject *</label>
                  <input
                    type="text"
                    className="cms-input"
                    required
                    placeholder="Brief description of issue"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="cms-form-group">
                    <label>Priority</label>
                    <select
                      className="cms-select"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="cms-form-group">
                    <label>Category</label>
                    <select
                      className="cms-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Technical">Technical</option>
                      <option value="Warranty">Warranty</option>
                      <option value="Parts">Parts</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="cms-form-group">
                    <label>Status</label>
                    <select
                      className="cms-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="cms-form-group">
                  <label>Issue Description</label>
                  <textarea
                    className="cms-textarea"
                    rows="3"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-primary">
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
