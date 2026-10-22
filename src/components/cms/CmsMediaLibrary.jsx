import React, { useState, useEffect } from 'react';

export default function CmsMediaLibrary({ csrfToken }) {
  const [mediaList, setMediaList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editAlt, setEditAlt] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [deleteWarning, setDeleteWarning] = useState(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      let url = `/api/cms.php?action=media_list&page=${page}&limit=24`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMediaList(data.media || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [page]);

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append('file', file);
      fd.append('_csrf', csrfToken);

      try {
        const res = await fetch('/api/upload.php', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: fd
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          alert(`Failed to upload ${file.name}: ${data.error || 'Server error'}`);
        }
      } catch (err) {
        alert(`Error uploading ${file.name}`);
      }
    }
    setUploading(false);
    fetchMedia();
  };

  const handleSelectMedia = (item) => {
    setSelectedItem(item);
    setEditAlt(item.alt_text || '');
    setEditCaption(item.caption || '');
  };

  const handleSaveMeta = async () => {
    if (!selectedItem) return;
    try {
      const res = await fetch('/api/cms.php?action=media_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          id: selectedItem.id,
          alt_text: editAlt,
          caption: editCaption
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Media details updated.');
        fetchMedia();
      }
    } catch (err) {
      alert('Failed to update media');
    }
  };

  const handleDeleteMedia = async (force = false) => {
    if (!selectedItem) return;
    try {
      const res = await fetch('/api/cms.php?action=media_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          id: selectedItem.id,
          force: force ? 1 : 0
        })
      });
      const data = await res.json();
      if (res.status === 409 && data.requires_confirmation) {
        setDeleteWarning(data.error);
        return;
      }
      if (data.success) {
        setSelectedItem(null);
        setDeleteWarning(null);
        fetchMedia();
      } else {
        alert(data.error || 'Failed to delete media');
      }
    } catch (err) {
      alert('Error deleting media');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Media Asset Library</h1>
          <p>Organize, optimize, and reuse photos for blog articles and equipment catalog</p>
        </div>
        <div className="cms-section-actions">
          <label className="cms-btn cms-btn-primary" style={{ cursor: 'pointer' }}>
            <span>📤</span> {uploading ? 'Uploading...' : 'Upload Media'}
            <input
              type="file"
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="cms-table-wrapper" style={{ marginBottom: '20px' }}>
        <div className="cms-table-toolbar">
          <div className="cms-table-search">
            <span className="cms-table-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search filename or alt text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchMedia()}
            />
          </div>

          <div className="cms-table-filters">
            <button
              className={`cms-btn ${viewMode === 'grid' ? 'cms-btn-primary' : 'cms-btn-secondary'} cms-btn-sm`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={`cms-btn ${viewMode === 'list' ? 'cms-btn-primary' : 'cms-btn-secondary'} cms-btn-sm`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" onClick={fetchMedia}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* MEDIA GRID / LIST VIEW */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--cms-text-muted)' }}>
          Loading media assets...
        </div>
      ) : mediaList.length === 0 ? (
        <div className="cms-card" style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🖼️</div>
          <h3 style={{ margin: '0 0 6px' }}>Media Library Empty</h3>
          <p style={{ color: 'var(--cms-text-muted)', fontSize: '0.86rem', margin: 0 }}>
            Upload machinery photographs, diagrams, and article covers to get started.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {mediaList.map((m) => (
            <div
              key={m.id}
              onClick={() => handleSelectMedia(m)}
              className="cms-card"
              style={{
                padding: '8px',
                cursor: 'pointer',
                borderColor: selectedItem?.id === m.id ? 'var(--cms-primary)' : 'var(--cms-card-border)'
              }}
            >
              <div style={{ width: '100%', height: '120px', background: 'var(--cms-bg)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={m.filepath}
                  alt={m.alt_text || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ padding: '6px 4px 0' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.original_name || m.filename}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--cms-text-subtle)' }}>
                  {formatBytes(m.file_size)} {m.dimensions ? `· ${m.dimensions}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cms-table-wrapper" style={{ marginBottom: '24px' }}>
          <div className="cms-table-responsive">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Original Name</th>
                  <th>MIME Type</th>
                  <th>Dimensions</th>
                  <th>File Size</th>
                  <th>Date Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {mediaList.map((m) => (
                  <tr key={m.id} onClick={() => handleSelectMedia(m)} style={{ cursor: 'pointer' }}>
                    <td>
                      <img src={m.filepath} alt="" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px' }} />
                    </td>
                    <td style={{ fontWeight: '600' }}>{m.original_name || m.filename}</td>
                    <td><code>{m.mime_type}</code></td>
                    <td>{m.dimensions || '—'}</td>
                    <td>{formatBytes(m.file_size)}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--cms-text-subtle)' }}>
                      {new Date(m.created_at * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="cms-pagination" style={{ background: 'var(--cms-card-bg)', borderRadius: 'var(--cms-radius-lg)', marginBottom: '24px' }}>
          <div>Showing {mediaList.length} of {total} assets</div>
          <div className="cms-page-controls">
            <button className="cms-btn cms-btn-secondary cms-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span style={{ padding: '0 8px', fontWeight: '600' }}>Page {page} of {totalPages}</span>
            <button className="cms-btn cms-btn-secondary cms-btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* INSPECTOR MODAL */}
      {selectedItem && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal" style={{ maxWidth: '580px' }}>
            <div className="cms-modal-header">
              <h3>Media Details</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setSelectedItem(null)}>✕</button>
            </div>
            <div className="cms-modal-body">
              <div style={{ textAlign: 'center', marginBottom: '18px', background: 'var(--cms-bg)', padding: '16px', borderRadius: '8px' }}>
                <img
                  src={selectedItem.filepath}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: '240px', objectFit: 'contain' }}
                />
              </div>

              {deleteWarning && (
                <div style={{ padding: '12px', background: 'var(--cms-danger-bg)', color: 'var(--cms-danger)', borderRadius: 'var(--cms-radius-md)', marginBottom: '14px', fontSize: '0.84rem' }}>
                  ⚠️ {deleteWarning}
                  <div style={{ marginTop: '8px' }}>
                    <button className="cms-btn cms-btn-danger cms-btn-sm" onClick={() => handleDeleteMedia(true)}>
                      Force Delete Anyway
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem', marginBottom: '16px' }}>
                <div><strong>File size:</strong> {formatBytes(selectedItem.file_size)}</div>
                <div><strong>Dimensions:</strong> {selectedItem.dimensions || 'Vector / Unknown'}</div>
                <div><strong>MIME type:</strong> {selectedItem.mime_type}</div>
                <div><strong>Uploaded:</strong> {new Date(selectedItem.created_at * 1000).toLocaleString()}</div>
              </div>

              <div className="cms-form-group">
                <label>Direct URL</label>
                <input
                  type="text"
                  className="cms-input"
                  readOnly
                  value={selectedItem.filepath}
                  onClick={(e) => { e.target.select(); navigator.clipboard.writeText(selectedItem.filepath); alert('URL copied to clipboard!'); }}
                  style={{ fontSize: '0.8rem', cursor: 'copy' }}
                />
              </div>

              <div className="cms-form-group">
                <label>Alt Text (SEO & Accessibility)</label>
                <input
                  type="text"
                  className="cms-input"
                  value={editAlt}
                  onChange={(e) => setEditAlt(e.target.value)}
                  placeholder="Describe image for screen readers and SEO..."
                />
              </div>

              <div className="cms-form-group">
                <label>Caption</label>
                <input
                  type="text"
                  className="cms-input"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Optional display caption..."
                />
              </div>
            </div>

            <div className="cms-modal-footer">
              <button
                type="button"
                className="cms-btn cms-btn-danger"
                onClick={() => handleDeleteMedia(false)}
              >
                Delete File
              </button>
              <button
                type="button"
                className="cms-btn cms-btn-primary"
                onClick={handleSaveMeta}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
