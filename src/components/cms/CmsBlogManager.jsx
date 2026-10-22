import React, { useState, useEffect, useRef } from 'react';

export default function CmsBlogManager({ csrfToken, editingPostId, onClearEditingId }) {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [showEditor, setShowEditor] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(getEmptyForm());
  const [slugStatus, setSlugStatus] = useState({ available: true, message: '' });
  const [saving, setSaving] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  function getEmptyForm() {
    return {
      id: '',
      title: '',
      slug: '',
      category: 'Guide',
      author: 'Admin KONSTRUCTZ',
      featured_image: '',
      excerpt: '',
      content: '',
      status: 'Draft',
      tags: '',
      published_date: new Date().toISOString().split('T')[0]
    };
  }

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/cms.php?action=categories_list');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {}
  };

  // Fetch Posts List
  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = `/api/cms.php?action=posts_list&page=${page}&limit=10`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts || []);
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
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [page, statusFilter, categoryFilter]);

  // Open editor if editingPostId is passed
  useEffect(() => {
    if (editingPostId) {
      handleEditPost(editingPostId);
      if (onClearEditingId) onClearEditingId();
    }
  }, [editingPostId]);

  // Check Slug Availability
  const checkSlugCollision = async (slugVal, postId) => {
    if (!slugVal) return;
    try {
      const res = await fetch(`/api/cms.php?action=check_slug&slug=${encodeURIComponent(slugVal)}&post_id=${encodeURIComponent(postId || '')}`);
      const data = await res.json();
      if (data.available) {
        setSlugStatus({ available: true, message: 'Slug is unique and ready' });
      } else {
        setSlugStatus({ available: false, message: `Collision: Suggested alternative is ${data.suggested}` });
      }
    } catch (err) {}
  };

  const handleEditPost = async (id) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cms.php?action=post_get&id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.post) {
        const p = data.post;
        const tagsArr = p.tags_json ? JSON.parse(p.tags_json) : [];
        setForm({
          id: p.id,
          title: p.title || '',
          slug: p.slug || '',
          category: p.category || 'Guide',
          author: p.author || 'Admin KONSTRUCTZ',
          featured_image: p.featured_image || '',
          excerpt: p.excerpt || '',
          content: p.content || '',
          status: p.status || 'Draft',
          tags: Array.isArray(tagsArr) ? tagsArr.join(', ') : '',
          published_date: p.published_date || new Date().toISOString().split('T')[0]
        });
        setRevisions(data.revisions || []);
        setIsEditing(true);
        setShowEditor(true);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      alert('Failed to load post for editing.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setForm(getEmptyForm());
    setIsEditing(false);
    setShowEditor(true);
    setHasUnsavedChanges(false);
  };

  const handleTitleChange = (val) => {
    setHasUnsavedChanges(true);
    const updated = { ...form, title: val };
    if (!isEditing && !form.slug) {
      const autoSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      updated.slug = autoSlug;
      checkSlugCollision(autoSlug, form.id);
    }
    setForm(updated);
  };

  const handleSavePost = async (targetStatus) => {
    if (!form.title.trim()) {
      alert('Please provide an article title.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        status: targetStatus || form.status,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch('/api/cms.php?action=post_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save post.');
      }

      setStatusMessage('Article successfully saved!');
      setHasUnsavedChanges(false);
      setTimeout(() => setStatusMessage(''), 3000);
      fetchPosts();
      if (!isEditing) {
        setShowEditor(false);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTrashPost = async (id) => {
    if (!confirm('Move this article to trash?')) return;
    try {
      const res = await fetch('/api/cms.php?action=post_trash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchPosts();
      }
    } catch (err) {
      alert('Failed to trash post.');
    }
  };

  const handleRestorePost = async (id) => {
    try {
      const res = await fetch('/api/cms.php?action=post_restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchPosts();
      }
    } catch (err) {
      alert('Failed to restore post.');
    }
  };

  const handleDeletePermanent = async (id) => {
    if (!confirm('PERMANENT DELETION: Are you sure? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/cms.php?action=post_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchPosts();
      }
    } catch (err) {
      alert('Failed to delete post.');
    }
  };

  const handleRestoreRevision = async (revId) => {
    if (!confirm('Revert this article to this revision snapshot?')) return;
    try {
      const res = await fetch('/api/cms.php?action=post_restore_revision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ revision_id: revId })
      });
      const data = await res.json();
      if (data.success) {
        alert('Post reverted to previous revision!');
        setShowRevisions(false);
        handleEditPost(form.id);
      }
    } catch (err) {
      alert('Failed to restore revision.');
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
        throw new Error(data.error || 'Upload failed');
      }
      setForm(prev => ({ ...prev, featured_image: data.url }));
      setHasUnsavedChanges(true);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      {/* SECTION HEADER */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Blog Administration</h1>
          <p>Create, edit, schedule, and moderate publication workflows</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-primary" onClick={handleCreateNew}>
            <span>✍️</span> Create New Article
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 16px', background: 'var(--cms-success-bg)', color: 'var(--cms-success)', borderRadius: 'var(--cms-radius-md)', marginBottom: '16px', fontWeight: '600' }}>
          ✓ {statusMessage}
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="cms-table-wrapper" style={{ marginBottom: '24px' }}>
        <div className="cms-table-toolbar">
          <div className="cms-table-search">
            <span className="cms-table-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by title, slug or summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPosts()}
            />
          </div>

          <div className="cms-table-filters">
            <select
              className="cms-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">Status: All Active</option>
              <option value="Published">Published</option>
              <option value="Draft">Drafts</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Archived">Archived</option>
              <option value="Trash">Trash (Soft-deleted)</option>
            </select>

            <select
              className="cms-select"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="">Category: All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <button className="cms-btn cms-btn-secondary" onClick={fetchPosts}>
              Filter
            </button>
          </div>
        </div>

        {/* POSTS TABLE */}
        <div className="cms-table-responsive">
          <table className="cms-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Category</th>
                <th>Author</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--cms-text-muted)' }}>
                    Loading articles...
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--cms-text-muted)' }}>
                    No matching articles found. Click "Create New Article" to write one.
                  </td>
                </tr>
              ) : (
                posts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {p.featured_image && (
                          <img
                            src={p.featured_image}
                            alt=""
                            style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                          />
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--cms-text)' }}>{p.title}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', fontFamily: 'var(--cms-font-mono)' }}>
                            /{p.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cms-badge cms-badge-muted">{p.category || 'Guide'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.84rem' }}>{p.author || 'Admin'}</span>
                    </td>
                    <td>
                      <span className={`cms-badge cms-badge-${(p.status || 'published').toLowerCase()}`}>
                        {p.status || 'Published'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--cms-text-muted)', whiteSpace: 'nowrap' }}>
                      {p.published_date || 'Draft'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {p.status === 'Trash' ? (
                          <>
                            <button
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              onClick={() => handleRestorePost(p.id)}
                            >
                              Restore
                            </button>
                            <button
                              className="cms-btn cms-btn-danger cms-btn-sm"
                              onClick={() => handleDeletePermanent(p.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              onClick={() => handleEditPost(p.id)}
                            >
                              Edit
                            </button>
                            <button
                              className="cms-btn cms-btn-danger cms-btn-sm"
                              onClick={() => handleTrashPost(p.id)}
                              title="Move to trash"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="cms-pagination">
          <div>
            Showing {posts.length} of {total} articles
          </div>
          <div className="cms-page-controls">
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span style={{ padding: '0 8px', fontWeight: '600' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* FULL ARTICLE EDITOR MODAL / SLIDEOUT */}
      {showEditor && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal cms-modal-lg" style={{ height: '90vh' }}>
            <div className="cms-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3>{isEditing ? `Edit: ${form.title || 'Untitled'}` : 'Create New Article'}</h3>
                {hasUnsavedChanges && (
                  <span style={{ fontSize: '0.74rem', background: 'var(--cms-warning-bg)', color: 'var(--cms-warning)', padding: '2px 8px', borderRadius: '4px' }}>
                    Unsaved edits
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isEditing && revisions.length > 0 && (
                  <button
                    className="cms-btn cms-btn-secondary cms-btn-sm"
                    onClick={() => setShowRevisions(true)}
                  >
                    🕒 Revisions ({revisions.length})
                  </button>
                )}
                <button
                  className="cms-btn cms-btn-secondary cms-btn-sm"
                  onClick={() => setShowPreview(true)}
                >
                  👁️ Preview
                </button>
                <button
                  className="cms-btn-icon cms-btn-secondary"
                  onClick={() => {
                    if (hasUnsavedChanges && !confirm('You have unsaved changes. Exit without saving?')) return;
                    setShowEditor(false);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="cms-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                
                {/* LEFT: CONTENT & HEADINGS */}
                <div>
                  <div className="cms-form-group">
                    <label>Article Title *</label>
                    <input
                      type="text"
                      className="cms-input"
                      style={{ fontSize: '1.1rem', fontWeight: '700' }}
                      value={form.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g. 5 Critical Maintenance Checks for Mini Excavators"
                      required
                    />
                  </div>

                  <div className="cms-form-group">
                    <label>URL Slug</label>
                    <input
                      type="text"
                      className="cms-input"
                      value={form.slug}
                      onChange={(e) => {
                        setForm({ ...form, slug: e.target.value });
                        setHasUnsavedChanges(true);
                        checkSlugCollision(e.target.value, form.id);
                      }}
                      placeholder="5-critical-maintenance-checks"
                    />
                    <div style={{ fontSize: '0.74rem', marginTop: '4px', color: slugStatus.available ? 'var(--cms-success)' : 'var(--cms-warning)' }}>
                      {slugStatus.message}
                    </div>
                  </div>

                  <div className="cms-form-group">
                    <label>Short Excerpt / Meta Description</label>
                    <textarea
                      className="cms-textarea"
                      style={{ minHeight: '70px' }}
                      value={form.excerpt}
                      onChange={(e) => { setForm({ ...form, excerpt: e.target.value }); setHasUnsavedChanges(true); }}
                      placeholder="Summary shown in blog listing and Google search snippets..."
                    />
                  </div>

                  <div className="cms-form-group">
                    <label>Full Content (Markdown or HTML format)</label>
                    <textarea
                      className="cms-textarea"
                      style={{ minHeight: '260px', fontFamily: 'var(--cms-font-mono)', fontSize: '0.85rem' }}
                      value={form.content}
                      onChange={(e) => { setForm({ ...form, content: e.target.value }); setHasUnsavedChanges(true); }}
                      placeholder="## Introduction&#10;&#10;Write detailed jobsite guidance, specifications, and operator tips..."
                    />
                  </div>
                </div>

                {/* RIGHT: METADATA & PUBLISHING CONTROLS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* PUBLISH STATUS BOX */}
                  <div className="cms-card" style={{ padding: '16px' }}>
                    <div className="cms-form-group" style={{ marginBottom: '12px' }}>
                      <label>Publication Status</label>
                      <select
                        className="cms-select"
                        style={{ width: '100%' }}
                        value={form.status}
                        onChange={(e) => { setForm({ ...form, status: e.target.value }); setHasUnsavedChanges(true); }}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>

                    <div className="cms-form-group" style={{ marginBottom: '12px' }}>
                      <label>Publication Date</label>
                      <input
                        type="date"
                        className="cms-input"
                        value={form.published_date}
                        onChange={(e) => { setForm({ ...form, published_date: e.target.value }); setHasUnsavedChanges(true); }}
                      />
                    </div>

                    <div className="cms-form-group" style={{ marginBottom: '0' }}>
                      <label>Category</label>
                      <select
                        className="cms-select"
                        style={{ width: '100%' }}
                        value={form.category}
                        onChange={(e) => { setForm({ ...form, category: e.target.value }); setHasUnsavedChanges(true); }}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* FEATURED IMAGE */}
                  <div className="cms-card" style={{ padding: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '8px' }}>
                      Featured Image
                    </label>
                    {form.featured_image ? (
                      <div style={{ position: 'relative', marginBottom: '10px' }}>
                        <img
                          src={form.featured_image}
                          alt="Preview"
                          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          className="cms-btn cms-btn-danger cms-btn-sm"
                          style={{ position: 'absolute', top: '6px', right: '6px' }}
                          onClick={() => setForm({ ...form, featured_image: '' })}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        height: '100px',
                        border: '2px dashed var(--cms-card-border)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--cms-text-subtle)',
                        fontSize: '0.8rem',
                        marginBottom: '10px'
                      }}>
                        No image selected
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="cms-input"
                        placeholder="Image URL or upload"
                        value={form.featured_image}
                        onChange={(e) => { setForm({ ...form, featured_image: e.target.value }); setHasUnsavedChanges(true); }}
                        style={{ fontSize: '0.78rem' }}
                      />
                      <label className="cms-btn cms-btn-secondary cms-btn-sm" style={{ cursor: 'pointer' }}>
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                  </div>

                  {/* AUTHOR & TAGS */}
                  <div className="cms-card" style={{ padding: '16px' }}>
                    <div className="cms-form-group">
                      <label>Author</label>
                      <input
                        type="text"
                        className="cms-input"
                        value={form.author}
                        onChange={(e) => { setForm({ ...form, author: e.target.value }); setHasUnsavedChanges(true); }}
                      />
                    </div>
                    <div className="cms-form-group" style={{ marginBottom: 0 }}>
                      <label>Tags (comma-separated)</label>
                      <input
                        type="text"
                        className="cms-input"
                        value={form.tags}
                        onChange={(e) => { setForm({ ...form, tags: e.target.value }); setHasUnsavedChanges(true); }}
                        placeholder="Excavator, Maintenance, Safety"
                      />
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="cms-modal-footer">
              <button
                type="button"
                className="cms-btn cms-btn-secondary"
                onClick={() => {
                  if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
                  setShowEditor(false);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="cms-btn cms-btn-secondary"
                disabled={saving}
                onClick={() => handleSavePost('Draft')}
              >
                Save as Draft
              </button>

              <button
                type="button"
                className="cms-btn cms-btn-primary"
                disabled={saving}
                onClick={() => handleSavePost('Published')}
              >
                {saving ? 'Publishing...' : 'Publish Article'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVISION HISTORY MODAL */}
      {showRevisions && (
        <div className="cms-modal-backdrop" style={{ zIndex: 110 }}>
          <div className="cms-modal" style={{ maxWidth: '500px' }}>
            <div className="cms-modal-header">
              <h3>Revision History</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowRevisions(false)}>✕</button>
            </div>
            <div className="cms-modal-body">
              <p style={{ fontSize: '0.84rem', color: 'var(--cms-text-muted)', marginTop: 0 }}>
                Automatic snapshots saved before previous updates:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {revisions.map((rev) => (
                  <div
                    key={rev.id}
                    style={{
                      padding: '12px',
                      border: '1px solid var(--cms-card-border)',
                      borderRadius: 'var(--cms-radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>{rev.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)' }}>
                        {new Date(rev.created_at * 1000).toLocaleString()}
                      </div>
                    </div>
                    <button
                      className="cms-btn cms-btn-secondary cms-btn-sm"
                      onClick={() => handleRestoreRevision(rev.id)}
                    >
                      Revert
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className="cms-modal-backdrop" style={{ zIndex: 110 }}>
          <div className="cms-modal cms-modal-lg" style={{ height: '85vh' }}>
            <div className="cms-modal-header">
              <h3>Live Public Preview</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowPreview(false)}>✕</button>
            </div>
            <div className="cms-modal-body" style={{ background: '#0b0f17', color: '#f3f4f6', padding: '32px' }}>
              <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                <span className="cms-badge cms-badge-warning" style={{ marginBottom: '12px' }}>{form.category}</span>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', lineHeight: 1.2, margin: '8px 0 14px' }}>{form.title || 'Untitled Post'}</h1>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px' }}>
                  By {form.author} · Published {form.published_date}
                </div>
                {form.featured_image && (
                  <img
                    src={form.featured_image}
                    alt=""
                    style={{ width: '100%', maxHeight: '380px', objectFit: 'cover', borderRadius: '12px', marginBottom: '24px' }}
                  />
                )}
                {form.excerpt && (
                  <p style={{ fontSize: '1.1rem', color: '#cbd5e1', fontStyle: 'italic', borderLeft: '4px solid var(--cms-primary)', paddingLeft: '16px', marginBottom: '24px' }}>
                    {form.excerpt}
                  </p>
                )}
                <div style={{ lineHeight: 1.7, fontSize: '1rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                  {form.content || 'No body content entered yet.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
