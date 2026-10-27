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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function convertSectionsToHtml(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return '';
  const parts = [];
  sections.forEach(sec => {
    if (sec.h2) {
      parts.push(`<h2>${escapeHtml(sec.h2)}</h2>`);
    }
    if (sec.body) {
      const paragraphs = String(sec.body).split(/\r?\n\r?\n+/);
      paragraphs.forEach(para => {
        const trimmed = para.trim();
        if (!trimmed) return;
        const lines = trimmed.split('\n');
        const renderedLines = [];
        lines.forEach(line => {
          const lTrim = line.trim();
          if (!lTrim) return;
          // Standalone image URL
          const imgMatch = lTrim.match(/^(https?:\/\/[^\s]+(?:\.webp|\.png|\.jpg|\.jpeg|\.gif|\.svg))$/i);
          if (imgMatch) {
            if (renderedLines.length > 0) {
              parts.push(`<p>${renderedLines.join('<br />')}</p>`);
              renderedLines.length = 0;
            }
            parts.push(`<figure class="article-image"><img src="${escapeHtml(imgMatch[1])}" alt="" loading="lazy" /><figcaption>${escapeHtml(sec.h2 || '')}</figcaption></figure>`);
            return;
          }
          // Markdown image ![alt](url "caption") or ![alt](url)
          const mdImgMatch = lTrim.match(/^!\[(.*?)\]\((https?:\/\/[^\s\)]+)(?:\s+"(.*?)")?\)$/);
          if (mdImgMatch) {
            if (renderedLines.length > 0) {
              parts.push(`<p>${renderedLines.join('<br />')}</p>`);
              renderedLines.length = 0;
            }
            const alt = mdImgMatch[1] || '';
            const caption = mdImgMatch[3] || alt || (sec.h2 || '');
            parts.push(`<figure class="article-image"><img src="${escapeHtml(mdImgMatch[2])}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(caption)}</figcaption></figure>`);
            return;
          }
          // Markdown links [text](url)
          let formatted = escapeHtml(lTrim).replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
          // **bold**
          formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          renderedLines.push(formatted);
        });
        if (renderedLines.length > 0) {
          parts.push(`<p>${renderedLines.join('<br />')}</p>`);
        }
      });
    }
    if (sec.h3) {
      parts.push(`<h3>${escapeHtml(sec.h3)}</h3>`);
    }
    if (sec.h3Body) {
      parts.push(`<p>${escapeHtml(sec.h3Body).replace(/\n/g, '<br />')}</p>`);
    }
  });
  return parts.join('\n');
}

function makeReadableCaption(rawLabel, url, fallbackTitle) {
  if (rawLabel && !rawLabel.startsWith('http') && rawLabel.trim().length > 1) {
    return rawLabel.trim();
  }
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop().replace(/\.[a-zA-Z0-9]+$/, '');
    const readable = filename.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    if (readable.length > 2) {
      return readable.charAt(0).toUpperCase() + readable.slice(1);
    }
  } catch {
    // URL parsing fallback
  }
  return fallbackTitle || 'StoneKrusher Heavy Equipment';
}

