import React, { useState, useEffect } from 'react';

export default function CmsProductManager({ csrfToken }) {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(getEmptyProduct());
  const [saving, setSaving] = useState(false);

  function getEmptyProduct() {
    return {
      id: '',
      name: '',
      slug: '',
      sku: '',
      category: 'Machinery',
      price: '',
      image_url: '',
      gallery: [],
      description: '',
      status: 'Published'
    };
  }

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/cms.php?action=products_list&page=${page}&limit=12`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
        if (data.categories) setCategoryList(data.categories);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, categoryFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingId('');
    setForm(getEmptyProduct());
    setShowModal(true);
  };

  const handleOpenEdit = async (id) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cms.php?action=product_get&id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.product) {
        const p = data.product;
        let galleryArr = [];
        try {
          galleryArr = p.gallery_json ? JSON.parse(p.gallery_json) : [];
        } catch (e) {}

        setForm({
          id: p.id,
          name: p.name || '',
          slug: p.slug || '',
          sku: p.sku || '',
          category: p.category || 'Machinery',
          price: p.price || '',
          image_url: p.image_url || '',
          gallery: Array.isArray(galleryArr) ? galleryArr : [],
          description: p.description || '',
          status: p.status || 'Published'
        });
        setEditingId(p.id);
        setShowModal(true);
      }
    } catch (err) {
      alert('Error fetching product details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Product name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cms.php?action=product_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save product');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete product "${name}"?`)) return;
    try {
      const res = await fetch('/api/cms.php?action=product_delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchProducts();
      } else {
        alert(data.error || 'Failed to delete product');
      }
    } catch (err) {
      alert('Error deleting product');
    }
  };

  // Image Upload
  const handleUpload = async (e) => {
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
      setForm(prev => ({ ...prev, image_url: data.url }));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Product Catalog</h1>
          <p>Manage machinery specs, pricing, gallery photos, and stock status</p>
        </div>
        <div className="cms-section-actions">
          <button className="cms-btn cms-btn-primary" onClick={handleOpenCreate}>
            <span>🚜</span> Add New Product
          </button>
        </div>
      </div>

      <div className="cms-table-wrapper" style={{ marginBottom: '24px' }}>
        <div className="cms-table-toolbar">
          <div className="cms-table-search">
            <span className="cms-table-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, SKU, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
            />
          </div>

          <div className="cms-table-filters">
            <select
              className="cms-select"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Machinery Categories</option>
              {categoryList.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              className="cms-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
              <option value="Archived">Archived</option>
            </select>

            <button className="cms-btn cms-btn-secondary" onClick={fetchProducts}>
              Filter
            </button>
          </div>
        </div>

        <div className="cms-table-responsive">
          <table className="cms-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>Loading catalog...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No equipment matches search filters.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            style={{ width: '48px', height: '48px', objectFit: 'contain', background: 'var(--cms-bg)', borderRadius: '6px' }}
                          />
                        ) : (
                          <div style={{ width: '48px', height: '48px', background: 'var(--cms-card-border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            🚜
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--cms-text)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', fontFamily: 'var(--cms-font-mono)' }}>
                            /{p.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.78rem' }}>{p.sku || '—'}</code>
                    </td>
                    <td>
                      <span className="cms-badge cms-badge-muted">{p.category || 'General'}</span>
                    </td>
                    <td style={{ fontWeight: '700', color: 'var(--cms-primary)' }}>
                      {p.price ? `$${Number(p.price).toLocaleString()}` : 'Request Quote'}
                    </td>
                    <td>
                      <span className={`cms-badge cms-badge-${(p.status || 'published').toLowerCase()}`}>
                        {p.status || 'Published'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="cms-btn cms-btn-secondary cms-btn-sm"
                          onClick={() => handleOpenEdit(p.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="cms-btn cms-btn-danger cms-btn-sm"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cms-pagination">
          <div>Showing {products.length} of {total} products</div>
          <div className="cms-page-controls">
            <button
              className="cms-btn cms-btn-secondary cms-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span style={{ padding: '0 8px', fontWeight: '600' }}>Page {page} of {totalPages}</span>
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

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showModal && (
        <div className="cms-modal-backdrop">
          <div className="cms-modal cms-modal-lg" style={{ maxHeight: '90vh' }}>
            <div className="cms-modal-header">
              <h3>{editingId ? `Edit: ${form.name}` : 'Add New Equipment'}</h3>
              <button className="cms-btn-icon cms-btn-secondary" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="cms-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                  
                  <div>
                    <div className="cms-form-group">
                      <label>Equipment Model / Name *</label>
                      <input
                        type="text"
                        className="cms-input"
                        value={form.name}
                        onChange={(e) => {
                          setForm({ ...form, name: e.target.value });
                          if (!editingId && !form.slug) {
                            setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
                          }
                        }}
                        required
                        placeholder="e.g. 2025 TYPHON VIGOR 2.0 Electric Forklift"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="cms-form-group">
                        <label>SKU / Stock ID</label>
                        <input
                          type="text"
                          className="cms-input"
                          value={form.sku}
                          onChange={(e) => setForm({ ...form, sku: e.target.value })}
                          placeholder="e.g. TYPH-VIGOR20"
                        />
                      </div>
                      <div className="cms-form-group">
                        <label>Price (USD)</label>
                        <input
                          type="text"
                          className="cms-input"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          placeholder="e.g. 12500"
                        />
                      </div>
                    </div>

                    <div className="cms-form-group">
                      <label>Description & Specifications</label>
                      <textarea
                        className="cms-textarea"
                        style={{ minHeight: '160px' }}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe engine, lifting capacity, operating weight, and features..."
                      />
                    </div>
                  </div>

                  <div>
                    <div className="cms-form-group">
                      <label>Category</label>
                      <input
                        type="text"
                        className="cms-input"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="Forklifts, Mini Excavators, Loaders"
                      />
                    </div>

                    <div className="cms-form-group">
                      <label>Publication Status</label>
                      <select
                        className="cms-select"
                        style={{ width: '100%' }}
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                      >
                        <option value="Published">Published</option>
                        <option value="Draft">Draft</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>

                    <div className="cms-card" style={{ padding: '14px', marginTop: '14px' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '8px' }}>
                        Product Image
                      </label>
                      {form.image_url && (
                        <img
                          src={form.image_url}
                          alt=""
                          style={{ width: '100%', height: '120px', objectFit: 'contain', background: 'var(--cms-bg)', borderRadius: '6px', marginBottom: '8px' }}
                        />
                      )}
                      <input
                        type="text"
                        className="cms-input"
                        style={{ fontSize: '0.78rem', marginBottom: '8px' }}
                        placeholder="Image URL"
                        value={form.image_url}
                        onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      />
                      <label className="cms-btn cms-btn-secondary cms-btn-sm" style={{ width: '100%', cursor: 'pointer' }}>
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleUpload}
                        />
                      </label>
                    </div>
                  </div>

                </div>
              </div>
              <div className="cms-modal-footer">
                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cms-btn cms-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Equipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
