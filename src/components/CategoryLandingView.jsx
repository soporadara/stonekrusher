import React, { useState } from 'react';

const categoryLandingProfiles = {
  Backhoe: {
    title: 'Backhoe Loaders',
    heroParagraphs: [
      'The Backhoe Loader is one of the most recognizable and widely used pieces of machinery in modern construction. Built with a front-mounted loader bucket and a rear-mounted digging arm (the backhoe), it performs the functions of two separate machines, saving space, transport costs, and staging time.',
      'Designed for heavy-duty earthmoving, excavation, loading, and material transport, these machines are highly maneuverable and can travel across paved roads or rugged jobsite terrains easily. They excel in narrow spaces where separate loaders and excavators are impractical.',
      'With a universal quick-coupling system, operators can easily switch out front buckets and backhoe attachments for specialized tools like augers, hydraulic breakers, and sweepers. This adaptability makes the backhoe loader indispensable for public works, utilities, and general contracting.'
    ],
    highlights: [
      'Heavy-Duty Dual-Hydraulic Pump System for smooth simultaneous operation',
      'Soundproofed Ergonomic Cab with 360-degree jobsite visibility',
      'Robust Front Stabilizer Legs for solid anchoring during excavation',
      'Universal Quick-Coupler Plate for fast front attachment swaps'
    ],
    benefits: [
      { title: 'Productivity', text: 'Dual loader and excavator design enables seamless task switching and higher hourly output.' },
      { title: 'Reliability', text: 'Heavy-duty steel frames and reinforced hydraulics ensure maximum uptime in harsh conditions.' },
      { title: 'Easy Operation', text: 'Ergonomic operator cabin with intuitive controls reduces learning curves and fatigue.' },
      { title: 'Reduced Labor', text: 'One operator can dig, load, backfill, and move materials, lowering overall workforce costs.' },
      { title: 'Durability', text: 'Engineered with high-tensile components to withstand heavy loads and daily operations.' },
      { title: 'Versatility', text: 'Supports a wide variety of attachments for digging, lifting, grading, and breaking.' }
    ],
    applications: [
      { num: '01', title: 'URBAN CONSTRUCTION', text: 'Ideal for city projects where site boundaries are tight and roadway travel is required.' },
      { num: '02', title: 'UTILITY TRENCHING', text: 'Perfect for digging utility lines, electrical conduits, water pipes, and sewer links.' },
      { num: '03', title: 'AGRICULTURAL MAINTENANCE', text: 'Used on farms for clearing irrigation ditches, moving feed, and handling heavy hay bales.' },
      { num: '04', title: 'ROADWORK & ASPHALT', text: 'Excavating road beds, loading asphalt aggregates, and backfilling roadside trenches.' }
    ],
    faqs: [
      { q: 'What is a backhoe loader used for?', a: 'A backhoe loader is used for digging trenches, excavating foundations, loading dirt and gravel, backfilling, breaking pavement, and transporting materials.' },
      { q: 'Can it travel on public roads?', a: 'Yes, most compact backhoe loaders can be driven at road speeds between job sites without requiring a flatbed trailer for short distances.' },
      { q: 'What attachments can be added to a backhoe loader?', a: 'You can attach hydraulic breakers, augers, trenching buckets, grapple buckets, snow blades, and pallet forks.' }
    ]
  },
  'Mini Excavator': {
    title: 'Mini Excavators',
    heroParagraphs: [
      'Mini Excavators are essential compact powerhouses designed for trenching, foundation digging, utility installation, and landscaping where space is limited.',
      'Equipped with 360-degree continuous rotation, rubber tracks for ground protection, and precision pilot controls, these diggers navigate tight residential gates and soft terrain effortlessly.',
      'Our mini excavators feature auxiliary hydraulics to power heavy attachments like hydraulic hammers, augers, rippers, and tilting buckets.'
    ],
    highlights: [
      'High-Torque Yanmar & Kubota Diesel Engines for reliable daily digging',
      'Zero-Tail Swing Option for working against walls and tight enclosures',
      'Heavy-Duty Hydraulic Quick-Hitch for rapid attachment changeovers',
      'Reinforced Boom and Arm Construction for long service life'
    ],
    benefits: [
      { title: 'High Dig Force', text: 'Optimized hydraulic flow delivers maximum bucket digging breakout force.' },
      { title: 'Terrain Stability', text: 'Track chassis ensures superior stability on mud, gravel, and steep grades.' },
      { title: 'Fuel Efficiency', text: 'Advanced engine speed management reduces fuel burn and operating expense.' },
      { title: 'Easy Transport', text: 'Compact operating weights allow easy trailering with standard pickup trucks.' },
      { title: 'Operator Comfort', text: 'Spacious seating, intuitive joysticks, and clear visibility boost operator focus.' },
      { title: 'Multitask Ready', text: 'Runs hydraulic breakers, augers, grapples, and trenching buckets seamlessly.' }
    ],
    applications: [
      { num: '01', title: 'UTILITY & PLUMBING', text: 'Digging precise trenches for water lines, gas pipes, electrical conduits, and fiber cables.' },
      { num: '02', title: 'LANDSCAPING & POOLS', text: 'Excavating swimming pools, retaining wall footings, drainage ponds, and tree planting.' },
      { num: '03', title: 'DEMOLITION & BREAKING', text: 'Removing concrete slabs, patio foundations, and old retaining walls with hydraulic hammers.' },
      { num: '04', title: 'FOUNDATION FOOTINGS', text: 'Digging clean residential and commercial building footings with tight tolerance.' }
    ],
    faqs: [
      { q: 'What size mini excavator do I need?', a: 'Select by digging depth requirements, operating weight limits, trailer towing capacity, and access doorway width.' },
      { q: 'Are hydraulic attachments included?', a: 'Standard buckets come included; specialized hydraulic breakers, augers, and tilt buckets can be added to your order.' }
    ]
  },
  'Skid Steer': {
    title: 'Skid Steers & Track Loaders',
    heroParagraphs: [
      'Skid Steer Loaders and Compact Track Loaders are the ultimate multi-role workhorses for grading, clearing, loading, and property maintenance.',
      'Engineered with high-flow auxiliary hydraulics and zero-turn radius agility, these machines power demanding hydraulic tools from brush mowers to earth augers.',
      'Heavy-duty rubber tracks provide exceptional traction and flotation over soft mud, sand, and steep hillsides without sinking.'
    ],
    highlights: [
      'High-Flow Auxiliary Hydraulics for heavy motor attachments',
      'All-Terrain Track System for low ground pressure and high traction',
      'Reinforced Lift Arms for high tipping loads and reach',
      'Universal Quick-Attach Plate compatible with industry attachments'
    ],
    benefits: [
      { title: 'Rapid Loading', text: 'High dump height and bucket clearance for fast truck loading.' },
      { title: 'Superior Traction', text: 'Track chassis prevents bogging down in wet clay and mud.' },
      { title: 'Attachment Hub', text: 'Powers over 40 work tools including mowers, tillers, and sweepers.' },
      { title: 'Smooth Control', text: 'Ergonomic pilot controls enable fine grading and smooth maneuvering.' },
      { title: 'Rugged Frame', text: 'Thick steel chassis handles extreme impact and heavy lifting.' },
      { title: 'Low Maintenance', text: 'Accessible service panels and durable track tensioners simplify upkeep.' }
    ],
    applications: [
      { num: '01', title: 'JOB SITE GRADING', text: 'Rough and fine grading dirt, gravel driveways, and building pads.' },
      { num: '02', title: 'BRUSH & LAND CLEARING', text: 'Clearing dense brush, saplings, and overgrown fields with rotary mowers.' },
      { num: '03', title: 'PALLET & MATERIAL HANDLING', text: 'Transporting heavy pallets of brick, sod, and lumber across uneven terrain.' },
      { num: '04', title: 'SNOW & DEBRIS REMOVAL', text: 'Clearing snowdrifts, storm debris, and gravel piles efficiently.' }
    ],
    faqs: [
      { q: 'What is the difference between a track loader and a wheel skid steer?', a: 'Track loaders distribute weight over tracks for low ground disturbance in mud/sand, while wheel skid steers travel faster on hard asphalt.' },
      { q: 'Can I use standard universal attachments?', a: 'Yes, our machines use the industry-standard universal quick-tach mounting plate.' }
    ]
  },
  'Wheel Loader': {
    title: 'Wheel Loaders',
    heroParagraphs: [
      'Wheel Loaders deliver massive bucket payload capacity, articulated steering maneuverability, and rapid cycle times for high-volume material handling.',
      'Ideal for gravel yards, agricultural feeding, stock piles, and municipal roadwork, these loaders move earth, rock, mulch, and snow efficiently.',
      'Equipped with comfortable pressurized cabins, hydrostatic transmission, and high-visibility front loader arms.'
    ],
    highlights: [
      'Articulated Steering Frame for tight turning in narrow yards',
      'High-Capacity Heavy-Duty Material Bucket',
      'Reliable Diesel Power with Low Emissions & High Torque',
      'Enclosed Heated & Air-Conditioned Ergonomic Cabin'
    ],
    benefits: [
      { title: 'High Payload', text: 'Transports large bucket volumes of gravel, soil, and aggregate quickly.' },
      { title: 'Smooth Travel', text: 'Pneumatic tires provide high road speed and smooth ride comfort.' },
      { title: 'Tight Turning', text: 'Articulated frame articulates up to 40 degrees for tight yard maneuvering.' },
      { title: 'Panoramic View', text: '360-degree glass cabin offers unhindered view of loader bucket.' },
      { title: 'High Breakout', text: 'Powerful hydraulic cylinders scoop dense rock and packed soil easily.' },
      { title: 'Multi-Tool Ready', text: 'Quick-coupler enables fast bucket-to-pallet-fork transitions.' }
    ],
    applications: [
      { num: '01', title: 'GRAVEL & QUARRY YARDS', text: 'Scooping aggregate, loading dump trucks, and stockpiling gravel.' },
      { num: '02', title: 'FARM & FEEDLOTS', text: 'Handling silage, manure, hay bales, and bulk fertilizer efficiently.' },
      { num: '03', title: 'SITE CLEANUP & GRADING', text: 'Pushing heavy piles of dirt, concrete rubble, and clearing debris.' },
      { num: '04', title: 'MUNICIPAL SNOW REMOVAL', text: 'Clearing snow parking lots and pushing high snow banks in winter.' }
    ],
    faqs: [
      { q: 'Why choose a compact wheel loader over a skid steer?', a: 'Wheel loaders offer higher travel speeds, better forward visibility, higher seating height, and greater fuel economy for long transport runs.' }
    ]
  }
};

