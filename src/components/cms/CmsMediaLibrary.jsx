import React, { useState, useEffect, useRef } from 'react';

/**
 * CmsMediaLibrary
 * Renders the 100% identical KiuQ Media Library both inside CMS and standalone.
 * Enforces StoneKrusher CMS single sign-on authentication and supports
 * image selection callbacks for Blog and Product editors.
 */
export default function CmsMediaLibrary({ csrfToken, sessionToken, isPicker = false, onSelectMedia }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  // Resolve session token from props or localStorage
  const effectiveToken = sessionToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('cms_session_token') || '' : '');

  // Handle postMessage for image picker mode
  useEffect(() => {
    const handleMessage = (event) => {
      // Validate origin if needed or inspect payload
      if (!event.data) return;
      if (event.data.type === 'MEDIA_SELECTED' && event.data.url) {
        if (typeof onSelectMedia === 'function') {
          onSelectMedia(event.data.url);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelectMedia]);

  const standaloneUrl = `/medialibrary/index.php${effectiveToken ? `?cms_token=${encodeURIComponent(effectiveToken)}` : ''}`;
  const iframeSrc = `/medialibrary/index.php?embedded=1${effectiveToken ? `&cms_token=${encodeURIComponent(effectiveToken)}` : ''}`;

  return (
    <div
      className={`cms-media-library-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={
        isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              background: '#090d16',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px'
            }
          : {
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }
      }
    >
      {/* Top Action Bar (only shown when not inside a small picker dialog) */}
      {!isPicker && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'var(--cms-card-bg, #111827)',
            padding: '10px 18px',
            borderRadius: '12px',
            border: '1px solid var(--cms-border, rgba(255, 255, 255, 0.08))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(96, 122, 78, 0.18)',
                color: '#86a870',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--cms-text, #f3f4f6)' }}>
                Media Library
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cms-muted, #9ca3af)' }}>
                KiuQ Asset Management & Image Hosting (100% Synced)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setIframeKey((k) => k + 1);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--cms-text, #e5e7eb)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title="Reload Media Library"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Reload</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--cms-text, #e5e7eb)',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {isFullscreen ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
              <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>

            <a
              href={standaloneUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: '#607a4e',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(96, 122, 78, 0.3)'
              }}
              title="Open Standalone in New Tab"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Open Standalone ↗</span>
            </a>
          </div>
        </div>
      )}

      {/* Embedded 100% Identical Media Library Iframe */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: isPicker
            ? '68vh'
            : isFullscreen
            ? 'calc(100vh - 70px)'
            : 'calc(100vh - 170px)',
          minHeight: isPicker ? '500px' : '750px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--cms-border, rgba(255, 255, 255, 0.08))',
          background: '#0d131f'
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: '#0d131f',
              color: '#9ca3af',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#607a4e',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: '500' }}>Loading Media Library...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={iframeSrc}
          title="KiuQ Media Library"
          onLoad={() => setLoading(false)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}
