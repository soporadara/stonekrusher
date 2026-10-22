import React, { useState, useEffect, useRef } from 'react';

export default function CmsMediaLibrary({ csrfToken, isPicker = false, onSelectMedia }) {
  const [viewMode, setViewMode] = useState('manager'); // 'manager' (live iframe) | 'grid' (native grid)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  // Native Grid State
  const [mediaList, setMediaList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editAlt, setEditAlt] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
    if (viewMode === 'grid') {
      fetchMedia();
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

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
    if (viewMode === 'grid') {
      fetchMedia();
    }
  }, [page, viewMode]);

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
    setIframeKey(prev => prev + 1);
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(''), 2500);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`cms-media-suite ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {/* Top Header & Controls bar matching Rafelblog Media/Index.tsx */}
      <div className="cms-card cms-media-header-card">
        <div className="cms-media-header-left">
          <div className="cms-media-icon-badge">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div className="cms-media-title-row">
              <h1 className="cms-media-title">Media Library</h1>
              <span className="cms-badge-emerald">Live File Manager</span>
            </div>
            <p className="cms-media-subtitle">
              Upload assets, organize folders, convert WebP, and copy direct article links
            </p>
          </div>
        </div>

        <div className="cms-media-header-actions">
          {/* Mode Switcher */}
          {!isPicker && (
            <div className="cms-media-mode-pills">
              <button
                type="button"
                className={`cms-media-mode-pill ${viewMode === 'manager' ? 'active' : ''}`}
                onClick={() => setViewMode('manager')}
                title="Live File Manager with Folders & WebP Tools"
              >
                📁 Live Manager
              </button>
              <button
                type="button"
                className={`cms-media-mode-pill ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Visual Asset Grid"
              >
                🖼️ Grid View
              </button>
            </div>
          )}

          <button
            type="button"
            className="cms-btn cms-btn-secondary cms-btn-sm"
            onClick={handleRefresh}
            title="Reload File Manager"
          >
            🔄 Refresh
          </button>

          <button
            type="button"
            className="cms-btn cms-btn-secondary cms-btn-sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? '🗗 Minimize' : '🗖 Fullscreen'}
          </button>

          <a
            href="/medialibrary/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="cms-btn cms-btn-primary cms-btn-sm"
            title="Open in standalone window"
          >
            ↗ Open Standalone
          </a>
        </div>
      </div>

      {/* VIEW 1: EMBEDDED LIVE FILE MANAGER (TINYFILEMANAGER / RAFELBLOG MEDIA SUITE) */}
      {(viewMode === 'manager' || isPicker) && (
        <div className={`cms-card cms-media-iframe-card ${isFullscreen ? 'fullscreen-frame' : ''}`}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src="/medialibrary/index.php"
            title="StoneKrusher Media File Manager"
            className="cms-media-iframe"
            allow="clipboard-read; clipboard-write; fullscreen"
          />
          {isPicker && (
            <div className="cms-media-picker-helper">
              <span>💡 Tip:</span> Copy the image link or upload images in the folders above, then paste the URL into your article cover image or content.
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: NATIVE ASSET GRID (Fast thumbnail gallery with metadata) */}
      {viewMode === 'grid' && !isPicker && (
        <div className="cms-media-grid-view">
          {/* Upload / Filter Bar */}
          <div className="cms-card cms-media-toolbar-card">
            <div className="cms-search-box" style={{ flex: 1, maxWidth: '400px' }}>
              <span className="cms-search-icon">🔍</span>
              <input
                type="text"
                className="cms-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchMedia(); }}
                placeholder="Search images by filename or alt text..."
              />
            </div>

            <label className="cms-btn cms-btn-primary" style={{ cursor: 'pointer' }}>
              <span>📤</span> {uploading ? 'Uploading...' : 'Upload Photos'}
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Grid Container */}
          <div className="cms-media-grid-container">
            {loading ? (
              <div className="cms-media-empty">Loading media assets...</div>
            ) : mediaList.length === 0 ? (
              <div className="cms-media-empty">
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🖼️</div>
                <div style={{ fontWeight: '600' }}>No assets found in native catalog</div>
                <p style={{ fontSize: '0.84rem', marginTop: '4px' }}>
                  Switch to "Live Manager" above to browse the full file directory, or upload a photo.
                </p>
              </div>
            ) : (
              <div className="cms-media-grid">
                {mediaList.map((item) => (
                  <div
                    key={item.id}
                    className={`cms-media-card ${selectedItem?.id === item.id ? 'is-selected' : ''}`}
                    onClick={() => {
                      if (onSelectMedia) {
                        onSelectMedia(item.filepath);
                      } else {
                        setSelectedItem(item);
                        setEditAlt(item.alt_text || '');
                        setEditCaption(item.caption || '');
                      }
                    }}
                  >
                    <div className="cms-media-thumb-wrap">
                      <img src={item.filepath} alt={item.alt_text || item.original_name} loading="lazy" />
                    </div>
                    <div className="cms-media-card-info">
                      <div className="cms-media-card-name" title={item.original_name}>
                        {item.original_name}
                      </div>
                      <div className="cms-media-card-size">
                        {formatBytes(item.file_size)} • {item.dimensions || 'image'}
                      </div>
                    </div>
                    <div className="cms-media-card-actions">
                      <button
                        type="button"
                        className="cms-media-copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyUrl(item.filepath);
                        }}
                      >
                        {copiedUrl === item.filepath ? '✓ Copied' : '📋 Copy URL'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
