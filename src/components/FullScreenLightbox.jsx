import { useState, useEffect, useRef, useCallback } from 'react';

export default function FullScreenLightbox({
  isOpen,
  images = [],
  initialIndex = 0,
  title = '',
  onClose
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef(null);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex >= 0 && initialIndex < images.length ? initialIndex : 0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, images.length]);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % images.length);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [images.length]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, +(prev + 0.5).toFixed(1)));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = Math.max(1, +(prev - 0.5).toFixed(1));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleZoom = (e) => {
    e.stopPropagation();
    if (zoom === 1) {
      setZoom(1.8);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Mouse pan handlers when zoomed
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!isOpen || !images || images.length === 0) return null;

  const currentImageUrl = images[currentIndex] || images[0];

  return (
    <div
      ref={containerRef}
      className="fullscreen-lightbox-portal"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} Full Screen Image Viewer`}
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Navigation & Controls Bar */}
      <header className="lightbox-top-bar" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-title-wrap">
          <span className="lightbox-brand-pill">KONSTRUCTZ</span>
          <h2 className="lightbox-product-title">{title}</h2>
          {images.length > 1 && (
            <span className="lightbox-counter">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="lightbox-controls">
          <div className="lightbox-zoom-group">
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              aria-label="Zoom out"
              title="Zoom Out (-)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            <span className="lightbox-zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              aria-label="Zoom in"
              title="Zoom In (+)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </button>
            {zoom > 1 && (
              <button
                type="button"
                className="lightbox-btn lightbox-btn-reset"
                onClick={handleResetZoom}
                title="Reset zoom"
              >
                Reset
              </button>
            )}
          </div>

          <a
            href={currentImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="lightbox-btn"
            title="Open original image in new tab"
            aria-label="Open original image in new tab"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>

          <button
            type="button"
            className="lightbox-btn lightbox-btn-close"
            onClick={onClose}
            aria-label="Close full screen view"
            title="Close (Esc)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span className="lightbox-esc-label">ESC</span>
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <div className="lightbox-stage" onClick={onClose}>
        {images.length > 1 && (
          <button
            type="button"
            className="lightbox-arrow-btn lightbox-arrow-prev"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            aria-label="Previous photo"
            title="Previous (Left arrow)"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        <div
          className={`lightbox-image-wrapper ${zoom > 1 ? 'zoomed' : ''} ${isDragging ? 'dragging' : ''}`}
          onClick={toggleZoom}
          onMouseDown={handleMouseDown}
          style={{
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
        >
          <img
            src={currentImageUrl}
            alt={`${title} - view ${currentIndex + 1}`}
            className="lightbox-active-image"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
            }}
            draggable={false}
          />
        </div>

        {images.length > 1 && (
          <button
            type="button"
            className="lightbox-arrow-btn lightbox-arrow-next"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            aria-label="Next photo"
            title="Next (Right arrow)"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <footer className="lightbox-bottom-strip" onClick={(e) => e.stopPropagation()}>
          <div className="lightbox-thumbnails-scroll">
            {images.map((imgUrl, idx) => (
              <button
                type="button"
                key={imgUrl + idx}
                className={`lightbox-thumb-btn ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label={`Show photo ${idx + 1}`}
              >
                <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
