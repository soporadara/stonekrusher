import React, { useState, useEffect, useRef } from 'react';

export default function CmsCommandPalette({ isOpen, onClose, onNavigateTab }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const actions = [
    // Dashboards
    { id: 'overview', title: 'Analytics Dashboard', category: 'Dashboards', icon: '📊' },
    { id: 'crm', title: 'CRM & Quote Leads', category: 'Dashboards', icon: '📋' },
    { id: 'support', title: 'Support & Warranty Tracker', category: 'Dashboards', icon: '🎫' },
    { id: 'seo', title: 'SEO & Web Rankings Suite', category: 'Dashboards', icon: '🌐' },

    // Content & Catalog
    { id: 'posts_new', title: 'Compose New Blog Post', category: 'Content Hub', icon: '✍️' },
    { id: 'posts', title: 'All Blog Articles', category: 'Content Hub', icon: '📝' },
    { id: 'categories', title: 'Categories & Topics', category: 'Content Hub', icon: '🏷️' },
    { id: 'products', title: 'Machinery Catalog (174 Models)', category: 'Catalog', icon: '🚜' },
    { id: 'media', title: 'Media Library File Manager', category: 'Assets', icon: '📁' },

    // Governance & Security
    { id: 'security', title: 'Security Center & Shield', category: 'Governance', icon: '🛡️' },
    { id: 'users', title: 'Users & Roles Management', category: 'Governance', icon: '👥' },
    { id: 'settings', title: 'CMS System Settings', category: 'System', icon: '⚙️' }
  ];

  const filtered = actions.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onNavigateTab(filtered[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cms-cmd-backdrop" onClick={onClose}>
      <div className="cms-cmd-box" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cms-cmd-search-wrap">
          <span style={{ fontSize: '1.2rem', color: 'var(--cms-primary)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cms-cmd-search-input"
            placeholder="Search pages, tools, or press ESC to exit..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'var(--cms-bg-subtle)', borderRadius: '4px', border: '1px solid var(--cms-border)' }}>
            ESC
          </span>
        </div>

        <div className="cms-cmd-results">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--cms-text-subtle)', fontSize: '0.88rem' }}>
              No tools or pages found for "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`cms-cmd-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onNavigateTab(item.id);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <div>
                    <span style={{ fontWeight: '600' }}>{item.title}</span>
                    <span style={{ marginLeft: '8px', fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>
                      in {item.category}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>Jump →</span>
              </div>
            ))
          )}
        </div>

        <div className="cms-cmd-footer">
          <span>Navigate with <kbd>↑</kbd> <kbd>↓</kbd></span>
          <span>Select with <kbd>↵ Enter</kbd></span>
          <span>Close with <kbd>ESC</kbd></span>
        </div>
      </div>
    </div>
  );
}