function processSmartBlogContent(rawText, currentForm = {}) {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();
  let extractedTitle = '';
  let extractedFeaturedImage = '';
  let extractedCoverAlt = '';
  let imagesConvertedCount = 0;

  // 1. EXTRACT FIRST TITLE
  // Markdown # Title, ## Title, <h1>Title</h1>, <h2>Title</h2>, or first short line
  const h1MdMatch = text.match(/^#+\s+([^\n\r]+)/m);
  const h1HtmlMatch = text.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);

  if (h1MdMatch && text.indexOf(h1MdMatch[0]) < 250) {
    extractedTitle = h1MdMatch[1].trim();
    text = text.replace(h1MdMatch[0], '').trim();
  } else if (h1HtmlMatch && text.indexOf(h1HtmlMatch[0]) < 250) {
    extractedTitle = h1HtmlMatch[1].replace(/<[^>]+>/g, '').trim();
    text = text.replace(h1HtmlMatch[0], '').trim();
  } else {
    const lines = text.split('\n');
    const firstIdx = lines.findIndex(l => l.trim().length > 0);
    if (firstIdx !== -1) {
      const candidate = lines[firstIdx].trim();
      const isUrl = /^https?:\/\//i.test(candidate);
      const isImg = /miniexcavator\.org|\.(webp|png|jpg|jpeg|gif|svg)/i.test(candidate);
      const isLink = /^!?\[.*\]\(.*\)/.test(candidate);
      if (!isUrl && !isImg && !isLink && candidate.length > 4 && candidate.length < 140) {
        extractedTitle = candidate.replace(/^[\*\#\-\s]+/, '').trim();
        lines.splice(firstIdx, 1);
        text = lines.join('\n').trim();
      }
    }
  }

  // 2. EXTRACT FIRST IMAGE AS FEATURED COVER IMAGE
  // Look for any image link (especially img.miniexcavator.org or image extensions)
  const mdLinkRegex = /!?\[([^\]]*)\]\((https?:\/\/(?:img\.miniexcavator\.org\/[^\s\)]+|[^\s\)]+\.(?:webp|png|jpg|jpeg|gif|svg)[^\s\)]*))\)/i;
  const htmlImgRegex = /<img[^>]+src=["'](https?:\/\/(?:img\.miniexcavator\.org\/[^"']+|[^"']+\.(?:webp|png|jpg|jpeg|gif|svg)[^"']*))["'][^>]*>/i;
  const htmlAnchorRegex = /<a[^>]+href=["'](https?:\/\/(?:img\.miniexcavator\.org\/[^"']+|[^"']+\.(?:webp|png|jpg|jpeg|gif|svg)[^"']*))["'][^>]*>(.*?)<\/a>/i;
  const bareUrlRegex = /(https?:\/\/(?:img\.miniexcavator\.org\/[^\s\<\>"\']+|[^\s\<\>"\']+\.(?:webp|png|jpg|jpeg|gif|svg)))/i;

  let firstMatch = null;
  let firstMatchPos = Infinity;
  let firstMatchType = '';

  const m1 = text.match(mdLinkRegex);
  if (m1 && m1.index < firstMatchPos) {
    firstMatchPos = m1.index;
    firstMatch = m1;
    firstMatchType = 'md';
  }
  const m2 = text.match(htmlImgRegex);
  if (m2 && m2.index < firstMatchPos) {
    firstMatchPos = m2.index;
    firstMatch = m2;
    firstMatchType = 'htmlImg';
  }
  const m3 = text.match(htmlAnchorRegex);
  if (m3 && m3.index < firstMatchPos) {
    firstMatchPos = m3.index;
    firstMatch = m3;
    firstMatchType = 'htmlAnchor';
  }
  const m4 = text.match(bareUrlRegex);
  if (m4 && m4.index < firstMatchPos) {
    firstMatchPos = m4.index;
    firstMatch = m4;
    firstMatchType = 'bare';
  }

  if (firstMatch) {
    if (firstMatchType === 'md') {
      extractedFeaturedImage = firstMatch[2];
      extractedCoverAlt = firstMatch[1] && !firstMatch[1].startsWith('http') ? firstMatch[1] : '';
    } else if (firstMatchType === 'htmlImg') {
      extractedFeaturedImage = firstMatch[1];
    } else if (firstMatchType === 'htmlAnchor') {
      extractedFeaturedImage = firstMatch[1];
      extractedCoverAlt = firstMatch[2] && !firstMatch[2].startsWith('http') ? firstMatch[2].replace(/<[^>]+>/g, '') : '';
    } else if (firstMatchType === 'bare') {
      extractedFeaturedImage = firstMatch[1];
    }

    // REMOVE this first image match from the article content body completely!
    text = text.slice(0, firstMatchPos) + text.slice(firstMatchPos + firstMatch[0].length);
    text = text.trim();
  }

  const activeTitle = extractedTitle || currentForm.title || '';

  // 3. CONVERT ALL REMAINING IMAGE LINKS / URLS INTO <figure class="article-image">
  // A. Markdown image with link: [![alt](img_url)](dest_url)
  text = text.replace(/\[!\[([^\]]*)\]\((https?:\/\/(?:img\.miniexcavator\.org\/[^\s\)]+|[^\s\)]+\.(?:webp|png|jpg|jpeg|gif|svg)[^\s\)]*))\)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+|\?[^\s\)]+)\)/gi, (match, label, imgUrl, destUrl) => {
    imagesConvertedCount++;
    const caption = makeReadableCaption(label, imgUrl, activeTitle);
    const alt = (label && !label.startsWith('http')) ? label.trim() : '';
    const isExternal = destUrl.startsWith('http') && !destUrl.includes('stonekrusher.com');
    return `\n\n<figure class="article-image"><a href="${destUrl}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} style="display:inline-block;text-decoration:none;"><img src="${imgUrl}" alt="${escapeHtml(alt)}" loading="lazy" /></a><figcaption>${escapeHtml(caption)}</figcaption></figure>\n\n`;
  });

  // B. Standard Markdown images / image links: [url](url), ![alt](url), [caption](url)
  text = text.replace(/!?\[([^\]]*)\]\((https?:\/\/(?:img\.miniexcavator\.org\/[^\s\)]+|[^\s\)]+\.(?:webp|png|jpg|jpeg|gif|svg)[^\s\)]*))\)/gi, (match, label, url) => {
    imagesConvertedCount++;
    const caption = makeReadableCaption(label, url, activeTitle);
    const alt = (label && !label.startsWith('http')) ? label.trim() : '';
    return `\n\n<figure class="article-image"><img src="${url}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(caption)}</figcaption></figure>\n\n`;
  });

  // C. HTML anchor links pointing to images: <a href="dest"><img src="img" /></a>
  text = text.replace(/<a[^>]+href=["'](https?:\/\/[^"']+|\/[^"']+|\?[^"']+)["'][^>]*>\s*<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*alt=["']?([^"'>]*)["']?[^>]*\/?>\s*<\/a>/gi, (match, destUrl, imgUrl, rawAlt) => {
    imagesConvertedCount++;
    const caption = makeReadableCaption(rawAlt, imgUrl, activeTitle);
    const alt = rawAlt ? rawAlt.trim() : '';
    const isExternal = destUrl.startsWith('http') && !destUrl.includes('stonekrusher.com');
    return `\n\n<figure class="article-image"><a href="${destUrl}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} style="display:inline-block;text-decoration:none;"><img src="${imgUrl}" alt="${escapeHtml(alt)}" loading="lazy" /></a><figcaption>${escapeHtml(caption)}</figcaption></figure>\n\n`;
  });

  // D. HTML anchor links with URL as label: <a href="url">url</a>
  text = text.replace(/<a[^>]+href=["'](https?:\/\/(?:img\.miniexcavator\.org\/[^"']+|[^"']+\.(?:webp|png|jpg|jpeg|gif|svg)[^"']*))["'][^>]*>(.*?)<\/a>/gi, (match, url, label) => {
    imagesConvertedCount++;
    const cleanLabel = label.replace(/<[^>]+>/g, '').trim();
    const caption = makeReadableCaption(cleanLabel, url, activeTitle);
    const alt = (cleanLabel && !cleanLabel.startsWith('http')) ? cleanLabel : '';
    return `\n\n<figure class="article-image"><img src="${url}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(caption)}</figcaption></figure>\n\n`;
  });

  // E. Bare URLs to img.miniexcavator.org or image extensions
  text = text.replace(/(?:^|\n)(https?:\/\/(?:img\.miniexcavator\.org\/[^\s\<\>"\']+|[^\s\<\>"\']+\.(?:webp|png|jpg|jpeg|gif|svg)))(?:\r?\n|$)/gi, (match, url) => {
    imagesConvertedCount++;
    const caption = makeReadableCaption('', url, activeTitle);
    const alt = '';
    return `\n\n<figure class="article-image"><img src="${url}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(caption)}</figcaption></figure>\n\n`;
  });

  // 4. PARSE MARKDOWN TO HTML (IF MARKDOWN)
  const blocks = text.split(/\n\n+/);
  const htmlBlocks = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(figure|div|p|h[1-6]|ul|ol|table|blockquote)/i.test(block)) {
      return block;
    }
    if (block.startsWith('## ')) {
      return `<h2>${block.replace(/^##\s+/, '')}</h2>`;
    }
    if (block.startsWith('### ')) {
      return `<h3>${block.replace(/^###\s+/, '')}</h3>`;
    }
    if (block.startsWith('#### ')) {
      return `<h4>${block.replace(/^####\s+/, '')}</h4>`;
    }
    if (block.startsWith('- ') || block.startsWith('* ')) {
      const items = block.split(/\n[\-\*]\s+/).map(it => {
        let clean = it.replace(/^[\-\*]\s+/, '').trim();
        clean = clean
          .replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+|\?[^\s\)]+)\)/g, (m, label, link) => {
            const isExternal = link.startsWith('http') && !link.includes('stonekrusher.com');
            return `<a href="${link}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
          })
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return `<li>${clean}</li>`;
      }).filter(Boolean);
      return `<ul>${items.join('')}</ul>`;
    }
    let formatted = block
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|\/[^\s\)]+|\?[^\s\)]+)\)/g, (m, label, link) => {
        const isExternal = link.startsWith('http') && !link.includes('stonekrusher.com');
        return `<a href="${link}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
    return `<p>${formatted}</p>`;
  });

  const finalHtml = htmlBlocks.filter(Boolean).join('\n\n');

  return {
    title: extractedTitle || currentForm.title || '',
    slug: extractedTitle ? extractedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : currentForm.slug || '',
    featured_image: extractedFeaturedImage || currentForm.featured_image || '',
    cover_image_alt: extractedCoverAlt ? extractedCoverAlt.trim() : (currentForm.cover_image_alt || ''),
    content: finalHtml,
    imagesConvertedCount
  };
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
  const [showSmartImportModal, setShowSmartImportModal] = useState(false);
  const [smartImportText, setSmartImportText] = useState('');
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [selectedImageSrc, setSelectedImageSrc] = useState('');
  const [selectedImageAlt, setSelectedImageAlt] = useState('');
  const [selectedImageCaption, setSelectedImageCaption] = useState('');
  const [selectedImageLink, setSelectedImageLink] = useState('');
  const [selectedImageNewTab, setSelectedImageNewTab] = useState(true);
  const visualEditorRef = useRef(null);

  function getEmptyForm() {
    return {
      id: '',
      title: '',
      slug: '',
      category: 'Guide',
      author: 'StoneKrusher Editorial Team',
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
      // Do NOT overwrite innerHTML if user has active focus/caret inside the editor (prevents caret jumping)
      if (!visualEditorRef.current.contains(document.activeElement)) {
        if (visualEditorRef.current.innerHTML !== (form.content || '')) {
          visualEditorRef.current.innerHTML = form.content || '';
        }
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

        let contentVal = p.content || '';
        if (!contentVal && parsedData && Array.isArray(parsedData.sections) && parsedData.sections.length > 0) {
          contentVal = convertSectionsToHtml(parsedData.sections);
        }

        setForm({
          id: p.id,
          title: p.title || '',
          slug: p.slug || '',
          category: p.category || 'Guide',
          author: !p.author || p.author.includes('KONSTRUCTZ') ? 'StoneKrusher Editorial Team' : p.author,
          featured_image: p.featured_image || '',
          cover_image_alt: parsedData.cover_image_alt || '',
          excerpt: p.excerpt || '',
          content: contentVal,
          status: p.status || 'Draft',
          scheduled_at: safeIsoDate(p.scheduled_at),
          video_url: parsedData.video_url || '',
          meta_title: parsedData.meta_title || '',
          meta_description: parsedData.meta_description || '',
          tags: Array.isArray(tagsArr) ? tagsArr.join(', ') : '',
          published_date: p.published_date || parsedData.publishedDate || parsedData.published_date || (parsedData.date && !isNaN(Date.parse(parsedData.date)) ? new Date(parsedData.date).toISOString().split('T')[0] : (p.updated_at ? new Date(typeof p.updated_at === 'number' && p.updated_at < 1e11 ? p.updated_at * 1000 : Number(p.updated_at)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]))
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

      const resText = await res.text();
      let data = {};
      try {
        data = JSON.parse(resText);
      } catch (jsonErr) {
        throw new Error(`Server returned unexpected response (status ${res.status}): ${resText.slice(0, 150) || 'Empty response'}`);
      }

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
      const imgHtml = `<figure class="article-image"><img src="${url}" alt="" /><figcaption></figcaption></figure><p></p>`;
      if (editorTab === 'visual') {
        execFormat('insertHTML', imgHtml);
      } else {
        setForm(prev => ({ ...prev, content: prev.content + '\n\n' + imgHtml }));
        setHasUnsavedChanges(true);
      }
    }
    setShowMediaPicker(false);
  };

  const handleVisualEditorPaste = (e) => {
    const pasteText = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (
      pasteText &&
      (pasteText.includes('img.miniexcavator.org') ||
       /!\[.*?\]\((https?:\/\/|\/)/i.test(pasteText) ||
       /\[https?:\/\/[^\]]+\]\(https?:\/\/[^\)]+\)/i.test(pasteText) ||
       pasteText.includes('.webp') ||
       pasteText.includes('.png') ||
       pasteText.includes('.jpg'))
    ) {
      e.preventDefault();
      const parsed = processSmartBlogContent(pasteText, form);
      if (parsed) {
        setForm(prev => ({
          ...prev,
          title: parsed.title || prev.title,
          slug: parsed.slug || prev.slug,
          featured_image: parsed.featured_image || prev.featured_image,
          cover_image_alt: parsed.cover_image_alt || prev.cover_image_alt,
          content: parsed.content
        }));
        if (visualEditorRef.current) {
          visualEditorRef.current.innerHTML = parsed.content;
        }
        setHasUnsavedChanges(true);
        setToastNotice(`⚡ Auto-Detected! Title & Featured Cover Image filled, ${parsed.imagesConvertedCount} gallery images formatted with captions.`);
        setTimeout(() => setToastNotice(''), 6000);
      }
    }
  };

  const handleVisualEditorClick = (e) => {
    const target = e.target;
    if (target && target.tagName === 'IMG') {
      const figure = target.closest('figure');
      const captionEl = figure ? figure.querySelector('figcaption') : null;
      const linkEl = target.closest('a');
      setSelectedImageModal({
        targetImg: target,
        figureEl: figure,
        linkEl: linkEl
      });
      setSelectedImageSrc(target.getAttribute('src') || '');
      setSelectedImageAlt(target.getAttribute('alt') || '');
      setSelectedImageCaption(captionEl ? (captionEl.innerText || captionEl.textContent || '') : '');
      setSelectedImageLink(linkEl ? (linkEl.getAttribute('href') || '') : '');
      setSelectedImageNewTab(linkEl ? (linkEl.getAttribute('target') === '_blank') : true);
    }
  };

  const handleSaveImageModal = () => {
    if (!selectedImageModal || !selectedImageModal.targetImg) return;
    const { targetImg, figureEl } = selectedImageModal;

    targetImg.setAttribute('src', selectedImageSrc);
    targetImg.setAttribute('alt', selectedImageAlt ? selectedImageAlt.trim() : '');

    // Handle Link wrapper around targetImg (or update existing)
    const currentLink = targetImg.closest('a');
    const trimmedLink = selectedImageLink.trim();
    if (trimmedLink) {
      const isExternal = trimmedLink.startsWith('http') && !trimmedLink.includes('stonekrusher.com');
      let linkEl = currentLink;
      if (!linkEl) {
        linkEl = document.createElement('a');
        linkEl.style.display = 'inline-block';
        linkEl.style.textDecoration = 'none';
        targetImg.parentNode.insertBefore(linkEl, targetImg);
        linkEl.appendChild(targetImg);
      }
      linkEl.setAttribute('href', trimmedLink);
      if (selectedImageNewTab || isExternal) {
        linkEl.setAttribute('target', '_blank');
        linkEl.setAttribute('rel', 'noopener noreferrer');
      } else {
        linkEl.removeAttribute('target');
        linkEl.removeAttribute('rel');
      }
    } else if (currentLink) {
      // Remove link wrapper but keep image
      currentLink.parentNode.insertBefore(targetImg, currentLink);
      currentLink.remove();
    }

    if (figureEl) {
      let cap = figureEl.querySelector('figcaption');
      if (selectedImageCaption.trim()) {
        if (!cap) {
          cap = document.createElement('figcaption');
          figureEl.appendChild(cap);
        }
        cap.innerText = selectedImageCaption.trim();
      } else if (cap) {
        cap.remove();
      }
    } else if (selectedImageCaption.trim()) {
      const fig = document.createElement('figure');
      fig.className = 'article-image';
      const wrapTarget = targetImg.closest('a') || targetImg;
      wrapTarget.parentNode.insertBefore(fig, wrapTarget);
      fig.appendChild(wrapTarget);
      const cap = document.createElement('figcaption');
      cap.innerText = selectedImageCaption.trim();
      fig.appendChild(cap);
    }

    if (visualEditorRef.current) {
      const updatedHtml = visualEditorRef.current.innerHTML;
      setForm(prev => ({ ...prev, content: updatedHtml }));
      setHasUnsavedChanges(true);
    }
    setSelectedImageModal(null);
    setToastNotice('Image properties, destination link and caption saved.');
    setTimeout(() => setToastNotice(''), 3000);
  };

  const handleSetSelectedAsFeatured = () => {
    if (selectedImageSrc) {
      setForm(prev => ({
        ...prev,
        featured_image: selectedImageSrc,
        cover_image_alt: selectedImageAlt ? selectedImageAlt.trim() : (prev.cover_image_alt || '')
      }));
      setHasUnsavedChanges(true);
      setToastNotice('Image set as Featured Cover Image.');
      setTimeout(() => setToastNotice(''), 4000);
    }
  };

  const handleRemoveSelectedImage = () => {
    if (!selectedImageModal) return;
    if (selectedImageModal.figureEl) {
      selectedImageModal.figureEl.remove();
    } else {
      const parentLink = selectedImageModal.targetImg ? selectedImageModal.targetImg.closest('a') : null;
      if (parentLink) {
        parentLink.remove();
      } else if (selectedImageModal.targetImg) {
        selectedImageModal.targetImg.remove();
      }
    }
    if (visualEditorRef.current) {
      setForm(prev => ({ ...prev, content: visualEditorRef.current.innerHTML }));
      setHasUnsavedChanges(true);
    }
    setSelectedImageModal(null);
    setToastNotice('Image removed from article.');
    setTimeout(() => setToastNotice(''), 3000);
  };

  const handleRunSmartImport = () => {
    const textToProcess = smartImportText.trim() || form.content || '';
    if (!textToProcess) {
      alert('Please paste some blog text or markdown containing title and image links.');
      return;
    }
    const result = processSmartBlogContent(textToProcess, form);
    if (result) {
      setForm(prev => ({
        ...prev,
        title: result.title || prev.title,
        slug: result.slug || prev.slug,
        featured_image: result.featured_image || prev.featured_image,
        cover_image_alt: result.cover_image_alt || prev.cover_image_alt,
        content: result.content
      }));
      if (visualEditorRef.current) {
        visualEditorRef.current.innerHTML = result.content;
      }
      setHasUnsavedChanges(true);
      setShowSmartImportModal(false);
      setSmartImportText('');
      setToastNotice(`✨ Blog Auto-Detected! Title & Cover Image extracted, ${result.imagesConvertedCount} gallery images converted with captions.`);
      setTimeout(() => setToastNotice(''), 6000);
    }
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
                      onClick={() => setShowSmartImportModal(true)}
                      title="⚡ Auto-Detect Blog: Paste link/content, auto-fill Title, Cover Image, and convert image gallery"
                      style={{
                        background: 'linear-gradient(135deg, rgba(74, 222, 128, 0.15), rgba(34, 197, 94, 0.25))',
                        color: '#4ade80',
                        borderColor: '#22c55e',
                        fontWeight: 700
                      }}
                    >
                      ⚡ Smart Import / Paste
                    </button>
                    <button
                      type="button"
                      className="cms-tool-btn cms-tool-highlight"
                      onClick={() => {
                        setMediaPickerTarget('editor');
                        setShowMediaPicker(true);
                      }}
                      title="Insert Image from Media Library"
                    >
                      🖼️ Media Library
                    </button>
                    <button
                      type="button"
                      className="cms-tool-btn"
                      onClick={() => {
                        const url = prompt('Enter direct Image URL (e.g. https://img.miniexcavator.org/...):');
                        if (url) {
                          const alt = prompt('Enter Image Description / Alt text (optional):') || '';
                          const caption = prompt('Enter Image Caption (optional):') || '';
                          const imgHtml = `<figure class="article-image"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" /><figcaption>${escapeHtml(caption)}</figcaption></figure><p></p>`;
                          if (editorTab === 'visual') {
                            execFormat('insertHTML', imgHtml);
                          } else {
                            setForm(prev => ({ ...prev, content: prev.content + '\n\n' + imgHtml }));
                            setHasUnsavedChanges(true);
                          }
                        }
                      }}
                      title="Insert Image by direct web URL with Alt and Caption"
                    >
                      🌐 Image URL
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
                    onPaste={handleVisualEditorPaste}
                    onClick={handleVisualEditorClick}
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

        {/* Smart Auto-Detect & Import Modal */}
        {showSmartImportModal && (
          <div className="cms-modal-backdrop" style={{ zIndex: 130 }}>
            <div className="cms-modal cms-modal-lg">
              <div className="cms-modal-header">
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#4ade80' }}>⚡</span> Smart Blog Auto-Detect & Quick Import
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--cms-text-muted)' }}>
                    Paste markdown, copied blog articles, or links from <code>img.miniexcavator.org</code>. The system automatically extracts the title, sets the featured cover image, and converts all images into formatted gallery figures with captions.
                  </p>
                </div>
                <button
                  type="button"
                  className="cms-btn-icon cms-btn-secondary"
                  onClick={() => setShowSmartImportModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="cms-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>
                    Paste Blog Content or Markdown with image links:
                  </label>
                  <textarea
                    value={smartImportText}
                    onChange={(e) => setSmartImportText(e.target.value)}
                    placeholder={`# Your Article Title Here\n\n[https://img.miniexcavator.org/ebay/Blog/class7/1stOct/RollingSpeed-01.webp](https://img.miniexcavator.org/ebay/Blog/class7/1stOct/RollingSpeed-01.webp)\n\nArticle paragraph text goes here...\n\n## Section Heading\n\n[https://img.miniexcavator.org/ebay/Blog/class7/1stOct/RollingSpeed-03.webp](https://img.miniexcavator.org/ebay/Blog/class7/1stOct/RollingSpeed-03.webp)`}
                    rows={12}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--cms-input-border)',
                      background: 'var(--cms-input-bg)',
                      color: 'var(--cms-text)',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      lineHeight: '1.5'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="cms-btn cms-btn-secondary"
                    onClick={() => {
                      if (form.content) {
                        setSmartImportText(form.content);
                      }
                    }}
                    title="Load whatever is currently written in the article editor into this paste box"
                  >
                    Load Current Editor Content
                  </button>
                  <button
                    type="button"
                    className="cms-btn cms-btn-primary"
                    onClick={handleRunSmartImport}
                    style={{ background: 'linear-gradient(135deg, #15803d, #22c55e)', color: '#ffffff', fontWeight: 700 }}
                  >
                    ✨ Process & Auto-Fill Blog
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Details & Caption Edit Modal */}
        {selectedImageModal && (
          <div className="cms-modal-backdrop" style={{ zIndex: 135 }}>
            <div className="cms-modal cms-modal-md">
              <div className="cms-modal-header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🖼️</span> Image Properties & SEO Caption
                </h3>
                <button
                  type="button"
                  className="cms-btn-icon cms-btn-secondary"
                  onClick={() => setSelectedImageModal(null)}
                >
                  ✕
                </button>
              </div>
              <div className="cms-modal-body">
                {selectedImageSrc && (
                  <div style={{ textAlign: 'center', marginBottom: '16px', background: '#0a0d0a', padding: '12px', borderRadius: '8px' }}>
                    <img
                      src={selectedImageSrc}
                      alt={selectedImageAlt || 'Preview'}
                      style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '6px' }}
                    />
                  </div>
                )}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Image Source URL:
                  </label>
                  <input
                    type="text"
                    value={selectedImageSrc}
                    onChange={(e) => setSelectedImageSrc(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--cms-input-border)',
                      background: 'var(--cms-input-bg)',
                      color: 'var(--cms-text)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    SEO Alt Description (Crucial for Google search ranking):
                  </label>
                  <input
                    type="text"
                    value={selectedImageAlt}
                    onChange={(e) => setSelectedImageAlt(e.target.value)}
                    placeholder="e.g. Modern excavator compact hydraulic arm operating on jobsite"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--cms-input-border)',
                      background: 'var(--cms-input-bg)',
                      color: 'var(--cms-text)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Public Image Caption (Displayed below image on front-facing blog):
                  </label>
                  <input
                    type="text"
                    value={selectedImageCaption}
                    onChange={(e) => setSelectedImageCaption(e.target.value)}
                    placeholder="e.g. Speed & Roller Passes: Consistent speed keeps every pass predictable"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--cms-input-border)',
                      background: 'var(--cms-input-bg)',
                      color: 'var(--cms-text)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--cms-border)' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    🔗 Click Destination Link (Optional - Internal page or External URL):
                  </label>
                  <input
                    type="text"
                    value={selectedImageLink}
                    onChange={(e) => setSelectedImageLink(e.target.value)}
                    placeholder="e.g. /equipment/wheel-loaders/ or https://example.com/specs or ?page=contact"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--cms-input-border)',
                      background: 'var(--cms-input-bg)',
                      color: 'var(--cms-text)',
                      fontSize: '0.85rem',
                      marginBottom: '8px'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--cms-text-muted)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={selectedImageNewTab}
                        onChange={(e) => setSelectedImageNewTab(e.target.checked)}
                      />
                      <span>Open destination in new tab (<code>target="_blank"</code>)</span>
                    </label>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-muted)', marginTop: '4px' }}>
                    💡 When visitors click on this image, they will be taken directly to this URL. Leave empty if you don't want a link.
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--cms-border)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="cms-btn cms-btn-secondary"
                      onClick={handleSetSelectedAsFeatured}
                      title="Set this image as the main article cover thumbnail"
                      style={{ fontSize: '0.82rem' }}
                    >
                      🌟 Set as Featured Cover
                    </button>
                    <button
                      type="button"
                      className="cms-btn cms-btn-danger"
                      onClick={handleRemoveSelectedImage}
                      style={{ fontSize: '0.82rem' }}
                    >
                      🗑️ Delete Image
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="cms-btn cms-btn-secondary"
                      onClick={() => setSelectedImageModal(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="cms-btn cms-btn-primary"
                      onClick={handleSaveImageModal}
                      style={{ fontWeight: 700 }}
                    >
                      Save & Apply
                    </button>
                  </div>
                </div>
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Article</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="cms-card cms-filter-bar">
        <div className="cms-search-box">
          <span className="cms-search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
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
                <th>Views</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--cms-text-muted)' }}>
                    Loading articles...
                  </td>
                </tr>
              ) : (Array.isArray(posts) ? posts : []).length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--cms-text-muted)' }}>
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
                      <span className="cms-views-pill" title={`${Number(p.views || 0).toLocaleString()} total reader views`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>{Number(p.views || 0).toLocaleString()}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`cms-status-badge is-${(p.status || 'published').toLowerCase()}`}>
                        {p.status || 'Published'}
                      </span>
                    </td>
                    <td>
                      <span className="cms-date-text">
                        {p.published_date || (p.updated_at ? new Date(typeof p.updated_at === 'number' && p.updated_at < 1e11 ? p.updated_at * 1000 : Number(p.updated_at)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Draft')}
                      </span>
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
              className="cms-page-pill-btn"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <span>←</span>
              <span>Previous</span>
            </button>
            <span className="cms-page-number">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="cms-page-pill-btn"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <span>Next</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
