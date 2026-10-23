import React, { useState, useEffect, useRef } from 'react';
import CmsMediaLibrary from './CmsMediaLibrary';

function sanitizeHtml(html = '') {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"]?)\s*javascript:[^"'\s>]*/gi, '$1=$2#')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
}

function safeIsoDate(val) {
  if (!val) return '';
  try {
    const num = Number(val);
    const d = !isNaN(num) && num > 0
      ? (num < 1e11 ? new Date(num * 1000) : new Date(num))
      : new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

export default function CmsBlogManager({ csrfToken, editingPostId, onClearEditingId, initialStatusFilter = '' }) {
  // Navigation / View state
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor Form state
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(getEmptyForm());
  const [slugStatus, setSlugStatus] = useState({ available: true, message: '' });
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState('draft'); // 'draft' | 'published' | 'scheduled'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [toastNotice, setToastNotice] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorTab, setEditorTab] = useState('visual'); // 'visual' | 'source' | 'preview'
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState('featured'); // 'featured' | 'editor'
  const [revisions, setRevisions] = useState([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const visualEditorRef = useRef(null);

  function getEmptyForm() {
    return {
      id: '',
      title: '',
      slug: '',
      category: 'Guide',
      author: 'Admin KONSTRUCTZ',
      featured_image: '',
      cover_image_alt: '',
      excerpt: '',
      content: '',
      status: 'Draft',
      scheduled_at: '',
      video_url: '',
      meta_title: '',
      meta_description: '',
      tags: '',
      published_date: new Date().toISOString().split('T')[0]
    };
  }

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/cms.php?action=categories_list');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategories([]);
    }
  };

  // Fetch Posts List
  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = `/api/cms.php?action=posts_list&page=${page}&limit=12`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (categoryFilter) url += `&category=${encodeURIComponent(categoryFilter)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.posts)) {
        setPosts(data.posts);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
      } else {
        setPosts([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to fetch blog posts:', err);
      setPosts([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (view === 'list') {
      fetchPosts();
    }
  }, [page, statusFilter, categoryFilter, view]);

  // Open editor if editingPostId is passed
  useEffect(() => {
    if (editingPostId) {
      handleEditPost(editingPostId);
      if (onClearEditingId) onClearEditingId();
    }
  }, [editingPostId]);

  // Synchronize visual editor DOM when entering visual mode or loading an article
  useEffect(() => {
    if (view === 'editor' && editorTab === 'visual' && visualEditorRef.current) {
      if (visualEditorRef.current.innerHTML !== (form.content || '')) {
        visualEditorRef.current.innerHTML = form.content || '';
      }
    }
  }, [view, editorTab, form.id]);

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
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNew = () => {
    setForm(getEmptyForm());
    setIsEditing(false);
    setView('editor');
    setEditorTab('visual');
    setHasUnsavedChanges(false);
    setErrorMessage('');
    setSlugStatus({ available: true, message: '' });
  };

  const handleEditPost = async (id) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cms.php?action=post_get&id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.post) {
        const p = data.post;
        let tagsArr = [];
        try {
          tagsArr = p.tags_json ? JSON.parse(p.tags_json) : [];
        } catch {
          tagsArr = [];
        }
        let parsedData = {};
        try {
          parsedData = p.data_json ? JSON.parse(p.data_json) : {};
        } catch {
          parsedData = {};
        }

        setForm({
          id: p.id,
          title: p.title || '',
          slug: p.slug || '',
          category: p.category || 'Guide',
          author: p.author || 'Admin KONSTRUCTZ',
          featured_image: p.featured_image || '',
          cover_image_alt: parsedData.cover_image_alt || '',
          excerpt: p.excerpt || '',
          content: p.content || '',
          status: p.status || 'Draft',
          scheduled_at: safeIsoDate(p.scheduled_at),
          video_url: parsedData.video_url || '',
          meta_title: parsedData.meta_title || '',
          meta_description: parsedData.meta_description || '',
          tags: Array.isArray(tagsArr) ? tagsArr.join(', ') : '',
          published_date: p.published_date || new Date().toISOString().split('T')[0]
        });
        setRevisions(Array.isArray(data.revisions) ? data.revisions : []);
        setIsEditing(true);
        setView('editor');
        setEditorTab('visual');
        setHasUnsavedChanges(false);
        setErrorMessage('');
      }
    } catch (err) {
      alert('Failed to load article for editing.');
    } finally {
      setLoading(false);
    }
  };

  const handleTitleChange = (val) => {
    setHasUnsavedChanges(true);
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setForm(prev => {
      const updated = { ...prev, title: val };
      if (!isEditing && (!prev.slug || prev.slug === autoSlug.slice(0, prev.slug.length))) {
        updated.slug = autoSlug;
        checkSlugCollision(autoSlug, prev.id);
      }
      return updated;
    });
  };

  const handleSavePost = async (targetStatus) => {
    const finalStatus = targetStatus || form.status;
    setActionType(finalStatus);
    setErrorMessage('');

    if (!form.title.trim()) {
      setErrorMessage('Please provide an article title before saving.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        status: finalStatus,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        scheduled_at: form.scheduled_at ? Math.floor(new Date(form.scheduled_at).getTime() / 1000) : null
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
        throw new Error(data.error || 'Failed to save article.');
      }

      setStatusMessage(finalStatus === 'Published' ? 'Article published successfully!' : 'Draft saved successfully!');
      setHasUnsavedChanges(false);
      setTimeout(() => setStatusMessage(''), 3500);
      fetchPosts();

      if (!isEditing && data.post && data.post.id) {
        setForm(prev => ({ ...prev, id: data.post.id }));
        setIsEditing(true);
      }
    } catch (err) {
      setErrorMessage(err.message);
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
      alert('Failed to move article to trash.');
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
      alert('Failed to restore article.');
    }
  };

  const handleDeletePermanent = async (id) => {
    if (!confirm('PERMANENT DELETION: This action cannot be reversed. Delete article permanently?')) return;
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
      alert('Failed to permanently delete article.');
    }
  };

  // Rich formatting command helper
  const execFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    if (visualEditorRef.current) {
      const html = visualEditorRef.current.innerHTML;
      setForm(prev => ({ ...prev, content: html }));
      setHasUnsavedChanges(true);
    }
  };

  const insertMediaIntoEditor = (url) => {
    if (mediaPickerTarget === 'featured') {
      setForm(prev => ({ ...prev, featured_image: url }));
      setHasUnsavedChanges(true);
    } else {
      const imgHtml = `<figure class="article-image"><img src="${url}" alt="Article illustration" /><figcaption>StoneKrusher Machinery</figcaption></figure><p></p>`;
      if (editorTab === 'visual') {
        execFormat('insertHTML', imgHtml);
      } else {
        setForm(prev => ({ ...prev, content: prev.content + '\n\n' + imgHtml }));
        setHasUnsavedChanges(true);
      }
    }
    setShowMediaPicker(false);
  };

  const insertYoutubeEmbed = () => {
    const url = prompt('Enter YouTube Video URL (e.g. https://www.youtube.com/watch?v=...):');
    if (!url) return;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    const videoId = match ? match[1] : '';
    if (!videoId) {
      alert('Could not parse YouTube video ID. Please check the URL.');
      return;
    }
    const embedHtml = `<div class="article-video-wrapper" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:24px 0;border-radius:14px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div><p></p>`;
    if (editorTab === 'visual') {
      execFormat('insertHTML', embedHtml);
    } else {
      setForm(prev => ({ ...prev, content: prev.content + '\n\n' + embedHtml }));
      setHasUnsavedChanges(true);
    }
  };

  // Helper to extract YouTube video ID for preview
  const getEmbedUrl = (url) => {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : '';
  };

  // =========================================================================
  // RENDER: EDITOR WORKSPACE (Full-page editorial view matching Rafelblog UI)
  // =========================================================================
  if (view === 'editor') {
    return (
      <div className="cms-article-editor-shell">
        {/* Top Sticky Header */}
        <div className="cms-article-topbar">
          <div className="cms-article-topbar-left">
            <button
              type="button"
              className="cms-article-back-btn"
              onClick={() => {
                if (hasUnsavedChanges && !confirm('You have unsaved changes. Exit without saving?')) return;
                setView('list');
              }}
              title="Return to Articles list"
            >
              <span>←</span>
            </button>
            <div>
              <h1 className="cms-article-heading">
                {isEditing ? 'Edit Article' : 'New Article'}
              </h1>
              <p className="cms-article-subheading">
                Write and publish an editorial post for StoneKrusher
              </p>
            </div>
          </div>

          <div className="cms-article-topbar-actions">
            <button
              type="button"
              className="cms-btn cms-btn-secondary"
              onClick={() => handleSavePost('Draft')}
              disabled={saving}
            >
              <span>📄</span> {saving && actionType === 'Draft' ? 'Saving Draft...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="cms-btn cms-btn-primary"
              onClick={() => handleSavePost(form.status === 'Scheduled' ? 'Scheduled' : 'Published')}
              disabled={saving}
            >
              {form.status === 'Scheduled' ? (
                <><span>⏰</span> {saving ? 'Scheduling...' : 'Schedule Post'}</>
              ) : (
                <><span>🌐</span> {saving ? 'Publishing...' : 'Publish Article'}</>
              )}
            </button>
          </div>
        </div>

        {/* Status / Error alerts */}
        {statusMessage && (
          <div className="cms-alert cms-alert-success">
            <span>✓</span> {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="cms-alert cms-alert-danger">
            <span>⚠️</span> {errorMessage}
            <button type="button" onClick={() => setErrorMessage('')} className="cms-alert-dismiss">Dismiss</button>
          </div>
        )}

        {/* 2-Column Grid Layout (Left: Editorial Canvas, Right: Sticky Settings Inspector) */}
        <div className="cms-article-grid">
          
          {/* LEFT: EDITORIAL CANVAS (2 cols) */}
          <div className="cms-article-main-col">
            
            {/* 1. Article Title Card */}
            <div className="cms-card cms-article-card">
              <label className="cms-card-label">Article Title</label>
              <input
                type="text"
                className="cms-article-title-input"
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Give your article a descriptive, captivating title..."
                required
              />

              {/* URL Slug Preview Row */}
              <div className="cms-article-slug-bar">
                <span className="cms-slug-icon" aria-hidden="true">🌐</span>
                <span className="cms-slug-prefix">stonekrusher.com/blog/</span>
                <input
                  type="text"
                  className="cms-slug-input"
                  value={form.slug}
                  onChange={(e) => {
                    const s = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
                    setForm(prev => ({ ...prev, slug: s }));
                    setHasUnsavedChanges(true);
                    checkSlugCollision(s, form.id);
                  }}
                  placeholder="custom-article-slug"
                />
                {slugStatus.message && (
                  <span className={`cms-slug-badge ${slugStatus.available ? 'is-valid' : 'is-conflict'}`}>
                    {slugStatus.available ? '✓ Unique' : '⚠️ Collision'}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Article Summary / Excerpt Card */}
            <div className="cms-card cms-article-card">
              <div className="cms-card-header-row">
                <label className="cms-card-label">Article Summary / Excerpt</label>
                <span className="cms-char-counter">{(form.excerpt || '').length}/300 chars</span>
              </div>
              <textarea
                className="cms-textarea"
                rows={3}
                value={form.excerpt}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, excerpt: e.target.value }));
                  setHasUnsavedChanges(true);
                }}
                maxLength={300}
                placeholder="A concise, engaging 1-2 sentence preview shown on category cards, homepage feeds, and SEO snippets..."
              />
            </div>

            {/* 3. Rich Editorial Content Card */}
            <div className="cms-card cms-article-card">
              <div className="cms-card-header-row">
                <div>
                  <label className="cms-card-label">Article Content</label>
                  <span className="cms-card-sublabel">Rich WYSIWYG & Media</span>
                </div>
                {/* Editor Tab Switcher */}
                <div className="cms-editor-tab-pills">
                  <button
                    type="button"
                    className={`cms-editor-tab-pill ${editorTab === 'visual' ? 'active' : ''}`}
                    onClick={() => setEditorTab('visual')}
                  >
                    ✏️ Visual
                  </button>
                  <button
                    type="button"
                    className={`cms-editor-tab-pill ${editorTab === 'source' ? 'active' : ''}`}
                    onClick={() => setEditorTab('source')}
                  >
                    📝 HTML / Markdown
                  </button>
                  <button
                    type="button"
                    className={`cms-editor-tab-pill ${editorTab === 'preview' ? 'active' : ''}`}
                    onClick={() => setEditorTab('preview')}
                  >
                    👁️ Preview
                  </button>
                </div>
              </div>

              {/* Rich Formatting Toolbar (Visible in Visual mode) */}
              {editorTab === 'visual' && (
                <div className="cms-editor-toolbar">
                  <div className="cms-toolbar-group">
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('bold')} title="Bold (Ctrl+B)"><strong>B</strong></button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('italic')} title="Italic (Ctrl+I)"><em>I</em></button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('underline')} title="Underline (Ctrl+U)"><u>U</u></button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('strikeThrough')} title="Strikethrough"><s>S</s></button>
                  </div>

                  <div className="cms-toolbar-divider" />

                  <div className="cms-toolbar-group">
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('formatBlock', '<h2>')} title="Heading 2">H2</button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('formatBlock', '<h3>')} title="Heading 3">H3</button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('formatBlock', '<p>')} title="Paragraph">P</button>
                  </div>

                  <div className="cms-toolbar-divider" />

                  <div className="cms-toolbar-group">
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('insertUnorderedList')} title="Bullet List">• List</button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('insertOrderedList')} title="Numbered List">1. List</button>
                    <button type="button" className="cms-tool-btn" onClick={() => execFormat('formatBlock', '<blockquote>')} title="Blockquote">“ Quote</button>
                  </div>

                  <div className="cms-toolbar-divider" />

                  <div className="cms-toolbar-group">
                    <button
                      type="button"
                      className="cms-tool-btn cms-tool-highlight"
                      onClick={() => {
                        setMediaPickerTarget('editor');
                        setShowMediaPicker(true);
                      }}
                      title="Insert Image from Media Library"
                    >
                      🖼️ Image
                    </button>
                    <button
                      type="button"
                      className="cms-tool-btn"
                      onClick={insertYoutubeEmbed}
                      title="Insert YouTube Video Embed"
                    >
                      ▶️ Video
                    </button>
                    <button
                      type="button"
                      className="cms-tool-btn"
                      onClick={() => {
                        const url = prompt('Enter destination link URL:');
                        if (url) execFormat('createLink', url);
                      }}
                      title="Insert Hyperlink"
                    >
                      🔗 Link
                    </button>
                    <button
                      type="button"
                      className="cms-tool-btn"
                      onClick={() => execFormat('insertHorizontalRule')}
                      title="Horizontal Divider"
                    >
                      ― Rule
                    </button>
                  </div>
                </div>
              )}

              {/* Editor Surface */}
              <div className="cms-editor-surface">
                {editorTab === 'visual' && (
                  <div
                    ref={visualEditorRef}
                    className="cms-visual-editor"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      setForm(prev => ({ ...prev, content: e.currentTarget.innerHTML }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Write detailed machinery reviews, maintenance tips, operator guides, and technical insights..."
                  />
                )}

                {editorTab === 'source' && (
                  <textarea
                    className="cms-source-editor"
                    value={form.content}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, content: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Enter raw HTML or Markdown content..."
                    rows={20}
                  />
                )}

                {editorTab === 'preview' && (
                  <div className="cms-article-preview-reader">
                    <div className="cms-preview-badge">Live Reader Preview</div>
                    {form.featured_image && (
                      <img src={form.featured_image} alt={form.cover_image_alt || form.title} className="cms-preview-hero-img" />
                    )}
                    <h1 className="cms-preview-title">{form.title || 'Untitled Article'}</h1>
                    <div className="cms-preview-meta">
                      <span>By {form.author}</span> • <span>Category: {form.category}</span> • <span>{form.published_date}</span>
                    </div>
                    {form.excerpt && <p className="cms-preview-excerpt">{form.excerpt}</p>}
                    <hr className="cms-preview-divider" />
                    <div
                      className="cms-preview-body"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.content) || '<p><em>No content written yet.</em></p>' }}
                    />
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT: STICKY SETTINGS INSPECTOR (1 col) */}
          <div className="cms-article-sidebar">
            
            {/* 1. Publishing Status Card */}
            <div className="cms-card cms-article-card">
              <div className="cms-card-header-row">
                <h3 className="cms-card-title">Publishing Status</h3>
                <span className={`cms-status-badge is-${(form.status || 'Draft').toLowerCase()}`}>
                  {form.status === 'Published' ? 'Public' : (form.status || 'Draft')}
                </span>
              </div>

              <div className="cms-form-stack">
                <div>
                  <label className="cms-field-label">Status</label>
                  <select
                    className="cms-select"
                    value={form.status}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, status: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Public (Published)</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>

                {form.status === 'Scheduled' && (
                  <div className="cms-scheduled-box">
                    <div className="cms-scheduled-header">
                      <span>⏰</span> Schedule Date & Time
                    </div>
                    <input
                      type="datetime-local"
                      className="cms-input"
                      value={form.scheduled_at}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, scheduled_at: e.target.value }));
                        setHasUnsavedChanges(true);
                      }}
                    />
                    <p className="cms-field-hint">
                      The article will automatically become public at this scheduled time.
                    </p>
                  </div>
                )}

                <div>
                  <label className="cms-field-label">Published Date</label>
                  <input
                    type="date"
                    className="cms-input"
                    value={form.published_date}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, published_date: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Article Author Card */}
            <div className="cms-card cms-article-card">
              <div className="cms-card-header-row">
                <h3 className="cms-card-title">
                  <span className="cms-icon-green">👤</span> Article Author
                </h3>
              </div>
              <div className="cms-form-stack">
                <input
                  type="text"
                  className="cms-input"
                  value={form.author}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, author: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Author name..."
                />
                <div className="cms-author-pill">
                  <div className="cms-author-avatar">
                    {(typeof form.author === 'string' && form.author ? form.author.charAt(0) : 'A').toUpperCase()}
                  </div>
                  <div>
                    <div className="cms-author-name">{form.author || 'Admin'}</div>
                    <div className="cms-author-role">Staff Writer</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Classification & Category Card */}
            <div className="cms-card cms-article-card">
              <h3 className="cms-card-title">Classification & Category</h3>
              <div className="cms-form-stack">
                <div>
                  <label className="cms-field-label">Category *</label>
                  <select
                    className="cms-select"
                    value={form.category}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, category: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                  >
                    {Array.isArray(categories) && categories.length > 0 ? (
                      categories.map(cat => (
                        <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Guide">Guide</option>
                        <option value="Equipment">Equipment</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Safety">Safety</option>
                        <option value="News">News</option>
                        <option value="Technical">Technical</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="cms-field-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={form.tags}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, tags: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="mini excavator, maintenance, skid steer, safety"
                  />
                </div>
              </div>
            </div>

            {/* 4. Featured Cover Image Card */}
            <div className="cms-card cms-article-card">
              <div className="cms-card-header-row">
                <h3 className="cms-card-title">
                  <span className="cms-icon-green">🖼️</span> Featured Cover Image
                </h3>
              </div>

              <div className="cms-form-stack">
                <div className="cms-input-with-action">
                  <input
                    type="url"
                    className="cms-input"
                    value={form.featured_image}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, featured_image: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Image URL or pick from library..."
                  />
                  <button
                    type="button"
                    className="cms-btn cms-btn-primary cms-btn-sm"
                    onClick={() => {
                      setMediaPickerTarget('featured');
                      setShowMediaPicker(true);
                    }}
                    title="Browse Media Library"
                  >
                    Browse
                  </button>
                </div>

                {form.featured_image && (
                  <div className="cms-cover-preview-box">
                    <img src={form.featured_image} alt="Cover preview" />
                    <button
                      type="button"
                      className="cms-cover-remove-btn"
                      onClick={() => {
                        setForm(prev => ({ ...prev, featured_image: '' }));
                        setHasUnsavedChanges(true);
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}

                <div>
                  <label className="cms-field-label">Image Alt Description</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={form.cover_image_alt}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, cover_image_alt: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="e.g. StoneKrusher mobile jaw crusher on quarry jobsite"
                  />
                </div>
              </div>
            </div>

            {/* 5. Attached Video Card (Optional) */}
            <div className="cms-card cms-article-card">
              <div className="cms-card-header-row">
                <h3 className="cms-card-title">
                  <span className="cms-icon-green">▶️</span> Attached Video (Optional)
                </h3>
              </div>
              <p className="cms-field-hint">
                YouTube or Facebook video URL. When provided, an interactive video player is displayed prominently.
              </p>
              <div className="cms-form-stack">
                <input
                  type="url"
                  className="cms-input"
                  value={form.video_url}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, video_url: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {form.video_url && getEmbedUrl(form.video_url) && (
                  <div className="cms-sidebar-video-preview">
                    <iframe
                      src={getEmbedUrl(form.video_url)}
                      title="Video preview"
                      style={{ width: '100%', height: '170px', border: 0, borderRadius: '8px' }}
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 6. SEO & Social Meta Card */}
            <div className="cms-card cms-article-card">
              <h3 className="cms-card-title">SEO & Social Meta</h3>
              <div className="cms-form-stack">
                <div>
                  <label className="cms-field-label">Meta Title</label>
                  <input
                    type="text"
                    className="cms-input"
                    value={form.meta_title}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, meta_title: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder={form.title || 'Page meta title...'}
                  />
                </div>

                <div>
                  <label className="cms-field-label">Meta Description</label>
                  <textarea
                    className="cms-textarea"
                    rows={3}
                    value={form.meta_description}
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, meta_description: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Search engine snippet (recommended 150-160 characters)..."
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Media Picker Modal */}
        {showMediaPicker && (
          <div className="cms-modal-backdrop" style={{ zIndex: 120 }}>
            <div className="cms-modal cms-modal-xl">
              <div className="cms-modal-header">
                <h3>Select Image from Media Library</h3>
                <button
                  type="button"
                  className="cms-btn-icon cms-btn-secondary"
                  onClick={() => setShowMediaPicker(false)}
                >
                  ✕
                </button>
              </div>
              <div className="cms-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <CmsMediaLibrary
                  csrfToken={csrfToken}
                  isPicker
                  onSelectMedia={(url) => insertMediaIntoEditor(url)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: ARTICLES LIST VIEW (Modern table matching Rafelblog UI)
  // =========================================================================
  return (
    <div className="cms-articles-list-view">
      {/* Page Header */}
      <div className="cms-section-header">
        <div className="cms-section-title-group">
          <h1>Articles</h1>
          <p>Manage publication stories, categories, URL slugs, and featured media</p>
        </div>
        <div className="cms-section-actions">
          <button
            type="button"
            className="cms-btn cms-btn-primary"
            onClick={handleCreateNew}
          >
            <span>+</span> New Article
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="cms-card cms-filter-bar">
        <div className="cms-search-box">
          <span className="cms-search-icon">🔍</span>
          <input
            type="text"
            className="cms-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchPosts(); }}
            placeholder="Search articles by title, slug, or content..."
          />
          {search && (
            <button
              type="button"
              className="cms-search-clear"
              onClick={() => { setSearch(''); fetchPosts(); }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="cms-filter-group">
          <select
            className="cms-select cms-select-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {(Array.isArray(categories) ? categories : []).map(c => {
              const name = typeof c === 'string' ? c : (c.name || c.id || '');
              const id = typeof c === 'string' ? c : (c.id || c.name || '');
              return <option key={id} value={name}>{name}</option>;
            })}
          </select>

          <select
            className="cms-select cms-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Trash">Trash</option>
          </select>
        </div>
      </div>

      {/* Articles Table */}
      <div className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="cms-table-responsive">
          <table className="cms-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Category</th>
                <th>Author</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--cms-text-muted)' }}>
                    Loading articles...
                  </td>
                </tr>
              ) : (Array.isArray(posts) ? posts : []).length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--cms-text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
                    <div style={{ fontWeight: '600' }}>No articles found</div>
                    <p style={{ fontSize: '0.84rem', marginTop: '4px' }}>
                      Try adjusting your filters or click "+ New Article" to compose your first post.
                    </p>
                  </td>
                </tr>
              ) : (
                (Array.isArray(posts) ? posts : []).filter(Boolean).map(p => (
                  <tr key={p.id}>
                    <td style={{ maxWidth: '340px' }}>
                      <div className="cms-table-article-cell">
                        {p.featured_image ? (
                          <img
                            src={p.featured_image}
                            alt=""
                            className="cms-table-thumb"
                          />
                        ) : (
                          <div className="cms-table-thumb-placeholder">📝</div>
                        )}
                        <div className="cms-table-article-info">
                          <button
                            type="button"
                            className="cms-table-title-link"
                            onClick={() => handleEditPost(p.id)}
                          >
                            {p.title}
                          </button>
                          <div className="cms-table-slug">
                            stonekrusher.com/blog/{p.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cms-category-badge">{p.category || 'Guide'}</span>
                    </td>
                    <td>
                      <span className="cms-author-text">{p.author || 'Admin'}</span>
                    </td>
                    <td>
                      <span className={`cms-status-badge is-${(p.status || 'published').toLowerCase()}`}>
                        {p.status || 'Published'}
                      </span>
                    </td>
                    <td>
                      <span className="cms-date-text">{p.published_date || 'Draft'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="cms-table-actions">
                        {p.status === 'Trash' ? (
                          <>
                            <button
                              type="button"
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              onClick={() => handleRestorePost(p.id)}
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              className="cms-btn cms-btn-danger cms-btn-sm"
                              onClick={() => handleDeletePermanent(p.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={`/blog/${p.slug}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              title="View published article on website"
                            >
                              View
                            </a>
                            <button
                              type="button"
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              onClick={() => {
                                const fullUrl = `${window.location.origin}/blog/${p.slug}/`;
                                navigator.clipboard.writeText(fullUrl);
                                setToastNotice('Article URL copied to clipboard!');
                                setTimeout(() => setToastNotice(''), 3000);
                              }}
                              title="Copy public article link"
                            >
                              📋 Copy
                            </button>
                            <button
                              type="button"
                              className="cms-btn cms-btn-secondary cms-btn-sm"
                              onClick={() => handleEditPost(p.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="cms-btn-icon-danger"
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

        {/* Floating Toast Notice */}
        {toastNotice && (
          <div style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            background: 'var(--cms-primary, #0f4c3a)',
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

        {/* Pagination Bar */}
        <div className="cms-pagination">
          <div>
            Showing {posts.length} of {total} articles
          </div>
          <div className="cms-page-controls">
            <button
              type="button"
              className="cms-btn cms-btn-secondary cms-btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span className="cms-page-number">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="cms-btn cms-btn-secondary cms-btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
