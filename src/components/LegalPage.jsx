import {
  LEGAL_COMPANY,
  LEGAL_DOCUMENTS,
  LEGAL_LAST_UPDATED
} from '../data/legal-content.js';
import './legal.css';

const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const renderBlock = (block, index) => {
  if (typeof block === 'string') {
    return <p key={index}>{block}</p>;
  }
  if (block.list) {
    return (
      <ul key={index}>
        {block.list.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }
  if (block.note) {
    return (
      <div className="legal-note" key={index} role="note">
        <span className="legal-note-icon" aria-hidden="true">i</span>
        <p>{block.note}</p>
      </div>
    );
  }
  return null;
};

export default function LegalPage({ kind, navigate }) {
  const doc = LEGAL_DOCUMENTS[kind] || LEGAL_DOCUMENTS.terms;
  const other = kind === 'privacy' ? LEGAL_DOCUMENTS.terms : LEGAL_DOCUMENTS.privacy;

  const go = (event, view) => {
    event.preventDefault();
    navigate(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="legal-page" id={`legal-${doc.key}`}>
      <section className="legal-hero">
        <div className="legal-hero-inner">
          <nav className="legal-breadcrumb" aria-label="Breadcrumb">
            <a href="/" onClick={(e) => go(e, 'home')}>Home</a>
            <span aria-hidden="true">/</span>
            <span>Legal</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{doc.title}</span>
          </nav>
          <span className="legal-eyebrow">{doc.eyebrow}</span>
          <h1>{doc.title}</h1>
          <p className="legal-intro">{doc.intro}</p>
          <div className="legal-meta">
            <span>Last updated: <strong>{LEGAL_LAST_UPDATED}</strong></span>
            <span className="legal-meta-dot" aria-hidden="true" />
            <span>Applies to <strong>{LEGAL_COMPANY.site}</strong></span>
          </div>
          <div className="legal-switch" role="tablist" aria-label="Legal documents">
            <a
              href={LEGAL_DOCUMENTS.terms.path}
              className={kind === 'terms' ? 'active' : ''}
              aria-current={kind === 'terms' ? 'page' : undefined}
              onClick={(e) => go(e, 'terms')}
            >
              Terms of Service
            </a>
            <a
              href={LEGAL_DOCUMENTS.privacy.path}
              className={kind === 'privacy' ? 'active' : ''}
              aria-current={kind === 'privacy' ? 'page' : undefined}
              onClick={(e) => go(e, 'privacy')}
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </section>

      <div className="legal-layout">
        <aside className="legal-toc" aria-label="On this page">
          <p className="legal-toc-title">On this page</p>
          <ol>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  onClick={(e) => { e.preventDefault(); scrollToSection(section.id); }}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="legal-article">
          <div className="legal-summary">
            <h2>Quick summary</h2>
            <ul>
              {doc.summary.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <p className="legal-summary-foot">This summary is for convenience only. The full text below is what applies.</p>
          </div>

          {doc.sections.map((section, index) => (
            <section className="legal-section" id={section.id} key={section.id}>
              <h2>
                <span className="legal-section-number">{String(index + 1).padStart(2, '0')}</span>
                {section.title}
              </h2>
              {section.body.map(renderBlock)}

              {section.id === 'contact' && (
                <address className="legal-contact-card">
                  <strong>{LEGAL_COMPANY.brand}</strong>
                  {LEGAL_COMPANY.addressLines.map((line) => <span key={line}>{line}</span>)}
                  <a href={`tel:${LEGAL_COMPANY.phone.replace(/[^+\d]/g, '')}`}>{LEGAL_COMPANY.phone}</a>
                  <a href={`mailto:${LEGAL_COMPANY.email}`}>{LEGAL_COMPANY.email}</a>
                </address>
              )}
            </section>
          ))}

          <div className="legal-footer-nav">
            <a href={other.path} onClick={(e) => go(e, other.key)}>
              Also read: <strong>{other.title}</strong> <span aria-hidden="true">→</span>
            </a>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Back to top <span aria-hidden="true">↑</span>
            </button>
          </div>
        </article>
      </div>
    </main>
  );
}
