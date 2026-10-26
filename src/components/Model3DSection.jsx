import React, { useState, useEffect, useRef } from 'react';

/**
 * Single 3D Model Viewer with 360° Rotation Controls and Studio Lighting
 */
export const GlbViewer = ({
  src,
  alt,
  productName,
  initialBg = '#ffffff',
  height = '560px',
  cameraOrbit = '45deg 75deg 105%',
  fieldOfView = '30deg',
}) => {
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const [isRotating, setIsRotating] = useState(true);
  const [bgColor, setBgColor] = useState(initialBg);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Ensure @google/model-viewer is loaded
  useEffect(() => {
    let isMounted = true;
    import('@google/model-viewer')
      .then(() => {
        if (isMounted) {
          // Custom element registered
        }
      })
      .catch((err) => {
        console.warn('Bundled @google/model-viewer failed, relying on CDN script:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to model-viewer events
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleProgress = (event) => {
      const progress = Math.round((event.detail.totalProgress || 0) * 100);
      setLoadProgress(progress);
    };

    const handleLoad = () => {
      setIsLoaded(true);
      setLoadProgress(100);
    };

    const handleError = (err) => {
      console.error('Error loading 3D GLB:', err);
      setLoadError('Failed to load 3D model.');
    };

    viewer.addEventListener('progress', handleProgress);
    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);

    return () => {
      viewer.removeEventListener('progress', handleProgress);
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, [src]);

  // Toggle Auto Rotation
  const toggleRotation = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const newState = !isRotating;
    setIsRotating(newState);
    if (newState) {
      viewer.setAttribute('auto-rotate', '');
    } else {
      viewer.removeAttribute('auto-rotate');
    }
  };

  // Reset Camera View
  const handleResetView = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.cameraOrbit = cameraOrbit;
    viewer.fieldOfView = fieldOfView;
    viewer.jumpCameraToGoal?.();
  };

  // Zoom controls
  const handleZoom = (direction) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      if (viewer.zoom) {
        viewer.zoom(direction > 0 ? 1 : -1);
      } else {
        const currentFov = parseFloat(viewer.fieldOfView || '30deg');
        const nextFov = Math.max(15, Math.min(60, currentFov + (direction > 0 ? -5 : 5)));
        viewer.fieldOfView = `${nextFov}deg`;
      }
    } catch {
      // fallback
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`glb-viewer-wrapper ${isFullscreen ? 'is-fullscreen' : ''}`}
      style={{
        backgroundColor: bgColor,
        minHeight: height,
      }}
    >

      {/* Error Fallback */}
      {loadError && (
        <div className="glb-error-overlay">
          <span className="glb-error-icon">⚠️</span>
          <p>{loadError}</p>
        </div>
      )}

      {/* Top Floating Badge & Status */}
      <div className="glb-top-bar">
        <div className="glb-badge-pill">
          <span className="glb-pulse-beacon"></span>
          <span className="glb-badge-text">360° INTERACTIVE 3D</span>
        </div>
        <div className="glb-product-tag">{productName}</div>
      </div>

      {/* Interactive 3D Model Viewer Web Component */}
      <model-viewer
        ref={viewerRef}
        src={src}
        alt={alt || productName}
        auto-rotate={isRotating ? '' : undefined}
        rotation-per-second="24deg"
        camera-controls=""
        disable-zoom=""
        touch-action="pan-y"
        shadow-intensity="1.3"
        shadow-softness="0.75"
        exposure="1.08"
        environment-image="neutral"
        interaction-prompt="none"
        loading="eager"
        reveal="auto"
        camera-orbit={cameraOrbit}
        field-of-view={fieldOfView}
        style={{
          width: '100%',
          height: '100%',
          minHeight: height,
          display: 'block',
          outline: 'none',
        }}
      ></model-viewer>

      {/* Drag Hint Pill */}
      <div className="glb-drag-hint">
        <span className="glb-hint-icon">🖱️</span>
        <span>Drag to rotate 360° · Scroll to zoom</span>
      </div>

      {/* Floating Interactive Control Dock */}
      <div className="glb-control-dock">
        <button
          type="button"
          className={`glb-dock-btn ${isRotating ? 'active' : ''}`}
          onClick={toggleRotation}
          title={isRotating ? 'Pause 360° Rotation' : 'Start 360° Rotation'}
        >
          <span className={`glb-btn-icon ${isRotating ? 'rotating' : ''}`}>🔄</span>
          <span className="glb-btn-label">{isRotating ? 'Rotating 360°' : 'Rotate 360°'}</span>
        </button>

        <div className="glb-dock-divider"></div>

        <button
          type="button"
          className="glb-dock-btn-icon"
          onClick={() => handleZoom(1)}
          title="Zoom In"
        >
          ＋
        </button>
        <button
          type="button"
          className="glb-dock-btn-icon"
          onClick={() => handleZoom(-1)}
          title="Zoom Out"
        >
          －
        </button>

        <button
          type="button"
          className="glb-dock-btn"
          onClick={handleResetView}
          title="Reset Camera View"
        >
          <span className="glb-btn-icon">🧭</span>
          <span className="glb-btn-label">Reset</span>
        </button>

        <div className="glb-dock-divider"></div>

        {/* Studio Background Selector */}
        <div className="glb-bg-switcher" title="Change Studio Background">
          <button
            type="button"
            className={`glb-bg-dot white ${bgColor === '#ffffff' ? 'active' : ''}`}
            onClick={() => setBgColor('#ffffff')}
            title="Studio White"
          ></button>
          <button
            type="button"
            className={`glb-bg-dot gray ${bgColor === '#f8fafc' ? 'active' : ''}`}
            onClick={() => setBgColor('#f8fafc')}
            title="Studio Neutral"
          ></button>
          <button
            type="button"
            className={`glb-bg-dot dark ${bgColor === '#101611' ? 'active' : ''}`}
            onClick={() => setBgColor('#101611')}
            title="Studio Obsidian"
          ></button>
        </div>

        <div className="glb-dock-divider"></div>

        <button
          type="button"
          className="glb-dock-btn-icon"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen 3D'}
        >
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>
    </div>
  );
};

