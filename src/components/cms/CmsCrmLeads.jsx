import React, { useState, useEffect } from 'react';

export default function CmsCrmLeads({ csrfToken, initialFilterStatus = 'all' }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(initialFilterStatus);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  // New Lead Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    machine_model: 'Stone Krusher Jaw Crusher 180',
    inquiry_type: 'RFQ Machinery Quote',
    estimated_value: '',
    status: 'New',
    message: '',
    notes: ''
  });

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      setErrorNotice('');
      const url = `/api/cms.php?action=inquiries_list&status=${filterStatus}&search=${encodeURIComponent(searchTerm)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setInquiries(json.inquiries || []);
      } else {
        setErrorNotice(json.error || 'Failed to load inquiries list');
      }
    } catch (err) {
      setErrorNotice(err.message || 'Error connecting to inquiries API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, [filterStatus, searchTerm]);

  const handleStatusChange = async (id, newStatus) => {
    const item = inquiries.find(i => i.id === id);
    if (!item) return;

    try {
      setErrorNotice('');
      const res = await fetch('/api/cms.php?action=inquiry_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          ...item,
          status: newStatus,
          csrf_token: csrfToken
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
        setNotice(`Lead status updated to ${newStatus}`);
        setTimeout(() => setNotice(''), 3000);
      } else {
        setErrorNotice(json.error || 'Failed to update lead status');
      }
    } catch (err) {
      setErrorNotice(err.message || 'Network error updating lead status');
    }
  };

  const handleSaveNewLead = async (e) => {
    e.preventDefault();
    try {
      setErrorNotice('');
      const res = await fetch('/api/cms.php?action=inquiry_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          ...formData,
          estimated_value: parseFloat(formData.estimated_value) || 0,
          csrf_token: csrfToken
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          machine_model: 'Stone Krusher Jaw Crusher 180',
          inquiry_type: 'RFQ Machinery Quote',
          estimated_value: '',
          status: 'New',
          message: '',
          notes: ''
        });
        fetchInquiries();
        setNotice('New quote lead recorded successfully!');
        setTimeout(() => setNotice(''), 3500);
      } else {
        setErrorNotice(json.error || 'Failed to save quote lead');
      }
    } catch (err) {
      setErrorNotice(err.message || 'Network error saving quote lead');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this inquiry record?')) return;
    try {
      setErrorNotice('');
      const res = await fetch('/api/cms.php?action=inquiry_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id, csrf_token: csrfToken })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setInquiries(prev => prev.filter(i => i.id !== id));
        setSelectedInquiry(null);
        setNotice('Inquiry deleted successfully.');
        setTimeout(() => setNotice(''), 3000);
      } else {
        setErrorNotice(json.error || 'Failed to delete inquiry');
      }
    } catch (err) {
      setErrorNotice(err.message || 'Network error deleting inquiry');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Company', 'Model', 'Type', 'Est. Value', 'Status', 'Message', 'Notes'];
    const rows = inquiries.map(i => [
      i.id,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.email || '').replace(/"/g, '""')}"`,
      `"${(i.phone || '').replace(/"/g, '""')}"`,
      `"${(i.company || '').replace(/"/g, '""')}"`,
      `"${(i.machine_model || '').replace(/"/g, '""')}"`,
      `"${(i.inquiry_type || '').replace(/"/g, '""')}"`,
      i.estimated_value,
      i.status,
      `"${(i.message || '').replace(/"/g, '""')}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stonekrusher_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalValue = inquiries.reduce((sum, i) => sum + (parseFloat(i.estimated_value) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>CRM & Quote Inquiries</h1>
          <p>Track inbound machinery RFQs, lead qualification, and customer negotiations</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-secondary" onClick={exportCSV}>
            <span>📥</span> Export CSV
          </button>
          <button className="cms-btn cms-btn-primary" onClick={() => setShowAddModal(true)}>
            <span>➕</span> Record New Lead
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: '10px 16px', background: 'rgba(96, 122, 78, 0.2)', border: '1px solid var(--cms-primary)', color: 'var(--cms-primary)', borderRadius: '10px', fontWeight: '600', fontSize: '0.88rem' }}>
          {notice}
        </div>
      )}

      {errorNotice && (
        <div style={{ padding: '10px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '10px', fontWeight: '600', fontSize: '0.88rem' }}>
          {errorNotice}
        </div>
      )}

      {/* PIPELINE STATS ROW */}
      <div className="cms-stats-grid">
        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Active Pipeline</div>
            <div className="cms-stat-value">${totalValue.toLocaleString()}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              {inquiries.length} Inbound RFQ Quotes
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-green">💵</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">New Leads</div>
            <div className="cms-stat-value">{inquiries.filter(i => i.status === 'New').length}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Pending first contact
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-blue">📬</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Formal Quotes Sent</div>
            <div className="cms-stat-value">{inquiries.filter(i => i.status === 'Quoted').length}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Pricing under review
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-amber">📑</div>
        </div>

        <div className="cms-stat-card">
          <div>
            <div className="cms-stat-label">Deals Closed Won</div>
            <div className="cms-stat-value">{inquiries.filter(i => i.status === 'Won').length}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', marginTop: '4px' }}>
              Equipment contracted
            </div>
          </div>
          <div className="cms-stat-icon-wrapper cms-stat-icon-purple">🤝</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="cms-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'New', 'Contacted', 'Quoted', 'Won', 'Lost'].map(st => (
            <button
              key={st}
              className={`cms-btn ${filterStatus === st ? 'cms-btn-primary' : 'cms-btn-secondary'} cms-btn-sm`}
              onClick={() => setFilterStatus(st)}
            >
              {st === 'all' ? 'All Leads' : st}
            </button>
          ))}
        </div>

        <div style={{ width: '280px' }}>
          <input
            type="text"
            className="cms-input"
            style={{ height: '36px', fontSize: '0.85rem' }}
            placeholder="Search customer, model, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* INQUIRIES LIST TABLE */}
      <div className="cms-card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
            Loading CRM pipeline...
          </div>
        ) : inquiries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cms-text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
            <p>No inquiries found matching current filter.</p>
          </div>
        ) : (
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Machine Model</th>
                  <th>Inquiry Type</th>
                  <th>Est. Value</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => (
                  <tr key={inq.id}>
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--cms-text)' }}>{inq.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>
                        {inq.company ? `${inq.company} · ` : ''}{inq.email}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: '600' }}>{inq.machine_model || 'General Equipment'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)' }}>{inq.inquiry_type}</span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--cms-primary)' }}>
                        {inq.estimated_value > 0 ? `$${Number(inq.estimated_value).toLocaleString()}` : '$0'}
                      </strong>
                    </td>
                    <td>
                      <select
                        value={inq.status}
                        onChange={(e) => handleStatusChange(inq.id, e.target.value)}
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
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Quoted">Quoted</option>
                        <option value="Won">Won</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.76rem', color: 'var(--cms-text-subtle)' }}>
                        {new Date(inq.created_at * 1000).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="cms-btn cms-btn-secondary cms-btn-sm"
                          onClick={() => setSelectedInquiry(inq)}
                        >
                          View
                        </button>
                        <button
                          className="cms-btn cms-btn-danger cms-btn-sm"
                          onClick={() => handleDelete(inq.id)}
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
      {selectedInquiry && (
        <div className="cms-modal-backdrop" style={{ zIndex: 110 }}>
          <div className="cms-modal" style={{ maxWidth: '600px' }}>
            <div className="cms-modal-header">
              <h3>Inquiry: {selectedInquiry.name}</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setSelectedInquiry(null)}>✕</button>
            </div>
            <div className="cms-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--cms-bg-subtle)', padding: '12px', borderRadius: '10px' }}>
                <div><strong>Email:</strong> {selectedInquiry.email}</div>
                <div><strong>Phone:</strong> {selectedInquiry.phone || 'N/A'}</div>
                <div><strong>Company:</strong> {selectedInquiry.company || 'Private'}</div>
                <div><strong>Model:</strong> {selectedInquiry.machine_model || 'General'}</div>
                <div><strong>Est. Value:</strong> ${Number(selectedInquiry.estimated_value || 0).toLocaleString()}</div>
                <div><strong>Status:</strong> <span className={`cms-badge cms-badge-${selectedInquiry.status.toLowerCase()}`}>{selectedInquiry.status}</span></div>
              </div>

              <div>
                <strong>Customer Message:</strong>
                <p style={{ margin: '6px 0 0', padding: '10px', background: 'var(--cms-card-bg)', border: '1px solid var(--cms-border)', borderRadius: '8px', fontSize: '0.86rem', lineHeight: '1.5' }}>
                  {selectedInquiry.message || 'No message content provided.'}
                </p>
              </div>

              {selectedInquiry.notes && (
                <div>
                  <strong>Internal Notes:</strong>
                  <p style={{ margin: '6px 0 0', padding: '10px', background: 'rgba(96, 122, 78, 0.1)', border: '1px solid rgba(96, 122, 78, 0.3)', borderRadius: '8px', fontSize: '0.84rem' }}>
                    {selectedInquiry.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="cms-modal-footer">
              <a
                href={`mailto:${selectedInquiry.email}?subject=Regarding your StoneKrusher inquiry for ${selectedInquiry.machine_model || 'machinery'}`}
                className="cms-btn cms-btn-primary"
              >
                ✉️ Reply via Email
              </a>
              <button className="cms-btn cms-btn-secondary" onClick={() => setSelectedInquiry(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {showAddModal && (
        <div className="cms-modal-backdrop" style={{ zIndex: 110 }}>
          <div className="cms-modal" style={{ maxWidth: '640px' }}>
            <div className="cms-modal-header">
              <h3>Record New Quote Lead</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveNewLead}>
              <div className="cms-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="cms-form-group">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      className="cms-input"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="cms-form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      className="cms-input"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="cms-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="cms-form-group">
                    <label>Company / Organization</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="cms-form-group">
                    <label>Machine Model of Interest</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={formData.machine_model}
                      onChange={(e) => setFormData({ ...formData, machine_model: e.target.value })}
                    />
                  </div>
                  <div className="cms-form-group">
                    <label>Estimated Quote Value ($)</label>
                    <input
                      type="number"
                      className="cms-input"
                      placeholder="e.g. 28000"
                      value={formData.estimated_value}
                      onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cms-form-group">
                  <label>Message / Specifications Needed</label>
                  <textarea
                    className="cms-textarea"
                    rows="3"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <div className="cms-form-group">
                  <label>Internal Staff Notes</label>
                  <textarea
                    className="cms-textarea"
                    rows="2"
                    placeholder="Delivery timeline, payment terms, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-primary">
                  Save Lead Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
