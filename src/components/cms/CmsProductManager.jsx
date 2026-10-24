import React, { useState, useEffect } from 'react';

export default function CmsProductManager({ csrfToken }) {
  // Navigation: 'list' | 'editor'
  const [subView, setSubView] = useState('list');

  // Products List state
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryList, setCategoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastNotice, setToastNotice] = useState('');
  const [metrics, setMetrics] = useState({ total: 0, published: 0, drafts: 0, low_stock: 0 });
  const [syncing, setSyncing] = useState(false);

  // Product Editor state
  const [editorId, setEditorId] = useState('');
  const [editorName, setEditorName] = useState('');
  const [editorSlug, setEditorSlug] = useState('');
  const [editorSku, setEditorSku] = useState('');
  const [editorBrand, setEditorBrand] = useState('StoneKrusher');
  const [editorCategory, setEditorCategory] = useState('Mini Excavators');
  const [editorPrice, setEditorPrice] = useState('');
  const [editorSalePrice, setEditorSalePrice] = useState('');
  const [editorStock, setEditorStock] = useState(5);
  const [editorStatus, setEditorStatus] = useState('Published');
  const [editorFeatured, setEditorFeatured] = useState(false);
  const [editorAddToCart, setEditorAddToCart] = useState(true);
  const [editorBuyUrl, setEditorBuyUrl] = useState('');
  const [editorShortDesc, setEditorShortDesc] = useState('');
  const [editorDesc, setEditorDesc] = useState('');
  const [editorImage, setEditorImage] = useState('');
  const [editorGallery, setEditorGallery] = useState('');
  const [editorSpecs, setEditorSpecs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/cms.php?action=products_list&page=${page}&limit=12`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (categoryFilter && categoryFilter !== 'all') url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (statusFilter && statusFilter !== 'all') url += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success) {
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
        if (Array.isArray(data.categories)) setCategoryList(data.categories);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch machinery products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subView === 'list') {
      fetchProducts();
    }
  }, [page, categoryFilter, statusFilter, subView]);

  const showToast = (msg) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 3200);
  };

  // Open Create SubView
  const handleOpenCreate = () => {
    setEditorId('');
    setEditorName('');
    setEditorSlug('');
    setEditorSku('SK-' + Math.random().toString(36).substring(2, 8).toUpperCase());
    setEditorBrand('StoneKrusher');
    setEditorCategory(categoryList[0] || 'Mini Excavators');
    setEditorPrice('');
    setEditorSalePrice('');
    setEditorStock(5);
    setEditorStatus('Published');
    setEditorFeatured(false);
    setEditorAddToCart(true);
    setEditorBuyUrl('');
    setEditorShortDesc('');
    setEditorDesc('');
    setEditorImage('');
    setEditorGallery('');
    setEditorSpecs([
      { name: 'Engine Model', value: 'Yanmar 3TNV74F Diesel' },
      { name: 'Operating Weight', value: '2,200 lbs (1,000 kg)' },
      { name: 'Bucket Capacity', value: '0.025 m³' },
      { name: 'Max Digging Depth', value: '65 inches (1,650 mm)' }
    ]);
    setSubView('editor');
  };

  // Open Edit SubView
  const handleOpenEdit = async (prod) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cms.php?action=product_get&id=${encodeURIComponent(prod.id)}`);
      const data = await res.json();
      const p = (data && data.success && data.product) ? data.product : prod;

      let galleryLines = '';
      if (Array.isArray(p.gallery)) {
        galleryLines = p.gallery.join('\n');
      } else if (typeof p.gallery_json === 'string') {
        try {
          const arr = JSON.parse(p.gallery_json);
          galleryLines = Array.isArray(arr) ? arr.join('\n') : '';
        } catch (e) {
          galleryLines = '';
        }
      }

      let specsArr = [];
      if (Array.isArray(p.specs)) {
        specsArr = p.specs;
      } else if (typeof p.specs_json === 'string') {
        try {
          const parsed = JSON.parse(p.specs_json);
          specsArr = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          specsArr = [];
        }
      }

      // If specs is an object like { "Engine": "Yanmar" } convert to array of { name, value }
      if (!Array.isArray(specsArr) && typeof specsArr === 'object' && specsArr !== null) {
        specsArr = Object.entries(specsArr).map(([k, v]) => ({ name: k, value: String(v) }));
      }

      setEditorId(p.id);
      setEditorName(p.name || '');
      setEditorSlug(p.slug || '');
      setEditorSku(p.sku || '');
      setEditorBrand(p.brand || 'StoneKrusher');
      setEditorCategory(p.category || 'Machinery');
      setEditorPrice(p.price || '');
      setEditorSalePrice(p.sale_price || '');
      setEditorStock(p.stock !== undefined ? p.stock : 1);
      setEditorStatus(p.status || 'Published');
      setEditorFeatured(p.featured === 1 || p.featured === true);
      setEditorAddToCart(p.add_to_cart !== 0 && p.add_to_cart !== false);
      setEditorBuyUrl(p.buy_url || '');
      setEditorShortDesc(p.short_description || '');
      setEditorDesc(p.description || '');
      setEditorImage(p.image_url || '');
      setEditorGallery(galleryLines);
      setEditorSpecs(Array.isArray(specsArr) && specsArr.length > 0 ? specsArr : [
        { name: 'Engine Model', value: '' },
        { name: 'Operating Weight', value: '' }
      ]);

      setSubView('editor');
    } catch (err) {
      alert('Error fetching full product details.');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Toggle Status (Published ↔ Draft)
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const res = await fetch('/api/cms.php?action=product_toggle_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast(`Status changed to ${data.status}`);
        fetchProducts();
      } else {
        alert(data.error || 'Failed to toggle status.');
      }
    } catch (err) {
      alert('Network error while toggling status.');
    }
  };

  // Duplicate product
  const handleDuplicate = async (id) => {
    try {
      const res = await fetch('/api/cms.php?action=product_duplicate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('Product cloned as Draft!');
        fetchProducts();
      } else {
        alert(data.error || 'Failed to duplicate product.');
      }
    } catch (err) {
      alert('Error duplicating product.');
    }
  };

  // Delete product
  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
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
      if (data && data.success) {
        showToast('Product deleted.');
        fetchProducts();
      } else {
        alert(data.error || 'Failed to delete product.');
      }
    } catch (err) {
      alert('Error deleting product.');
    }
  };

  // Sync / Seed Catalog from JSON
  const handleSyncCatalog = async () => {
    if (!confirm('Sync full equipment catalog (139 machinery items)? Existing products will not be overwritten.')) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/cms.php?action=products_seed_sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ force: false })
      });
      const data = await res.json();
      if (data && data.success) {
        showToast(data.message || `Catalog synced! Added ${data.inserted} products.`);
        fetchProducts();
      } else {
        alert(data.error || 'Failed to sync catalog.');
      }
    } catch (err) {
      alert('Error connecting to catalog sync service.');
    } finally {
      setSyncing(false);
    }
  };

  // Save product from editor
  const handleSaveProduct = async (targetStatus) => {
    const finalStatus = targetStatus || editorStatus;

    if (!editorName.trim()) {
      alert('Please enter a product title.');
      return;
    }

    setSaving(true);
    try {
      const galleryArr = editorGallery
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const payload = {
        id: editorId,
        name: editorName,
        slug: editorSlug,
        sku: editorSku,
        brand: editorBrand,
        category: editorCategory,
        price: editorPrice,
        sale_price: editorSalePrice || null,
        stock: editorStock,
        status: finalStatus,
        featured: editorFeatured ? 1 : 0,
        add_to_cart: editorAddToCart ? 1 : 0,
        buy_url: editorBuyUrl,
        short_description: editorShortDesc,
        description: editorDesc,
        image_url: editorImage,
        gallery: galleryArr,
        specs: editorSpecs.filter(s => s.name && s.name.trim())
      };

      const res = await fetch('/api/cms.php?action=product_save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save product');
      }

      showToast(`Product ${finalStatus === 'Published' ? 'published' : 'saved as draft'}!`);
      setSubView('list');
      fetchProducts();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Image Upload handler
  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
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
      setEditorImage(data.url);
      showToast('Image uploaded successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Spec row helpers
  const handleAddSpecRow = (presetName = '', presetVal = '') => {
    setEditorSpecs(prev => [...prev, { name: presetName, value: presetVal }]);
  };

  const handleUpdateSpecRow = (idx, field, val) => {
    setEditorSpecs(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleRemoveSpecRow = (idx) => {
    setEditorSpecs(prev => prev.filter((_, i) => i !== idx));
  };

  // =========================================================================
  // RENDER: 2-COLUMN PRODUCT EDITOR (Matching HappyMachinery)
  // =========================================================================
  if (subView === 'editor') {
    return (
      <div className="cms-product-editor-container">
        {/* Top Bar Navigation */}
        <div className="cms-editor-top-nav">
          <button
            type="button"
            className="cms-back-btn"
            onClick={() => setSubView('list')}
          >
            <span>←</span>
            <span>BACK TO PRODUCTS</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={`cms-status-btn-pill ${editorStatus === 'Published' ? 'published' : 'draft'}`}>
              <span className="cms-status-dot" />
              <span>{editorStatus}</span>
            </span>
            <button
              type="button"
              className="cms-btn cms-btn-primary cms-prod-publish-btn"
              onClick={() => handleSaveProduct(editorStatus)}
              disabled={saving}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{saving ? 'SAVING...' : 'SAVE CHANGES'}</span>
            </button>
          </div>
        </div>

        <div className="cms-editor-h1-row">
          <h1>{editorId ? `EDIT: ${editorName || 'Product'}` : 'CREATE PRODUCT'}</h1>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="cms-prod-editor-grid">
          {/* LEFT COLUMN: Main Product Content */}
          <div className="cms-editor-left-column">
            {/* Basic Information Card */}
            <div className="cms-editor-card">
              <div className="cms-form-field-group">
                <label className="cms-form-label">PRODUCT TITLE *</label>
                <input
                  type="text"
                  className="cms-input-text"
                  placeholder="e.g. 2026 TYPHON STOMP-V980 Skid Steer Loader"
                  value={editorName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditorName(val);
                    if (!editorId && (!editorSlug || editorSlug === editorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, editorSlug.length))) {
                      setEditorSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                    }
                  }}
                  required
                />
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">URL SLUG</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--cms-text-subtle)' }}>stonekrusher.com/equipment/</span>
                  <input
                    type="text"
                    className="cms-input-text"
                    placeholder="typhon-stomp-v980"
                    value={editorSlug}
                    onChange={(e) => setEditorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
                  />
                </div>
              </div>

              <div className="cms-form-field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="cms-form-label">SHORT DESCRIPTION</label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>{editorShortDesc.length}/300 chars</span>
                </div>
                <textarea
                  rows={3}
                  className="cms-textarea"
                  placeholder="Brief machine summary displayed on catalog cards, comparison tables, and search snippets..."
                  value={editorShortDesc}
                  onChange={(e) => setEditorShortDesc(e.target.value)}
                  maxLength={300}
                />
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">FULL DESCRIPTION</label>
                <textarea
                  rows={8}
                  className="cms-textarea"
                  placeholder="Comprehensive equipment overview, hydraulic capabilities, boom geometries, cab comfort, and jobsite applications..."
                  value={editorDesc}
                  onChange={(e) => setEditorDesc(e.target.value)}
                />
              </div>
            </div>

            {/* Specifications Matrix Card */}
            <div className="cms-editor-card">
              <div className="cms-editor-card-title">
                <span>SPECIFICATIONS MATRIX</span>
                <button
                  type="button"
                  className="cms-action-pill-btn"
                  onClick={() => handleAddSpecRow()}
                >
                  <span>+</span>
                  <span>ADD SPEC</span>
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--cms-text-subtle)', alignSelf: 'center', marginRight: '4px' }}>Quick Presets:</span>
                {[
                  { name: 'Engine Model', val: 'Kubota D1105 / Yanmar' },
                  { name: 'Operating Weight', val: '2,425 lbs' },
                  { name: 'Bucket Capacity', val: '0.03 m³' },
                  { name: 'Max Dig Depth', val: '68 in' },
                  { name: 'Hydraulic Flow', val: '18 L/min @ 16 MPa' }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    style={{
                      background: 'var(--cms-bg, #f8fafc)',
                      border: '1px solid var(--cms-card-border, #e2e8f0)',
                      borderRadius: '9999px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--cms-text)'
                    }}
                    onClick={() => handleAddSpecRow(preset.name, preset.val)}
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>

              {editorSpecs.length === 0 ? (
                <div className="cms-no-specs-notice">
                  <span>No specifications added yet.</span>
                  <button
                    type="button"
                    className="cms-action-pill-btn"
                    style={{ fontSize: '0.82rem', padding: '7px 16px' }}
                    onClick={() => handleAddSpecRow('Engine Model', 'Kubota Diesel')}
                  >
                    <span>+</span>
                    <span>Add First Specification</span>
                  </button>
                </div>
              ) : (
                <div className="cms-specs-matrix-box">
                  {editorSpecs.map((spec, index) => (
                    <div key={index} className="cms-spec-item-row">
                      <input
                        type="text"
                        placeholder="Spec Name (e.g. Engine Model)"
                        value={spec.name}
                        onChange={(e) => handleUpdateSpecRow(index, 'name', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Spec Value (e.g. Kubota D1105 Diesel)"
                        value={spec.value}
                        onChange={(e) => handleUpdateSpecRow(index, 'value', e.target.value)}
                      />
                      <button
                        type="button"
                        className="cms-spec-del-btn"
                        onClick={() => handleRemoveSpecRow(index)}
                        title="Remove specification"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pricing & Inventory Card */}
            <div className="cms-editor-card">
              <div className="cms-editor-card-title">
                <span>PRICING & INVENTORY</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="cms-form-label">REGULAR PRICE ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="cms-input-text"
                    placeholder="11950.00"
                    value={editorPrice}
                    onChange={(e) => setEditorPrice(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="cms-form-label">SALE PRICE ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="cms-input-text"
                    placeholder="Optional discounted price (e.g. 10800.00)"
                    value={editorSalePrice}
                    onChange={(e) => setEditorSalePrice(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="cms-form-label">STOCK QUANTITY</label>
                  <input
                    type="number"
                    className="cms-input-text"
                    placeholder="5"
                    value={editorStock}
                    onChange={(e) => setEditorStock(parseInt(e.target.value, 10) || 0)}
                  />
                </div>

                <div>
                  <label className="cms-form-label">SKU / STOCK ID *</label>
                  <input
                    type="text"
                    className="cms-input-text"
                    placeholder="TYPH-STOMP-V980"
                    value={editorSku}
                    onChange={(e) => setEditorSku(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar Controls */}
          <div className="cms-editor-right-column">
            {/* Publish Action Card */}
            <div className="cms-editor-card">
              <button
                type="button"
                className="cms-btn cms-btn-primary cms-prod-publish-btn"
                onClick={() => handleSaveProduct('Published')}
                disabled={saving}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>{saving && editorStatus === 'Published' ? 'PUBLISHING...' : 'PUBLISH PRODUCT'}</span>
              </button>

              <div className="cms-form-field-group">
                <label className="cms-form-label">VISIBILITY STATUS</label>
                <select
                  className="cms-input-text"
                  value={editorStatus}
                  onChange={(e) => setEditorStatus(e.target.value)}
                >
                  <option value="Published">Publish immediately (Published)</option>
                  <option value="Draft">Save as Draft (Hidden)</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <button
                type="button"
                className="cms-btn cms-btn-secondary cms-prod-draft-btn"
                onClick={() => handleSaveProduct('Draft')}
                disabled={saving}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>{saving && editorStatus === 'Draft' ? 'Saving Draft...' : 'Save as Draft'}</span>
              </button>
            </div>

            {/* Organization Card */}
            <div className="cms-editor-card">
              <div className="cms-editor-card-title">
                <span>ORGANIZATION</span>
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">BRAND</label>
                <input
                  type="text"
                  className="cms-input-text"
                  placeholder="StoneKrusher / TYPHON / KUBOTA"
                  value={editorBrand}
                  onChange={(e) => setEditorBrand(e.target.value)}
                />
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">CATEGORY</label>
                <select
                  className="cms-input-text"
                  value={editorCategory}
                  onChange={(e) => setEditorCategory(e.target.value)}
                >
                  {categoryList.length > 0 ? (
                    categoryList.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))
                  ) : (
                    <>
                      <option value="Mini Excavators">Mini Excavators</option>
                      <option value="Skid Steers">Skid Steers</option>
                      <option value="Wheel Loaders">Wheel Loaders</option>
                      <option value="Track Dumpers">Track Dumpers</option>
                      <option value="Forklifts">Forklifts</option>
                      <option value="Crushers">Crushers</option>
                      <option value="Attachments">Attachments</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* External Link Card */}
            <div className="cms-editor-card">
              <div className="cms-editor-card-title">
                <span>EXTERNAL STORE / CHECKOUT</span>
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">BUY ON STORE / CHECKOUT URL</label>
                <input
                  type="text"
                  className="cms-input-text"
                  placeholder="https://stonekrusher.com/checkout?model=stomp-v980"
                  value={editorBuyUrl}
                  onChange={(e) => setEditorBuyUrl(e.target.value)}
                />
              </div>
            </div>

            {/* Visibility & Status Card */}
            <div className="cms-editor-card">
              <div className="cms-editor-card-title">
                <span>STOREFRONT HIGHLIGHTS</span>
              </div>

              <label className="cms-checkbox-label">
                <input
                  type="checkbox"
                  checked={editorFeatured}
                  onChange={(e) => setEditorFeatured(e.target.checked)}
                />
                <span>Feature this product in store highlights</span>
              </label>

              <label className="cms-checkbox-label">
                <input
                  type="checkbox"
                  checked={editorAddToCart}
                  onChange={(e) => setEditorAddToCart(e.target.checked)}
                />
                <span>Enable Add to Cart for customers</span>
              </label>
            </div>

            {/* Media Card */}
            <div className="cms-editor-card">
              <div className="cms-editor-card-title">
                <span>MEDIA & PHOTOS</span>
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">MAIN IMAGE URL</label>
                <input
                  type="text"
                  className="cms-input-text"
                  placeholder="https://img.miniexcavator.org/ebay/...webp"
                  value={editorImage}
                  onChange={(e) => setEditorImage(e.target.value)}
                />

                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <label className="cms-btn cms-btn-secondary cms-btn-sm" style={{ cursor: 'pointer', flex: 1, textAlign: 'center' }}>
                    {uploading ? 'Uploading...' : '📁 Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleUploadPhoto}
                      disabled={uploading}
                    />
                  </label>
                  {editorImage && (
                    <button
                      type="button"
                      className="cms-btn cms-btn-secondary cms-btn-sm"
                      onClick={() => setEditorImage('')}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {editorImage && (
                  <div className="cms-live-media-preview-container" style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>Main Image Preview:</span>
                    <div className="cms-main-preview-frame">
                      <img
                        src={editorImage}
                        alt="Main Preview"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="cms-form-field-group">
                <label className="cms-form-label">GALLERY IMAGES (ONE URL PER LINE)</label>
                <textarea
                  rows={4}
                  className="cms-textarea"
                  placeholder="https://img.miniexcavator.org/ebay/img1.webp&#10;https://img.miniexcavator.org/ebay/img2.webp"
                  value={editorGallery}
                  onChange={(e) => setEditorGallery(e.target.value)}
                />

                {editorGallery.trim() && (
                  <div className="cms-live-media-preview-container" style={{ marginTop: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--cms-text-muted)' }}>Gallery Preview:</span>
                    <div className="cms-gallery-thumbnails-strip">
                      {editorGallery.split('\n').filter(Boolean).map((imgUrl, i) => (
                        <div key={i} className="cms-gallery-thumb-chip">
                          <img
                            src={imgUrl.trim()}
                            alt={`Gallery ${i}`}
                            onError={(e) => { e.target.style.opacity = '0.3'; }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: PRODUCTS LIST VIEW (Matching HappyMachinery)
  // =========================================================================
  return (
    <div className="cms-catalog-view-container">
      {/* Top Breadcrumb Bar */}
      <div className="cms-view-breadcrumb-bar">
        <span>Dashboard</span>
        <span>›</span>
        <span>Products</span>
        <span>›</span>
        <span className="active">All Products</span>
      </div>

      {/* Header Title Row */}
      <div className="cms-catalog-title-row">
        <div>
          <h1 className="cms-catalog-h1">All Products</h1>
          <p className="cms-catalog-subtext">
            {metrics.total || total} total • {metrics.published || 0} published • {metrics.drafts || 0} drafts • {metrics.low_stock || 0} low stock
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {(metrics.total === 0 || total === 0) && (
            <button
              type="button"
              className="cms-btn cms-btn-secondary"
              onClick={handleSyncCatalog}
              disabled={syncing}
              title="Populate catalog with 139 StoneKrusher equipment items"
            >
              <span>🔄</span> {syncing ? 'Syncing...' : 'Sync Catalog (139 Equipment)'}
            </button>
          )}

          <button
            type="button"
            className="cms-btn cms-btn-primary"
            onClick={handleOpenCreate}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 4 Product Metric Cards */}
      <div className="cms-prod-metrics-grid">
        <div
          className={`cms-prod-metric-card total ${statusFilter === 'all' && !search ? 'active' : ''}`}
          onClick={() => { setStatusFilter('all'); setSearch(''); setPage(1); }}
        >
          <div className="cms-prod-metric-top">
            <span className="cms-pm-label">Total Products</span>
            <div className="cms-pm-icon total">🚜</div>
          </div>
          <span className="cms-pm-value">{metrics.total || total}</span>
          <span className="cms-pm-sub">Complete store inventory</span>
        </div>

        <div
          className={`cms-prod-metric-card published ${statusFilter === 'published' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('published'); setPage(1); }}
        >
          <div className="cms-prod-metric-top">
            <span className="cms-pm-label">Published</span>
            <div className="cms-pm-icon published">✓</div>
          </div>
          <span className="cms-pm-value">{metrics.published || 0}</span>
          <span className="cms-pm-sub">Live in catalog & store</span>
        </div>

        <div
          className={`cms-prod-metric-card drafts ${statusFilter === 'draft' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('draft'); setPage(1); }}
        >
          <div className="cms-prod-metric-top">
            <span className="cms-pm-label">Drafts</span>
            <div className="cms-pm-icon drafts">📄</div>
          </div>
          <span className="cms-pm-value">{metrics.drafts || 0}</span>
          <span className="cms-pm-sub">Draft catalog listings</span>
        </div>

        <div
          className={`cms-prod-metric-card lowstock ${statusFilter === 'low-stock' ? 'active' : ''}`}
          onClick={() => { setStatusFilter('low-stock'); setPage(1); }}
        >
          <div className="cms-prod-metric-top">
            <span className="cms-pm-label">Low Stock</span>
            <div className="cms-pm-icon lowstock">⚠️</div>
          </div>
          <span className="cms-pm-value">{metrics.low_stock || 0}</span>
          <span className="cms-pm-sub">Units with stock ≤ 2</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="cms-products-filter-toolbar">
        <div className="cms-filter-search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by product name, SKU, brand, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchProducts(); }}
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); fetchProducts(); }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <select
          className="cms-filter-dropdown-select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
          <option value="low-stock">Low Stock (≤ 2)</option>
        </select>

        <select
          className="cms-filter-dropdown-select"
          style={{ maxWidth: '240px' }}
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Categories</option>
          {categoryList.map((cat, idx) => (
            <option key={idx} value={cat}>{cat}</option>
          ))}
        </select>

        {(search || statusFilter !== 'all' || categoryFilter !== 'all') && (
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--cms-primary, #607a4e)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setCategoryFilter('all');
              setPage(1);
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="cms-table-wrapper">
          <table className="cms-prod-table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>SKU</th>
                <th>CATEGORY</th>
                <th>PRICE</th>
                <th>STOCK</th>
                <th>STATUS</th>
                <th>ADD TO CART</th>
                <th>UPDATED</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--cms-text-muted)' }}>
                    Loading equipment catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ fontSize: '38px' }}>🚜</div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cms-text)' }}>No machinery equipment found</h4>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--cms-text-muted)' }}>
                        {search || statusFilter !== 'all' || categoryFilter !== 'all'
                          ? 'No products match your selected filters. Try resetting search.'
                          : 'Your catalog is currently empty. Click below to seed all 139 equipment listings!'}
                      </p>
                      {metrics.total === 0 && (
                        <button
                          type="button"
                          className="cms-btn cms-btn-primary"
                          style={{ marginTop: '12px' }}
                          onClick={handleSyncCatalog}
                          disabled={syncing}
                        >
                          🔄 {syncing ? 'Syncing 139 Products...' : 'Populate 139 Equipment Listings'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((prod) => {
                  const regPrice = prod.price ? Number(prod.price) : 0;
                  const salePrice = prod.sale_price ? Number(prod.sale_price) : 0;
                  const stockNum = prod.stock !== undefined ? Number(prod.stock) : 0;

                  return (
                    <tr key={prod.id}>
                      <td>
                        <div className="cms-prod-thumb-cell">
                          <div className="cms-prod-img-box">
                            {prod.image_url ? (
                              <img
                                src={prod.image_url}
                                alt={prod.name}
                                onError={(e) => { e.target.style.opacity = '0.3'; }}
                              />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.2rem' }}>
                                🚜
                              </div>
                            )}
                          </div>
                          <div className="cms-prod-title-group">
                            <button
                              type="button"
                              className="cms-prod-name-title"
                              onClick={() => handleOpenEdit(prod)}
                              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                              title={prod.name}
                            >
                              {prod.name}
                            </button>
                            <span className="cms-prod-sub-snippet">
                              {prod.short_description || (prod.description ? prod.description.slice(0, 60) + '...' : `/${prod.slug}`)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="cms-sku-badge">{prod.sku || '—'}</span>
                      </td>
                      <td>
                        <span className="cms-category-pill" title={prod.category}>
                          {prod.category || 'General'}
                        </span>
                      </td>
                      <td>
                        <div className="cms-price-stack">
                          {salePrice > 0 ? (
                            <>
                              <span className="cms-sale-price-bold">
                                ${salePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {regPrice > 0 && (
                                <span className="cms-regular-price-struck">
                                  ${regPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </>
                          ) : regPrice > 0 ? (
                            <span className="cms-sale-price-bold">
                              ${regPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--cms-text-subtle)' }}>
                              Request Quote
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`cms-stock-pill ${stockNum > 2 ? 'in-stock' : stockNum > 0 ? 'low-stock' : 'out-stock'}`}>
                          <span className="cms-stock-dot" />
                          <span>{stockNum}</span>
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`cms-status-btn-pill ${prod.status === 'Published' ? 'published' : 'draft'}`}
                          onClick={() => handleToggleStatus(prod.id, prod.status)}
                          title="Click to toggle Published / Draft"
                        >
                          <span className="cms-status-dot" />
                          <span>{prod.status || 'Published'}</span>
                        </button>
                      </td>
                      <td>
                        <span className={`cms-cart-badge-pill ${prod.add_to_cart !== 0 ? 'enabled' : 'disabled'}`}>
                          {prod.add_to_cart !== 0 ? '✓ Enabled' : '✕ Disabled'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--cms-text-muted)', whiteSpace: 'nowrap' }}>
                        {prod.updated_at ? new Date(prod.updated_at * 1000).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="cms-table-action-btns">
                          <button
                            type="button"
                            className="cms-action-btn-modern edit"
                            onClick={() => handleOpenEdit(prod)}
                            title="Edit Equipment Details"
                          >
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="cms-action-btn-modern copy"
                            onClick={() => handleDuplicate(prod.id)}
                            title="Clone as Draft"
                          >
                            <span>Clone</span>
                          </button>
                          <button
                            type="button"
                            className="cms-action-btn-modern copy"
                            onClick={() => {
                              const publicUrl = `${window.location.origin}/#catalog`;
                              navigator.clipboard.writeText(publicUrl);
                              showToast(`Link for "${prod.name}" copied!`);
                            }}
                            title="Copy store link"
                          >
                            <span>Link</span>
                          </button>
                          <button
                            type="button"
                            className="cms-action-btn-modern danger"
                            onClick={() => handleDelete(prod.id, prod.name)}
                            title="Delete equipment"
                          >
                            <span>✕</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="cms-pagination-bar">
            <span className="cms-pagination-info">
              Showing {products.length === 0 ? 0 : (page - 1) * 12 + 1} to{' '}
              {Math.min(page * 12, total)} of {total} products
            </span>

            <div className="cms-pagination-controls">
              <button
                type="button"
                className="cms-page-pill-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <span>←</span>
                <span>Prev</span>
              </button>
              <span className="cms-page-number">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="cms-page-pill-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <span>Next</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Toast Notice */}
      {toastNotice && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          background: 'var(--cms-primary, #607a4e)',
          color: '#ffffff',
          padding: '12px 22px',
          borderRadius: '9999px',
          fontWeight: 700,
          fontSize: '0.88rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✔</span> {toastNotice}
        </div>
      )}
    </div>
  );
}