/**
 * Section 1: TYPHON STONEKRUSHER K1 (3D GLB on Left, Specs on Right)
 */
export const StoneKrusher3DSection = ({ onQuoteClick }) => {
  return (
    <section id="stonekrusher-3d-section" className="glb-showcase-section theme-dark">
      <div className="glb-ambient-glow top-left"></div>
      <div className="glb-ambient-glow bottom-right"></div>

      <div className="glb-showcase-container">
        {/* Section Header */}
        <div className="glb-section-header">
          <div className="glb-header-badge">
            <span className="glb-badge-dot"></span>
            <span>360 DEGREE ROTATION</span>
          </div>
          <h2 className="glb-main-title">
            360 Degree <span className="metallic-gold-gradient">Rotation</span>
          </h2>
          <p className="glb-sub-title">
            Interactive photorealistic 3D presentation of the <strong>TYPHON STONEKRUSHER K1</strong>.
            Inspect the high-manganese jaws, Honda GX390 powertrain, and highway-towable chassis from any angle.
          </p>
        </div>

        {/* Two-Column Showcase Card: 3D GLB on LEFT, Specs on RIGHT */}
        <div className="glb-stage-card layout-3d-left">
          {/* Left Column: 3D GLB Viewer */}
          <div className="glb-column-viewer">
            <GlbViewer
              src="/k1.glb"
              alt="TYPHON STONEKRUSHER K1 3D Model"
              productName="TYPHON STONEKRUSHER K1"
              initialBg="#ffffff"
              height="580px"
              cameraOrbit="45deg 75deg 105%"
            />
          </div>

          {/* Right Column: Spec Intelligence Panel */}
          <div className="glb-column-specs">
            <div className="glb-specs-header">
              <span className="glb-category-tag">HEAVY INDUSTRIAL JAW CRUSHER</span>
              <h3 className="glb-product-title">TYPHON STONEKRUSHER K1</h3>
              <p className="glb-product-tagline">Compact Highway-Towable Trailer Jaw Crusher</p>
            </div>

            <p className="glb-product-desc">
              Engineered with an authentic commercial Honda GX390 4-stroke engine and single-toggle manganese alloy
              jaw plates. Delivers 2–4 Tons/Hr crushing throughput for on-site concrete recycling, asphalt, masonry brick,
              and quarry stone with instant highway towability.
            </p>

            {/* 2x3 Metric Dashboard */}
            <div className="glb-metrics-grid">
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">OPERATING WEIGHT</span>
                <strong className="glb-metric-val">1.0 Ton (2,205 lbs / 1,000 kg)</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">ENGINE POWER</span>
                <strong className="glb-metric-val">Honda GX390 (11.7 HP @ 3600 rpm)</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">PRODUCTION RATE</span>
                <strong className="glb-metric-val">2 – 4 Tons/Hr (4,409 – 8,818 lb/hr)</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">FEED INLET OPENING</span>
                <strong className="glb-metric-val">150 × 250 mm (5.91" × 9.84")</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">OUTPUT AGGREGATE</span>
                <strong className="glb-metric-val">5 – 25 mm (0.20" – 1.00" adjustable)</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">CHASSIS &amp; TOWING</span>
                <strong className="glb-metric-val">Dual-Axle Frame + 2" Ball Hitch</strong>
              </div>
            </div>

            {/* System Highlights Checklist */}
            <div className="glb-highlights-card">
              <span className="glb-highlights-title">KEY ENGINEERING HIGHLIGHTS</span>
              <div className="glb-chips-wrap">
                <span className="glb-spec-chip">✓ Honda GX390 11.7 HP Commercial OHV Gas Engine</span>
                <span className="glb-spec-chip">✓ Dual-Axle Road Chassis with DOT-Style Tires</span>
                <span className="glb-spec-chip">✓ High-Manganese Reversible Wear Jaw Plates</span>
                <span className="glb-spec-chip">✓ 400 mm (15.75 in) High-Speed Discharge Conveyor</span>
                <span className="glb-spec-chip">✓ 16 MPa (2,320 PSI) Manual Hydraulic Jaw Gap Control</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="glb-action-bar">
              <a
                href="#contact"
                className="glb-primary-btn"
                onClick={(e) => {
                  if (onQuoteClick) {
                    e.preventDefault();
                    onQuoteClick('TYPHON STONEKRUSHER K1');
                  }
                }}
              >
                <span>Request Direct Factory Quote</span>
                <span className="glb-btn-arrow">→</span>
              </a>
              <a
                href="?page=all-products&search=K1"
                className="glb-secondary-btn"
              >
                View Full K1 Specs &amp; Availability
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/**
 * Section 2: TYPHON ThunderDump Lift (Specs on Left, 3D GLB on Right)
 */
export const ThunderDump3DSection = ({ onQuoteClick }) => {
  return (
    <section id="thunderdump-3d-section" className="glb-showcase-section theme-dark alt-section">
      <div className="glb-ambient-glow top-right"></div>
      <div className="glb-ambient-glow bottom-left"></div>

      <div className="glb-showcase-container">
        {/* Section Header */}
        <div className="glb-section-header">
          <div className="glb-header-badge">
            <span className="glb-badge-dot"></span>
            <span>360 DEGREE ROTATION</span>
          </div>
          <h2 className="glb-main-title">
            360 Degree <span className="metallic-gold-gradient">Rotation</span>
          </h2>
          <p className="glb-sub-title">
            Interactive photorealistic 3D presentation of the <strong>TYPHON ThunderDump Lift</strong>.
            Inspect the high-lift hydraulic scissor dumping mechanism, rubber crawler tracks, and reinforced steel bucket.
          </p>
        </div>

        {/* Two-Column Showcase Card: Specs on LEFT, 3D GLB on RIGHT */}
        <div className="glb-stage-card layout-3d-right">
          {/* Left Column: Spec Intelligence Panel */}
          <div className="glb-column-specs">
            <div className="glb-specs-header">
              <span className="glb-category-tag">HIGH-DUMP COMPACT TRACKED DUMPER</span>
              <h3 className="glb-product-title">TYPHON ThunderDump Lift</h3>
              <p className="glb-product-tagline">Hydraulic Scissor High-Lift Compact Site Dumper</p>
            </div>

            <p className="glb-product-desc">
              Heavy-duty compact tracked site dumper engineered for hauling soil, crushed rock, concrete, gravel,
              mulch, and jobsite debris. Built with an industrial hydraulic scissor lift mechanism that elevates and
              dumps cleanly into standard pickup beds, dump trucks, and high-walled waste skips.
            </p>

            {/* 2x3 Metric Dashboard */}
            <div className="glb-metrics-grid">
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">PAYLOAD CAPACITY</span>
                <strong className="glb-metric-val">1,000 kg (2,205 lbs) Payload</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">ENGINE MODEL</span>
                <strong className="glb-metric-val">Honda GX390 Commercial 11.0 HP Gas</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">MAX DUMP HEIGHT</span>
                <strong className="glb-metric-val">Up to 1,600 mm (63.0 in) High-Lift</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">HOPPER CAPACITY</span>
                <strong className="glb-metric-val">0.4 m³ (14.1 cu ft) Hardened Steel</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">DRIVE SYSTEM</span>
                <strong className="glb-metric-val">Dual Hydrostatic Crawler Rubber Tracks</strong>
              </div>
              <div className="glb-metric-card">
                <span className="glb-metric-lbl">CHASSIS WEIGHT</span>
                <strong className="glb-metric-val">1.8 Ton Heavy Tracked Chassis</strong>
              </div>
            </div>

            {/* System Highlights Checklist */}
            <div className="glb-highlights-card">
              <span className="glb-highlights-title">KEY ENGINEERING HIGHLIGHTS</span>
              <div className="glb-chips-wrap">
                <span className="glb-spec-chip">✓ Hydraulic Scissor High-Lift for Direct Truck Loading</span>
                <span className="glb-spec-chip">✓ High-Traction Heavy Rubber Tracks for Mud &amp; Incline</span>
                <span className="glb-spec-chip">✓ Dual Hydrostatic Travel Motors with Smooth Zero-Turn</span>
                <span className="glb-spec-chip">✓ Reinforced Heavy Steel Hopper &amp; Impact Rock Guard</span>
                <span className="glb-spec-chip">✓ Ergonomic Dual-Lever Hydraulic Operator Controls</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="glb-action-bar">
              <a
                href="#contact"
                className="glb-primary-btn"
                onClick={(e) => {
                  if (onQuoteClick) {
                    e.preventDefault();
                    onQuoteClick('TYPHON ThunderDump Lift');
                  }
                }}
              >
                <span>Request Direct Factory Quote</span>
                <span className="glb-btn-arrow">→</span>
              </a>
              <a
                href="?page=all-products&search=ThunderDump"
                className="glb-secondary-btn"
              >
                View ThunderDump Lift Inventory
              </a>
            </div>
          </div>

          {/* Right Column: 3D GLB Viewer */}
          <div className="glb-column-viewer">
            <GlbViewer
              src="/td.glb"
              alt="TYPHON ThunderDump Lift 3D Model"
              productName="TYPHON ThunderDump Lift"
              initialBg="#ffffff"
              height="580px"
              cameraOrbit="45deg 75deg 105%"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
