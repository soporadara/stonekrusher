import { useState } from 'react';
import FullScreenLightbox from '../FullScreenLightbox';
import './v900-showcase.css';

export default function V900Showcase({ onNavigate, onViewProduct, v900Product }) {
  // Engine view angle switcher (0 = Front/Fan, 1 = Rear/Flywheel)
  const [engineAngle, setEngineAngle] = useState(0);

  // Lightbox state for zooming into full-res machinery photography
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Gallery of authentic V900 assets for inspection in the lightbox
  const galleryImages = [
    { src: '/images/v900/v900-compact-track-loader-hero.webp', alt: 'TYPHON STOMP V900 compact track loader 3/4 high lift view' },
    { src: '/images/v900/v900-kubota-d1105-engine.webp', alt: 'Kubota D1105 diesel engine front view with cooling fan' },
    { src: '/images/v900/v900-kubota-d1105-engine-angle.webp', alt: 'Kubota D1105 diesel engine rear angle showing flywheel and starter' },
    { src: '/images/v900/v900-hydraulic-system.webp', alt: 'V900 3-pump 3-valve hydraulic system with quick-connect valve inset' },
    { src: '/images/v900/v900-triangular-track-system.webp', alt: 'V900 triangular track undercarriage geometry side profile' },
    { src: '/images/v900/v900-protective-side-guards.webp', alt: 'V900 protective side safety guards rear view' },
    { src: '/images/v900/v900-loader-raised-front.webp', alt: 'V900 compact track loader front view with bucket fully raised' },
    { src: '/images/v900/v900-lifting-capacity-poster.webp', alt: 'V900 Lift Stronger Work Faster promotional poster with load specifications' }
  ];

  const openLightboxAt = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleExploreClick = (e) => {
    e.preventDefault();
    if (onViewProduct && v900Product) {
      onViewProduct(v900Product);
    } else {
      const overviewEl = document.getElementById('v900-overview');
      if (overviewEl) {
        overviewEl.scrollIntoView({ behavior: 'smooth' });
      } else if (onNavigate) {
        onNavigate('all-products', { category: 'Skid Steer' });
      }
    }
  };

  const handleQuoteClick = (e) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('contact');
    } else {
      window.location.href = '/contact/';
    }
  };

  const productUrl = v900Product?.slug
    ? `/products/${encodeURIComponent(v900Product.slug)}/`
    : '/products/brand-new-typhon-stomp-v900-1-4-ton-compact-track-loader-with-25hp-kubota-diesel-engine-1-102-lb-max-load-typh-v900y/';

  return (
    <div className="v900-showcase-wrapper" id="v900-machine-showcase">
      {/* ===================================================================
          1. HOMEPAGE HERO SECTION
          =================================================================== */}
      <section id="v900-hero" className="v900-hero-section">
        <div className="v900-container">
          <div className="v900-hero-grid">
            {/* HERO CONTENT LEFT */}
            <div className="v900-hero-content">
              <div className="v900-kicker">
                <span className="v900-kicker-dot" aria-hidden="true"></span>
                <span>TYPHON COMPACT TRACK LOADER SERIES</span>
              </div>

              <h1 className="v900-heading-xl">
                Compact Size.<br />
                <span style={{ color: 'var(--v900-blue-primary)' }}>Serious Lifting Performance.</span>
              </h1>

              <p className="v900-lead">
                Meet the V900 compact track loader, engineered for demanding work in confined spaces.
                With a capable hydraulic system, a stability-focused triangular track design, protective
                side guards, and a 460 kg rated operating capacity, the V900 delivers practical performance
                for everyday jobsite tasks.
              </p>

              <div className="v900-btn-group">
                <a
                  href={productUrl}
                  onClick={handleExploreClick}
                  className="v900-btn-primary"
                  id="hero-explore-v900-btn"
                >
                  <span>Explore the V900</span>
                  <span aria-hidden="true">→</span>
                </a>

                <a
                  href="?page=contact"
                  onClick={handleQuoteClick}
                  className="v900-btn-outline"
                  id="hero-quote-v900-btn"
                >
                  <span>Request a Quote</span>
                </a>
              </div>
            </div>

            {/* HERO VISUAL RIGHT */}
            <div className="v900-hero-visual">
              <div className="v900-hero-glow-backdrop" aria-hidden="true"></div>
              <div
                className="v900-hero-img-wrap"
                onClick={() => openLightboxAt(0)}
                title="Click to view full-resolution loader photo"
                style={{ cursor: 'pointer' }}
              >
                <img
                  src="/images/v900/v900-compact-track-loader-hero.webp"
                  alt="TYPHON STOMP V900 compact track loader with raised bucket in blue brand livery"
                  className="v900-hero-img"
                  width="1280"
                  height="1280"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          {/* HERO QUICK SPEC STRIP */}
          <div className="v900-hero-stats-strip" aria-label="V900 Key Specifications At A Glance">
            <div className="v900-hero-stat-item">
              <span className="v900-hero-stat-val">460 kg</span>
              <strong className="v900-hero-stat-label">Rated Operating Capacity</strong>
              <p className="v900-hero-stat-desc">1,014 lbs safe continuous operating load</p>
            </div>

            <div className="v900-hero-stat-item">
              <span className="v900-hero-stat-val">Kubota D1105</span>
              <strong className="v900-hero-stat-label">Industrial Diesel</strong>
              <p className="v900-hero-stat-desc">Proven compact Japanese diesel platform</p>
            </div>

            <div className="v900-hero-stat-item">
              <span className="v900-hero-stat-val">48 L/min</span>
              <strong className="v900-hero-stat-label">Hydraulic Flow</strong>
              <p className="v900-hero-stat-desc">12.7 GPM flow at 16 MPa (2,321 PSI)</p>
            </div>

            <div className="v900-hero-stat-item">
              <span className="v900-hero-stat-val">Triangular</span>
              <strong className="v900-hero-stat-label">Track Configuration</strong>
              <p className="v900-hero-stat-desc">Elevated drive sprocket &amp; high traction</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          2. V900 PRODUCT INTRODUCTION & NAVIGATION JUMP BAR
          =================================================================== */}
      <section id="v900-overview" className="v900-section v900-section-alt">
        <div className="v900-container">
          {/* QUICK NAV BAR */}
          <div className="v900-quick-nav-bar" aria-label="V900 Feature Navigation">
            <span className="v900-quick-nav-label">V900 Deep Dive:</span>
            <div className="v900-quick-nav-pills">
              <a href="#v900-engine" className="v900-nav-pill">
                <span>⚡ Kubota D1105 Engine</span>
              </a>
              <a href="#v900-hydraulics" className="v900-nav-pill">
                <span>💧 3-Pump / 3-Valve Hydraulics</span>
              </a>
              <a href="#v900-tracks" className="v900-nav-pill">
                <span>📐 Triangular Track System</span>
              </a>
              <a href="#v900-guards" className="v900-nav-pill">
                <span>🛡️ Protective Side Guards</span>
              </a>
              <a href="#v900-capacity" className="v900-nav-pill">
                <span>🏋️ Lifting Capacity</span>
              </a>
            </div>
          </div>

          <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 48px auto' }}>
            <div className="v900-kicker">
              <span className="v900-kicker-dot" aria-hidden="true"></span>
              <span>COMPACT ENGINEERING FOR PROFESSIONAL CREWS</span>
            </div>
            <h2 className="v900-heading-lg">
              Built for Jobsite Productivity Where Larger Loaders Cannot Reach
            </h2>
            <p className="v900-lead" style={{ margin: '0 auto' }}>
              From landscaping and earthmoving to municipal projects and estate maintenance, the V900
              combines a tight turning radius with high hydraulic versatility. Every component—from
              the Kubota diesel powerplant to the reinforced track chassis—is engineered for practical,
              everyday reliability.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================================
          3. NEW FEATURE SECTION: KUBOTA D1105 ENGINE
          =================================================================== */}
      <section id="v900-engine" className="v900-section">
        <div className="v900-container">
          <div className="v900-engine-grid">
            {/* LEFT: TEXT & VERIFIED SPECS */}
            <div>
              <div className="v900-kicker">
                <span className="v900-kicker-dot" aria-hidden="true"></span>
                <span>ENGINEERING PLATFORM</span>
              </div>

              <h2 className="v900-heading-lg">
                Powered by the Kubota D1105 Engine
              </h2>

              <p className="v900-lead">
                The V900 is equipped with a Kubota D1105 engine, bringing a proven compact diesel
                power platform to a machine designed for practical jobsite performance. Its compact
                engine format complements the V900's maneuverability and utility-focused design.
              </p>

              {/* SPECIFICATION CHIPS */}
              <div className="v900-spec-chips-grid">
                <div className="v900-spec-chip">
                  <span className="v900-spec-chip-label">Engine Designation</span>
                  <div className="v900-spec-chip-value">Kubota D1105</div>
                </div>

                <div className="v900-spec-chip">
                  <span className="v900-spec-chip-label">Fuel &amp; Cooling Type</span>
                  <div className="v900-spec-chip-value">Liquid-Cooled Diesel</div>
                </div>

                <div className="v900-spec-chip">
                  <span className="v900-spec-chip-label">Platform Format</span>
                  <div className="v900-spec-chip-value">Compact Multi-Cylinder</div>
                </div>

                <div className="v900-spec-chip">
                  <span className="v900-spec-chip-label">Application Focus</span>
                  <div className="v900-spec-chip-value">Continuous Duty Hydraulics</div>
                </div>
              </div>

              <div style={{ marginTop: '28px' }}>
                <a
                  href="#v900-hydraulics"
                  className="v900-btn-outline"
                  style={{ display: 'inline-flex' }}
                >
                  <span>Explore Hydraulic Match</span>
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
            </div>

            {/* RIGHT: DUAL-ANGLE INTERACTIVE ENGINE VIEWER */}
            <div>
              <div className="v900-engine-viewer-card">
                <div
                  className="v900-engine-stage"
                  onClick={() => openLightboxAt(engineAngle === 0 ? 1 : 2)}
                  title="Click to zoom in full resolution"
                  style={{ cursor: 'pointer' }}
                >
                  <img
                    src={engineAngle === 0 ? '/images/v900/v900-kubota-d1105-engine.webp' : '/images/v900/v900-kubota-d1105-engine-angle.webp'}
                    alt={engineAngle === 0 ? 'Kubota D1105 diesel engine front angle with cooling fan' : 'Kubota D1105 diesel engine rear angle showing flywheel'}
                    className="v900-engine-img"
                    width="1280"
                    height="1280"
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                {/* ANGLE SWITCHER BUTTONS */}
                <div className="v900-engine-controls">
                  <button
                    type="button"
                    className={`v900-angle-btn ${engineAngle === 0 ? 'active' : ''}`}
                    onClick={() => setEngineAngle(0)}
                    aria-label="View front angle of Kubota D1105 engine"
                  >
                    <span>Angle 1: Front / Fan View</span>
                  </button>

                  <button
                    type="button"
                    className={`v900-angle-btn ${engineAngle === 1 ? 'active' : ''}`}
                    onClick={() => setEngineAngle(1)}
                    aria-label="View rear flywheel angle of Kubota D1105 engine"
                  >
                    <span>Angle 2: Flywheel View</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          4. NEW FEATURE SECTION: 3-PUMP / 3-VALVE HYDRAULIC SYSTEM
          =================================================================== */}
      <section id="v900-hydraulics" className="v900-section v900-section-alt">
        <div className="v900-container">
          <div className="v900-feature-split">
            {/* LEFT: FEATURE IMAGE SHOWING MACHINE & INSET HYDRAULIC DETAIL */}
            <div>
              <div
                className="v900-feature-img-card"
                onClick={() => openLightboxAt(3)}
                title="Click to view full-resolution hydraulic system image"
                style={{ cursor: 'pointer' }}
              >
                <img
                  src="/images/v900/v900-hydraulic-system.webp"
                  alt="V900 3-pump 3-valve hydraulic system with inset quick-connect valve detail"
                  className="v900-feature-img"
                  width="1280"
                  height="1280"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>

            {/* RIGHT: TEXT & EXACT VERIFIED PERFORMANCE METRICS */}
            <div>
              <div className="v900-kicker">
                <span className="v900-kicker-dot" aria-hidden="true"></span>
                <span>FLUID POWER ARCHITECTURE</span>
              </div>

              <h2 className="v900-heading-lg">
                Responsive Hydraulic Performance
              </h2>

              <p className="v900-lead">
                The V900's 3-pump / 3-valve hydraulic system is designed to support responsive machine
                operation and attachment functionality. With a stated hydraulic flow of 48 L/min (12.7 GPM)
                and rated pressure of 16 MPa (2,321 PSI), it provides a clear specification-led view
                of the machine's hydraulic capability.
              </p>

              {/* METRIC CARDS */}
              <div className="v900-metric-cards-grid">
                <div className="v900-metric-card highlight">
                  <div className="v900-metric-val">48 L/min</div>
                  <div className="v900-metric-sub">Hydraulic Flow (12.7 GPM)</div>
                  <p className="v900-metric-note">Stated manufacturer fluid flow rate for consistent hydraulic performance.</p>
                </div>

                <div className="v900-metric-card highlight">
                  <div className="v900-metric-val">16 MPa</div>
                  <div className="v900-metric-sub">Rated Pressure (2,321 PSI)</div>
                  <p className="v900-metric-note">Rated system pressure providing responsive power to cylinders and attachments.</p>
                </div>

                <div className="v900-metric-card">
                  <div className="v900-metric-val">3 Pumps</div>
                  <div className="v900-metric-sub">Hydraulic Pump Circuit</div>
                  <p className="v900-metric-note">Dedicated hydraulic pump architecture configured for operational responsiveness.</p>
                </div>

                <div className="v900-metric-card">
                  <div className="v900-metric-val">3 Valves</div>
                  <div className="v900-metric-sub">Control Valve Array</div>
                  <p className="v900-metric-note">Multi-spool control valve system with front auxiliary quick-connect ports.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          5. NEW FEATURE SECTION: TRIANGULAR TRACK SYSTEM
          =================================================================== */}
      <section id="v900-tracks" className="v900-section">
        <div className="v900-container">
          <div className="v900-feature-split reverse">
            {/* LEFT: TEXT & TRACK HIGHLIGHTS */}
            <div>
              <div className="v900-kicker">
                <span className="v900-kicker-dot" aria-hidden="true"></span>
                <span>UNDERCARRIAGE DYNAMICS</span>
              </div>

              <h2 className="v900-heading-lg">
                Triangular Track System for Stability and Traction
              </h2>

              <p className="v900-lead">
                The V900's triangular track configuration is designed to support stable movement
                and traction across demanding working surfaces. Its compact tracked platform helps
                the machine navigate jobsite conditions while maintaining a practical footprint.
              </p>

              {/* TRACK SYSTEM HIGHLIGHTS */}
              <div className="v900-track-highlights">
                <div className="v900-check-item">
                  <div className="v900-check-icon">✓</div>
                  <div className="v900-check-text">
                    <strong>Elevated Drive Sprocket Geometry</strong>
                    <p>Elevating the rear drive motor helps keep final drive components protected from direct obstacles and ground debris.</p>
                  </div>
                </div>

                <div className="v900-check-item">
                  <div className="v900-check-icon">✓</div>
                  <div className="v900-check-text">
                    <strong>Wide Contact Rubber Tracks</strong>
                    <p>Continuous rubber tracks with heavy chevron lug tread distribute machine weight across uneven, soft, or muddy ground.</p>
                  </div>
                </div>

                <div className="v900-check-item">
                  <div className="v900-check-icon">✓</div>
                  <div className="v900-check-text">
                    <strong>Balanced Stance &amp; Low Center of Mass</strong>
                    <p>The low-slung battery and hydraulic tank placement stabilizes the machine during loader arm extension and travel.</p>
                  </div>
                </div>

                <div className="v900-check-item">
                  <div className="v900-check-icon">✓</div>
                  <div className="v900-check-text">
                    <strong>360-Degree Counter-Rotation</strong>
                    <p>Independent dual track control enables smooth spin turns within the machine’s own footprint for tight alleyway access.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: TRACK SYSTEM PHOTOGRAPHY */}
            <div>
              <div
                className="v900-feature-img-card"
                onClick={() => openLightboxAt(4)}
                title="Click to view full-resolution triangular track geometry"
                style={{ cursor: 'pointer' }}
              >
                <img
                  src="/images/v900/v900-triangular-track-system.webp"
                  alt="V900 compact track loader side profile displaying triangular track configuration and sprocket geometry"
                  className="v900-feature-img"
                  width="1280"
                  height="1280"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          6. NEW FEATURE SECTION: PROTECTIVE SIDE SAFETY GUARDS
          =================================================================== */}
      <section id="v900-guards" className="v900-section v900-section-alt">
        <div className="v900-container">
          <div className="v900-feature-split">
            {/* LEFT: REAR GUARDS PHOTOGRAPHY */}
            <div>
              <div
                className="v900-feature-img-card"
                onClick={() => openLightboxAt(5)}
                title="Click to view full-resolution protective guards"
                style={{ cursor: 'pointer' }}
              >
                <img
                  src="/images/v900/v900-protective-side-guards.webp"
                  alt="V900 protective side safety guards rear view demonstrating steel side shrouding"
                  className="v900-feature-img"
                  width="1280"
                  height="1280"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>

            {/* RIGHT: TEXT & GUARD DETAILS */}
            <div>
              <div className="v900-kicker">
                <span className="v900-kicker-dot" aria-hidden="true"></span>
                <span>JOB SITE PROTECTION</span>
              </div>

              <h2 className="v900-heading-lg">
                Protective Side Guards
              </h2>

              <p className="v900-lead">
                Protective side guards add a practical layer of shielding around designated machine
                components. The V900's guard design should be shown clearly so customers can understand
                the machine's construction and protective features.
              </p>

              {/* THREE BENEFIT CARDS */}
              <div className="v900-track-highlights">
                <div className="v900-check-item">
                  <div className="v900-check-icon">🛡️</div>
                  <div className="v900-check-text">
                    <strong>Shielded Component Architecture</strong>
                    <p>Sturdy side panels shield sensitive hydraulic routing, fluid lines, and internal compartments from lateral brush and scrapes.</p>
                  </div>
                </div>

                <div className="v900-check-item">
                  <div className="v900-check-icon">🔧</div>
                  <div className="v900-check-text">
                    <strong>Heavy-Gauge Formed Steel Build</strong>
                    <p>Designed with industrial durability to withstand the tough bumps and abrasive environments of real working jobsites.</p>
                  </div>
                </div>

                <div className="v900-check-item">
                  <div className="v900-check-icon">🧍</div>
                  <div className="v900-check-text">
                    <strong>Operator Standing Safety Zone</strong>
                    <p>Flanked side wings create a well-defined operator standing perimeter behind the intuitive dual joystick controls.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          7. NEW FEATURE SECTION: V900 LIFTING CAPACITY
          =================================================================== */}
      <section id="v900-capacity" className="v900-section">
        <div className="v900-container">
          <div className="v900-capacity-board">
            {/* CAPACITY TEXT & PRECISE RATINGS */}
            <div>
              <div className="v900-kicker">
                <span className="v900-kicker-dot" aria-hidden="true"></span>
                <span>LOAD &amp; LIFT CAPABILITY</span>
              </div>

              <h2 className="v900-heading-lg">
                Compact Footprint. Practical Lifting Capacity.
              </h2>

              <p className="v900-lead">
                The V900 delivers a rated operating capacity of 1,014 lbs (460 kg) and a maximum load
                capacity of 1,102 lbs (500 kg), providing impressive lifting performance for a compact machine.
              </p>

              {/* 4 NATIVE SPEC CARDS WITH CLEAR DISTINCTION */}
              <div className="v900-capacity-specs-grid">
                <div className="v900-capacity-card primary-rated">
                  <span className="v900-capacity-badge">Primary Operational Rating</span>
                  <div className="v900-capacity-num">1,014 LBS</div>
                  <div className="v900-capacity-title">Rated Operating Capacity (460 kg)</div>
                  <p className="v900-capacity-desc">Standard safe continuous working capacity with standard operating safety factor.</p>
                </div>

                <div className="v900-capacity-card">
                  <div className="v900-capacity-num">1,102 LBS</div>
                  <div className="v900-capacity-title">Maximum Load Capacity (500 kg)</div>
                  <p className="v900-capacity-desc">Peak machine load capacity threshold for dense material handling.</p>
                </div>

                <div className="v900-capacity-card">
                  <div className="v900-capacity-num">5.30 FT³</div>
                  <div className="v900-capacity-title">Bucket Capacity (0.15 m³)</div>
                  <p className="v900-capacity-desc">Standard material bucket volume for earth, soil, gravel, and mulch.</p>
                </div>

                <div className="v900-capacity-card">
                  <div className="v900-capacity-num">1,012 LBF</div>
                  <div className="v900-capacity-title">Maximum Breakout Force</div>
                  <p className="v900-capacity-desc">Hydraulic bucket curl force to penetrate tough dirt and compacted material.</p>
                </div>
              </div>
            </div>

            {/* CAPACITY VISUAL & POSTER LIGHTBOX TRIGGER */}
            <div className="v900-capacity-visual-wrap">
              <img
                src="/images/v900/v900-loader-raised-front.webp"
                alt="V900 compact track loader front view demonstrating high vertical lift"
                className="v900-capacity-img"
                width="1280"
                height="1280"
                loading="lazy"
                decoding="async"
                onClick={() => openLightboxAt(6)}
                title="Click to view full-resolution raised lift photo"
              />

              <div>
                <button
                  type="button"
                  className="v900-poster-preview-trigger"
                  onClick={() => openLightboxAt(7)}
                  aria-label="View official V900 promotional poster"
                >
                  <span>🔍 View Official V900 Spec Poster &rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          8. PRODUCT ACTION & INQUIRY BANNER
          =================================================================== */}
      <section id="v900-inquiry-banner" className="v900-section" style={{ paddingTop: '0' }}>
        <div className="v900-container">
          <div className="v900-cta-banner">
            <div className="v900-cta-banner-content">
              <div className="v900-kicker" style={{ background: 'rgba(2, 132, 199, 0.2)', borderColor: 'rgba(2, 132, 199, 0.4)', color: '#38bdf8' }}>
                <span className="v900-kicker-dot" style={{ background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }}></span>
                <span>FACTORY DIRECT INQUIRY &amp; QUOTE SUPPORT</span>
              </div>
              <h3>Ready to Put the V900 to Work?</h3>
              <p>
                Speak directly with our compact machinery specialists for factory pricing, nationwide
                freight delivery estimates, and attachment packages. Available in Yellow, Red, and Blue.
              </p>
            </div>

            <div className="v900-btn-group">
              <a
                href="?page=contact"
                onClick={handleQuoteClick}
                className="v900-btn-primary"
                id="banner-quote-v900-btn"
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' }}
              >
                <span>Request a Quote Now</span>
                <span aria-hidden="true">→</span>
              </a>

              <a
                href={productUrl}
                onClick={handleExploreClick}
                className="v900-btn-outline"
                id="banner-explore-v900-btn"
                style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.25)' }}
              >
                <span>View Full Product Specs</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FULL-SCREEN LIGHTBOX MODAL REUSE */}
      {lightboxOpen && (
        <FullScreenLightbox
          isOpen={lightboxOpen}
          images={galleryImages}
          initialIndex={lightboxIndex}
          title="V900 Compact Track Loader — Authentic Product Photography"
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
