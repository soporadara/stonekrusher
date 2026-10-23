import React, { useState, useEffect } from 'react';

export default function CmsCategoryManager({ csrfToken }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [reassignModal, setReassignModal] = useState(false);
  const [catToDelete, setCatToDelete] = useState(null);
  const [targetCat, setTargetCat] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cms.php?action=categories_list');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenCreate = () => {
    setEditingCat(null);
    setName('');
    setSlug('');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCat(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const payload = {
        id: editingCat ? editingCat.id : '',
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim()
      };

      const res = await fetch('/api/cms.php?action=category_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchCategories();
      } else {
        alert(data.error || 'Failed to save category');
      }
    } catch (err) {
      alert('Error saving category');
    }
  };

  const handleDeleteClick = (cat) => {
    if (cat.post_count > 0) {
      setCatToDelete(cat);
      const otherCats = categories.filter(c => c.id !== cat.id);
      setTargetCat(otherCats.length > 0 ? otherCats[0].name : '');
      setReassignModal(true);
    } else {
      if (confirm(`Delete category "${cat.name}"?`)) {
        executeDelete(cat.id, '');
      }
    }
  };

  const executeDelete = async (id, reassignTo) => {
    try {
      const res = await fetch('/api/cms.php?action=category_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id, reassign_to: reassignTo })
      });
      const data = await res.json();
      if (data.success) {
        setReassignModal(false);
        fetchCategories();
      } else {
        alert(data.error || 'Failed to delete category');
      }
    } catch (err) {
      alert('Error deleting category');
    }
  };

  return (
    <div>
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Equipment & Blog Categories</h1>
          <p>Organize machinery fleet taxonomy, technical field guides, and article topics</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-primary" onClick={handleOpenCreate}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Category</span>
          </button>
        </div>
      </div>

      <div className="cms-table-wrapper">
        <div className="cms-table-responsive">
          <table className="cms-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Category Name</th>
                <th style={{ width: '18%' }}>URL Slug</th>
                <th style={{ width: '38%' }}>Description</th>
                <th style={{ width: '12%' }}>Assigned Articles</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--cms-text-muted)' }}>Loading categories...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--cms-text-muted)' }}>No categories created yet.</td></tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: '700', color: 'var(--cms-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cms-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                          <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.78rem', background: 'var(--cms-input-bg)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--cms-card-border)' }}>
                        /{cat.slug}
                      </code>
                    </td>
                    <td style={{ color: 'var(--cms-text-muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                      {cat.description || '—'}
                    </td>
                    <td>
                      <span className="cms-badge cms-badge-info" style={{ padding: '4px 10px' }}>
                        {cat.post_count || 0} Posts
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="cms-btn cms-btn-secondary cms-btn-sm"
                          onClick={() => handleOpenEdit(cat)}
                          title="Edit Category Details"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cms-btn cms-btn-danger cms-btn-sm"
                          onClick={() => handleDeleteClick(cat)}
                          title="Delete Category"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT CATEGORY MODAL */}
      {showModal && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal" style={{ maxWidth: '480px' }}>
            <div className="cms-modal-header">
              <h3>{editingCat ? 'Edit Category' : 'Create Category'}</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="cms-modal-body">
                <div className="cms-form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingCat && !slug) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }
                    }}
                    required
                    placeholder="e.g. Electric Forklifts"
                  />
                </div>
                <div className="cms-form-group">
                  <label>URL Slug</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="electric-forklifts"
                  />
                </div>
                <div className="cms-form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    className="cms-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description for category landing page and SEO..."
                  />
                </div>
              </div>
              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-primary">
                  {editingCat ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFE REASSIGNMENT BEFORE DELETION MODAL */}
      {reassignModal && catToDelete && (
        <div className="cms-modal-backdrop" style={{ zIndex: 120 }}>
          <div className="cms-modal" style={{ maxWidth: '500px' }}>
            <div className="cms-modal-header">
              <h3 style={{ color: 'var(--cms-warning)' }}>⚠️ Reassign Articles Before Deletion</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setReassignModal(false)}>✕</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: '0.88rem', lineHeight: 1.5, marginTop: 0 }}>
                Category <strong>"{catToDelete.name}"</strong> has <strong>{catToDelete.post_count}</strong> active article(s) assigned to it.
                To prevent orphan posts or broken links, select a destination category to reassign them to:
              </p>
              <div className="cms-form-group">
                <label>Reassign Articles To:</label>
                <select
                  className="cms-select"
                  style={{ width: '100%' }}
                  value={targetCat}
                  onChange={(e) => setTargetCat(e.target.value)}
                >
                  {categories.filter(c => c.id !== catToDelete.id).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="cms-modal-footer">
              <button className="cms-btn cms-btn-secondary" onClick={() => setReassignModal(false)}>
                Cancel
              </button>
              <button
                className="cms-btn cms-btn-danger"
                onClick={() => executeDelete(catToDelete.id, targetCat)}
              >
                Reassign & Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