export default function CategoryLandingView({ categoryKey, products = [], onViewProduct, onQuoteProduct }) {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const profile = categoryLandingProfiles[categoryKey] || {
    title: categoryKey || 'Compact Equipment',
    heroParagraphs: [
      `Our ${categoryKey || 'compact equipment'} lineup is engineered for heavy-duty performance, jobsite reliability, and contractor output across all commercial applications.`,
      `Built with high-tensile steel frames, precision hydraulic systems, and fuel-efficient engines, these machines deliver low operating costs and maximum uptime.`,
      `Explore individual models below and contact our sales team for real-time inventory availability, custom hydraulic attachment packages, and competitive U.S. freight quotes.`
    ],
    highlights: [
      'Heavy-Duty Industrial Grade Components for maximum jobsite reliability',
      'High-Efficiency Hydraulic Systems for smooth multi-function operation',
      'Ergonomic Operator Environment designed for safety and reduced fatigue',
      'Universal Quick-Coupler System for quick attachment integration'
    ],
    benefits: [
      { title: 'Productivity', text: 'Engineered designs enable high hourly material output and task speed.' },
      { title: 'Reliability', text: 'Heavy-duty steel chassis and sealed hydraulics maximize jobsite uptime.' },
      { title: 'Easy Operation', text: 'Intuitive controls and ergonomic seating lower operator fatigue.' },
      { title: 'Reduced Labor', text: 'One machine handles multiple tasks, lowering overall jobsite workforce costs.' },
      { title: 'Durability', text: 'Built with high-tensile steel components to withstand daily impact.' },
      { title: 'Versatility', text: 'Supports specialized work tools for digging, loading, and clearing.' }
    ],
    applications: [
      { num: '01', title: 'URBAN CONSTRUCTION', text: 'Ideal for city jobsites where site access is tight and precision is required.' },
      { num: '02', title: 'UTILITY TRENCHING', text: 'Perfect for digging utility trenches, electrical conduits, and pipe lines.' },
      { num: '03', title: 'AGRICULTURAL MAINTENANCE', text: 'Deployed on farms for land clearing, ditching, and bulk feed handling.' },
      { num: '04', title: 'ROADWORK & SITE PREP', text: 'Excavating road beds, backfilling roadside trenches, and clearing rubble.' }
    ],
    faqs: [
      { q: `What is the warranty and support policy for ${categoryKey || 'this equipment'}?`, a: 'All new KONSTRUCTZ machines come with manufacturer warranty support, full spare parts availability, and technical customer service.' },
      { q: 'How do I request pricing and delivery freight quotes?', a: 'Click "GET A QUOTE" on any model or contact our sales department with your delivery zip code for a complete price quote.' }
    ]
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const titleWords = profile.title.split(' ');
  const titleFirst = titleWords.slice(0, Math.max(1, titleWords.length - 1)).join(' ');
  const titleLast = titleWords.length > 1 ? titleWords[titleWords.length - 1] : '';

  return (
    <div className="cat-landing-wrapper">
      {/* 1. HERO & KEY HIGHLIGHTS */}
      <section className="cat-hero-section">
        <div className="cat-hero-container">
          <div className="cat-hero-text">
            {profile.heroParagraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>

          <div className="cat-highlights-card">
            <div className="cat-highlights-header">
              <span style={{ color: '#c59b27', fontSize: '18px' }}>⚙</span>
              <h3 className="cat-highlights-title">KEY HIGHLIGHTS</h3>
            </div>
            <ul className="cat-highlights-list">
              {profile.highlights.map((item, idx) => (
                <li key={idx} className="cat-highlights-item">
                  <span className="cat-check-icon">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 2. OPERATING BENEFITS */}
      <section className="cat-benefits-section">
        <div className="cat-section-header">
          <h2 className="cat-section-title" style={{ color: '#ffffff' }}>
            OPERATING <span>BENEFITS</span>
          </h2>
          <p className="cat-section-subtitle">
            Our equipment designs prioritize parameters that improve speed, safety, and output on site.
          </p>
        </div>

        <div className="cat-benefits-grid">
          {profile.benefits.map((b, idx) => (
            <div key={idx} className="cat-benefit-card">
              <div className="cat-benefit-icon">✦</div>
              <h3 className="cat-benefit-name">{b.title}</h3>
              <p className="cat-benefit-desc">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. COMMON APPLICATIONS */}
      <section className="cat-applications-section">
        <div className="cat-section-header">
          <h2 className="cat-section-title" style={{ color: '#0f172a' }}>
            COMMON <span>APPLICATIONS</span>
          </h2>
          <p className="cat-section-subtitle dark-sub">
            These categories are widely deployed across major industries of work.
          </p>
        </div>

        <div className="cat-applications-grid">
          {profile.applications.map((app, idx) => (
            <div key={idx} className="cat-app-card">
              <div className="cat-app-num">{app.num}</div>
              <h3 className="cat-app-title">{app.title}</h3>
              <p className="cat-app-desc">{app.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. AVAILABLE MODELS */}
      <section className="cat-models-section">
        <div className="cat-section-header">
          <h2 className="cat-section-title" style={{ color: '#0f172a' }}>
            AVAILABLE <span>MODELS</span>
          </h2>
          <p className="cat-section-subtitle dark-sub">
            Explore the equipment models currently available for this category.
          </p>
        </div>

        <div className="cat-models-grid">
          {products.map((item) => (
            <div key={item.id} className="cat-model-card">
              <div className="cat-model-img-box">
                {item.image ? (
                  <img src={item.image} alt={item.name} loading="lazy" />
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 'bold' }}>{item.category || 'EQUIPMENT'}</div>
                )}
              </div>
              <h3 className="cat-model-title">{item.name}</h3>
              <p className="cat-model-desc">
                {item.desc || (item.weight && item.weight !== 'See details'
                  ? `${item.name} (${item.weight}) powered by ${item.engine || 'high-efficiency engine'} for excavation, trenching, and contractor operations.`
                  : `${item.name} delivers versatile digging, trenching, and material handling in one machine.`)}
              </p>
              <div className="cat-model-actions">
                <button
                  type="button"
                  className="cat-btn-outline"
                  onClick={() => onViewProduct(item)}
                >
                  VIEW DETAILS
                </button>
                <button
                  type="button"
                  className="cat-btn-filled"
                  onClick={() => onQuoteProduct(item)}
                >
                  GET A QUOTE
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. EDUCATIONAL FAQS */}
      <section className="cat-faqs-section">
        <div className="cat-section-header">
          <h2 className="cat-section-title" style={{ color: '#0f172a' }}>
            EDUCATIONAL <span>FAQS</span>
          </h2>
          <p className="cat-section-subtitle dark-sub">
            Get answers to common operational, utility, and maintenance queries about this machinery.
          </p>
        </div>

        <div className="cat-faqs-container">
          {profile.faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className={`cat-faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="cat-faq-question"
                  onClick={() => toggleFaq(idx)}
                >
                  <span>{faq.q}</span>
                  <span className="cat-faq-chevron">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="cat-faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
