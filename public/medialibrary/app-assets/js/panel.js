var lbCurrentIndex = window.lbCurrentIndex || 0;

/* ========== LIGHTBOX ZOOM & PAN ENGINE ========== */
let lbZoom = 1;
let lbPanX = 0;
let lbPanY = 0;
let lbIsDragging = false;
let lbHasMoved = false;
let lbDragStartX = 0;
let lbDragStartY = 0;
let lbPanStartX = 0;
let lbPanStartY = 0;

const LB_ZOOM_STEPS = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0];

function lbResetZoom(animate = true) {
    lbZoom = 1;
    lbPanX = 0;
    lbPanY = 0;
    lbIsDragging = false;
    lbHasMoved = false;
    lbApplyTransform(animate);
}

function lbApplyTransform(animate = false) {
    const img = document.getElementById('lbImg');
    const badge = document.getElementById('lbZoomBadge');
    const zoomOutBtn = document.getElementById('lbZoomOutBtn');
    const zoomInBtn = document.getElementById('lbZoomInBtn');
    const resetBtn = document.getElementById('lbResetBtn');
    const actualBtn = document.getElementById('lbActualSizeBtn');
    if (!img) return;

    if (animate) {
        img.style.transition = 'transform 0.18s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.22s ease-out';
    } else {
        img.style.transition = 'opacity 0.22s ease-out';
    }

    img.style.transform = `translate3d(${lbPanX}px, ${lbPanY}px, 0) scale(${lbZoom})`;

    if (lbZoom > 1.01) {
        img.classList.add('zoomed');
    } else {
        img.classList.remove('zoomed');
    }

    if (badge) {
        badge.textContent = Math.round(lbZoom * 100) + '%';
    }

    // Dynamic button states
    if (zoomOutBtn) {
        const isMin = lbZoom <= 1.01;
        zoomOutBtn.disabled = isMin;
        zoomOutBtn.style.opacity = isMin ? '0.35' : '1';
        zoomOutBtn.style.cursor = isMin ? 'default' : 'pointer';
    }
    if (zoomInBtn) {
        const isMax = lbZoom >= 5.99;
        zoomInBtn.disabled = isMax;
        zoomInBtn.style.opacity = isMax ? '0.35' : '1';
        zoomInBtn.style.cursor = isMax ? 'default' : 'pointer';
    }
    if (resetBtn) {
        const isFit = lbZoom <= 1.01 && Math.abs(lbPanX) < 1 && Math.abs(lbPanY) < 1;
        resetBtn.disabled = isFit;
        resetBtn.style.opacity = isFit ? '0.35' : '1';
        resetBtn.style.cursor = isFit ? 'default' : 'pointer';
    }
    if (actualBtn && img.naturalWidth && img.clientWidth) {
        const actualRatio = +(img.naturalWidth / img.clientWidth).toFixed(2);
        if (Math.abs(lbZoom - actualRatio) < 0.15 && actualRatio > 1.1) {
            actualBtn.classList.add('active');
        } else {
            actualBtn.classList.remove('active');
        }
    }
}

function lbSetZoom(targetZoom, clientX = null, clientY = null, animate = true) {
    const img = document.getElementById('lbImg');
    const wrap = document.getElementById('lbImgWrap');
    if (!img) return;

    targetZoom = Math.min(6.0, Math.max(1.0, targetZoom));
    if (targetZoom <= 1.01) {
        lbResetZoom(animate);
        return;
    }

    const oldZoom = lbZoom;
    if (clientX !== null && clientY !== null && wrap) {
        const wrapRect = wrap.getBoundingClientRect();
        const centerX = wrapRect.left + wrapRect.width / 2;
        const centerY = wrapRect.top + wrapRect.height / 2;
        const dx = clientX - (centerX + lbPanX);
        const dy = clientY - (centerY + lbPanY);
        const ratio = targetZoom / oldZoom;
        lbPanX += dx * (1 - ratio);
        lbPanY += dy * (1 - ratio);
    } else {
        const ratio = targetZoom / oldZoom;
        lbPanX *= ratio;
        lbPanY *= ratio;
    }

    // Clamp pan bounds so image stays on screen
    if (wrap) {
        const maxPanX = Math.max(0, (img.clientWidth * targetZoom - wrap.clientWidth) / 2) + 200;
        const maxPanY = Math.max(0, (img.clientHeight * targetZoom - wrap.clientHeight) / 2) + 200;
        lbPanX = Math.min(maxPanX, Math.max(-maxPanX, lbPanX));
        lbPanY = Math.min(maxPanY, Math.max(-maxPanY, lbPanY));
    }

    lbZoom = targetZoom;
    lbApplyTransform(animate);
}

function lbZoomIn() {
    const current = lbZoom;
    if (current >= 6.0) return;
    let next = LB_ZOOM_STEPS.find(s => s > current + 0.04);
    if (!next) next = Math.min(6.0, +(current * 1.25).toFixed(2));
    lbSetZoom(next, null, null, true);
}

function lbZoomOut() {
    const current = lbZoom;
    if (current <= 1.01) return;
    let prev = LB_ZOOM_STEPS.slice().reverse().find(s => s < current - 0.04);
    if (!prev || prev <= 1.01) {
        lbResetZoom(true);
        return;
    }
    lbSetZoom(prev, null, null, true);
}

function lbZoomDelta(delta, clientX = null, clientY = null) {
    if (delta > 0) lbZoomIn();
    else lbZoomOut();
}

function lbZoomMultiply(multiplier, clientX = null, clientY = null) {
    const target = +(lbZoom * multiplier).toFixed(3);
    if (target < 1.01) {
        lbResetZoom(true);
    } else {
        lbSetZoom(Math.min(6.0, target), clientX, clientY, false);
    }
}

function lbToggleActualSize() {
    const img = document.getElementById('lbImg');
    if (!img) return;

    let actualRatio = 1.0;
    if (img.naturalWidth && img.clientWidth) {
        actualRatio = +(img.naturalWidth / img.clientWidth).toFixed(2);
    }
    if (actualRatio < 1.15) {
        actualRatio = 2.0;
    }
    actualRatio = Math.min(6.0, Math.max(1.25, actualRatio));

    if (Math.abs(lbZoom - actualRatio) < 0.15) {
        lbResetZoom(true);
    } else {
        lbPanX = 0;
        lbPanY = 0;
        lbSetZoom(actualRatio, null, null, true);
    }
}

function initLightboxZoomEvents() {
    const wrap = document.getElementById('lbImgWrap');
    const img = document.getElementById('lbImg');
    const lb = document.getElementById('lightbox');
    if (!wrap || !img || !lb) return;

    // Smooth, responsive mouse wheel zoom attached to lightbox
    lb.addEventListener('wheel', (e) => {
        if (!lb.classList.contains('open')) return;
        // Don't intercept scroll if user is scrolling inside info panel
        if (e.target.closest('.lb-info, .lb-toolbar')) return;

        e.preventDefault();

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 24;
        else if (e.deltaMode === 2) delta *= 100;

        // Controlled zoom multiplier: ~8% per standard mouse notch, gradual on trackpad
        const factor = Math.min(1.22, Math.max(0.82, Math.exp(-delta * 0.001)));
        const targetZoom = +(lbZoom * factor).toFixed(3);

        if (targetZoom < 1.01) {
            lbResetZoom(true);
        } else {
            lbSetZoom(Math.min(6.0, targetZoom), e.clientX, e.clientY, false);
        }
    }, { passive: false });

    // Drag to pan image ("move zoom")
    const startDrag = (e) => {
        if (e.button !== 0) return; // Left click only
        if (lbZoom <= 1.01) return;
        if (e.target.closest('#lbToolbar, .lb-close, .lb-nav, .lb-info')) return;

        e.preventDefault();
        lbIsDragging = true;
        lbHasMoved = false;
        lbDragStartX = e.clientX;
        lbDragStartY = e.clientY;
        lbPanStartX = lbPanX;
        lbPanStartY = lbPanY;
        img.classList.add('dragging');
    };

    img.addEventListener('mousedown', startDrag);
    wrap.addEventListener('mousedown', startDrag);

    window.addEventListener('mousemove', (e) => {
        if (!lbIsDragging) return;
        const dx = e.clientX - lbDragStartX;
        const dy = e.clientY - lbDragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            lbHasMoved = true;
        }
        lbPanX = lbPanStartX + dx;
        lbPanY = lbPanStartY + dy;
        lbApplyTransform(false);
    });

    window.addEventListener('mouseup', () => {
        if (!lbIsDragging) return;
        lbIsDragging = false;
        if (img) img.classList.remove('dragging');
        if (lbZoom <= 1.01) {
            lbPanX = 0;
            lbPanY = 0;
            lbApplyTransform(true);
        }
    });

    // Double-click toggle (1x <-> 2.5x)
    img.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (lbZoom > 1.05) {
            lbResetZoom(true);
        } else {
            lbSetZoom(2.5, e.clientX, e.clientY, true);
        }
    });

    // Touch pinch & pan support for mobile
    let initialTouchDist = 0;
    let initialZoom = 1;
    let touchStartX = 0;
    let touchStartY = 0;

    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = lbZoom;
        } else if (e.touches.length === 1 && lbZoom > 1.01) {
            lbIsDragging = true;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            lbPanStartX = lbPanX;
            lbPanStartY = lbPanY;
        }
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialTouchDist > 0) {
            e.preventDefault();
            const curDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleChange = curDist / initialTouchDist;
            const target = Math.min(6.0, Math.max(1.0, +(initialZoom * scaleChange).toFixed(2)));
            if (target <= 1.01) {
                lbResetZoom(false);
            } else {
                lbSetZoom(target, null, null, false);
            }
        } else if (e.touches.length === 1 && lbIsDragging) {
            e.preventDefault();
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;
            lbPanX = lbPanStartX + dx;
            lbPanY = lbPanStartY + dy;
            lbApplyTransform(false);
        }
    }, { passive: false });

    wrap.addEventListener('touchend', () => {
        lbIsDragging = false;
        if (lbZoom <= 1.01) {
            lbResetZoom(true);
        }
    }, { passive: true });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (!lb.classList.contains('open')) return;
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            lbZoomIn();
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            lbZoomOut();
        } else if (e.key === '0') {
            e.preventDefault();
            lbResetZoom(true);
        } else if (e.key === '1') {
            e.preventDefault();
            lbToggleActualSize();
        } else if (e.key === 'Escape') {
            if (lbZoom > 1.05) {
                e.preventDefault();
                lbResetZoom(true);
            } else {
                closeLightbox();
            }
        }
    });

    // Safe lightbox backdrop click
    lb.addEventListener('click', (e) => {
        if (lbHasMoved) {
            lbHasMoved = false;
            return;
        }
        if (e.target.closest('#lbToolbar, .lb-close, .lb-nav, .lb-info, #lbImg')) {
            return;
        }
        closeLightbox();
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightboxZoomEvents);
} else {
    initLightboxZoomEvents();
}

function postAction(data) {
    const body = new URLSearchParams({ csrf_token: CSRF_TOKEN, ...data });
    return fetch(ACTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    }).then(r => r.json());
}

function rebuildImageListFromDOM() {
    const list = [];
    document.querySelectorAll('.file-row[data-is-img="1"]').forEach((row, idx) => {
        const name = row.getAttribute('data-name');
        const url = row.getAttribute('data-url');
        if (name && url) {
            list.push({ name: name, url: url, idx: idx });
        }
    });
    if (!list.length) {
        document.querySelectorAll('.img-card').forEach((card, idx) => {
            const nameEl = card.querySelector('.img-card-name');
            const urlInput = card.querySelector('.img-url-input');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const url = urlInput ? urlInput.value.trim() : '';
            if (name && url) {
                list.push({ name: name, url: url, idx: idx });
            }
        });
    }
    if (list.length) {
        IMAGE_LIST = list;
    }
}

let lbLoadToken = 0;

let lbSpinnerTimer = null;
function lbSetLoading(loading) {
    const spinner = document.getElementById('lbSpinner');
    clearTimeout(lbSpinnerTimer);
    if (!spinner) return;
    if (loading) {
        // Only show the spinner if the image takes noticeably long (cached images appear with no flash)
        lbSpinnerTimer = setTimeout(() => { spinner.style.display = 'flex'; }, 220);
    } else {
        spinner.style.display = 'none';
    }
}

function lbPrefetchNeighbors(idx) {
    if (!IMAGE_LIST || !IMAGE_LIST.length || IMAGE_LIST.length <= 1) return;
    const n = IMAGE_LIST.length;
    [1, -1, 2, -2, 3, -3].forEach((d, k) => {
        const item = IMAGE_LIST[((idx + d) % n + n) % n];
        if (item && item.url) lbWarmImage(item.url, k < 2 ? 'high' : 'low');
    });
}

function loadLightboxImage(targetUrl, altName, thumbUrl = '') {
    const img = document.getElementById('lbImg');
    if (!img) return;

    const currentToken = ++lbLoadToken;

    // Load the real image directly (no blurry thumbnail step). Images are small WebP, so this is fast
    // and the browser can paint it progressively as it downloads.
    img.onload = null;
    img.onerror = null;
    img.alt = altName || '';
    img.classList.remove('lb-thumb-preview');
    img.style.opacity = '0';
    lbSetLoading(true);

    img.onload = () => {
        if (currentToken !== lbLoadToken) return;
        lbSetLoading(false);
        requestAnimationFrame(() => {
            img.style.opacity = '1';
            lbResetZoom(false);
        });
    };
    img.onerror = () => {
        if (currentToken !== lbLoadToken) return;
        lbSetLoading(false);
        img.style.opacity = '0';
        toast('Could not load image: ' + (altName || 'file'), 'danger');
    };
    try { img.decoding = 'async'; img.fetchPriority = 'high'; } catch(e) {}
    img.src = targetUrl;
}

function openLightboxByName(name, optUrl = null, optThumbUrl = null) {
    if (!name && !optUrl) return;
    if (typeof IMAGE_LIST === 'undefined' || !Array.isArray(IMAGE_LIST) || !IMAGE_LIST.length) {
        rebuildImageListFromDOM();
    }
    let idx = -1;
    if (Array.isArray(IMAGE_LIST) && IMAGE_LIST.length) {
        if (name) {
            idx = IMAGE_LIST.findIndex(i => i.name === name || decodeURIComponent(i.name) === decodeURIComponent(name));
            if (idx === -1) {
                idx = IMAGE_LIST.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
            }
        }
        if (idx === -1 && optUrl) {
            idx = IMAGE_LIST.findIndex(i => i.url === optUrl || i.public_url === optUrl);
        }
    }
    if (idx !== -1) {
        lbCurrentIndex = idx;
        lbShow(idx);
        return;
    }

    // Direct url fallback
    if (optUrl) {
        openLightboxSingle(optUrl, name || 'Preview', optThumbUrl);
        return;
    }

    // Fallback: search for thumbnail in DOM or file row
    try {
        const row = document.querySelector(`.file-row[data-name="${CSS.escape(name)}"]`);
        if (row) {
            const url = row.getAttribute('data-url');
            if (url) {
                openLightboxSingle(url, name, optThumbUrl);
                return;
            }
        }
        const imgEl = document.querySelector(`img[alt="${CSS.escape(name)}"]`);
        if (imgEl && imgEl.src) {
            openLightboxSingle(imgEl.src, name, imgEl.src);
            return;
        }
    } catch(e) {}
}

function openLightboxByIndex(idx) {
    if (typeof IMAGE_LIST === 'undefined' || !Array.isArray(IMAGE_LIST) || !IMAGE_LIST.length) {
        rebuildImageListFromDOM();
    }
    if (idx < 0 || idx >= IMAGE_LIST.length) return;
    lbCurrentIndex = idx;
    lbShow(idx);
}

function openLightboxSingle(url, name, thumbUrl = null) {
    lbResetZoom(false);
    const lb = document.getElementById('lightbox');
    const nameEl = document.getElementById('lbName');
    const counter = document.getElementById('lbCounter');
    const prev = document.getElementById('lbPrev');
    const next = document.getElementById('lbNext');

    if (nameEl) nameEl.textContent = name || 'Preview';
    if (counter) counter.textContent = '1 / 1';
    if (prev) prev.style.display = 'none';
    if (next) next.style.display = 'none';

    document.body.classList.add('lightbox-open');
    if (lb) {
        lb.classList.add('open');
        try { lb.focus(); } catch(e){}
    }
    document.body.style.overflow = 'hidden';

    loadLightboxImage(url, name, thumbUrl);
}

function lbShow(idx) {
    if (!IMAGE_LIST || !IMAGE_LIST.length) return;
    if (idx < 0) idx = IMAGE_LIST.length - 1;
    if (idx >= IMAGE_LIST.length) idx = 0;
    lbCurrentIndex = idx;
    lbResetZoom(false);
    const item = IMAGE_LIST[idx];
    if (!item) return;

    const lb = document.getElementById('lightbox');
    const name = document.getElementById('lbName');
    const counter = document.getElementById('lbCounter');
    const prev = document.getElementById('lbPrev');
    const next = document.getElementById('lbNext');

    if (name) name.textContent = item.name;
    if (counter) counter.textContent = (idx + 1) + ' / ' + IMAGE_LIST.length;

    if (IMAGE_LIST.length <= 1) {
        if (prev) prev.style.display = 'none';
        if (next) next.style.display = 'none';
    } else {
        if (prev) { prev.style.display = ''; prev.classList.remove('disabled'); }
        if (next) { next.style.display = ''; next.classList.remove('disabled'); }
    }

    document.body.classList.add('lightbox-open');
    if (lb) {
        lb.classList.add('open');
        try { lb.focus(); } catch(e){}
    }
    document.body.style.overflow = 'hidden';

    loadLightboxImage(item.url, item.name, item.thumb || '');
    lbPrefetchNeighbors(idx);
}

function lbNavigate(dir) {
    if (!IMAGE_LIST || IMAGE_LIST.length <= 1) return;
    let newIdx = lbCurrentIndex + dir;
    if (newIdx < 0) newIdx = IMAGE_LIST.length - 1;
    else if (newIdx >= IMAGE_LIST.length) newIdx = 0;
    lbCurrentIndex = newIdx;
    lbShow(lbCurrentIndex);
}

function closeLightbox() {
    lbLoadToken++;
    lbResetZoom(false);
    lbSetLoading(false);
    document.body.classList.remove('lightbox-open');
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
    const img = document.getElementById('lbImg');
    if (img) {
        img.classList.remove('lb-thumb-preview');
        img.style.opacity = '0';
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    document.body.style.overflow = '';
}

function lbCopyUrl() {
    const item = IMAGE_LIST[lbCurrentIndex];
    if (!item) return;
    navigator.clipboard.writeText(item.public_url || item.url).then(() => {
        const btn = document.getElementById('lbCopyBtn');
        btn.textContent = '✅ Copied!';
        toast('URL copied!');
        setTimeout(() => btn.textContent = '📋 Copy URL', 2000);
    });
}

/* ========== VIDEO MODAL ========== */
let currentVideoUrl = '';
let currentVideoName = '';

function openVideoModal(name, url) {
    currentVideoName = name || '';
    currentVideoUrl = url || '';
    const player = document.getElementById('videoPlayerElem');
    const title = document.getElementById('videoModalTitle');
    const badge = document.getElementById('videoModalBadge');
    const dlBtn = document.getElementById('videoDownloadBtn');

    if (title) title.textContent = currentVideoName;
    if (badge) {
        const ext = currentVideoName.split('.').pop() || 'VIDEO';
        badge.textContent = ext.toUpperCase();
    }
    if (dlBtn) {
        dlBtn.href = currentVideoUrl;
        dlBtn.download = currentVideoName;
    }

    if (player) {
        player.pause();
        player.preload = 'auto';
        const meta = document.getElementById('videoModalMeta');
        if (meta) meta.textContent = 'Connecting instant stream...';
        player.onloadedmetadata = () => {
            const w = player.videoWidth || 0;
            const h = player.videoHeight || 0;
            const d = player.duration || 0;
            const mins = Math.floor(d / 60);
            const secs = Math.floor(d % 60);
            const timeStr = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
            let q = '';
            if (h >= 2160) q = '4K Ultra HD';
            else if (h >= 1440) q = '2K Quad HD';
            else if (h >= 1080) q = '1080p Full HD';
            else if (h >= 720) q = '720p HD';
            else if (h > 0) q = h + 'p';
            if (meta) {
                meta.textContent = (w && h ? `${w}×${h}${q ? ' (' + q + ')' : ''} · ` : '') + (d > 0 ? `${timeStr} · ` : '') + 'Direct Instant Stream';
            }
        };
        player.src = currentVideoUrl;
        player.load();
        player.play().catch(() => {});
    }

    openModal('videoModal');
}

function closeVideoModal() {
    const player = document.getElementById('videoPlayerElem');
    if (player) {
        player.pause();
        player.removeAttribute('src');
        player.load();
    }
    closeModal('videoModal');
}

function copyVideoUrl() {
    if (!currentVideoUrl) return;
    navigator.clipboard.writeText(currentVideoUrl).then(() => {
        const btn = document.getElementById('videoCopyUrlBtn');
        if (btn) {
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy URL'; }, 2000);
        }
        if (typeof toast === 'function') toast('Direct video URL copied to clipboard!', 'success');
    });
}

function copyVideoEmbed() {
    if (!currentVideoUrl) return;
    const embedCode = `<video src="${currentVideoUrl}" controls playsinline width="100%"></video>`;
    navigator.clipboard.writeText(embedCode).then(() => {
        const btn = document.getElementById('videoCopyEmbedBtn');
        if (btn) {
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = '</> Copy Embed'; }, 2000);
        }
        if (typeof toast === 'function') toast('HTML5 video embed code copied!', 'success');
    });
}

function copyAllVideoUrls() {
    const inputs = document.querySelectorAll('.video-urls-panel .url-list-input');
    const urls = Array.from(inputs).map(i => i.value).filter(v => v);
    if (!urls.length) {
        if (typeof toast === 'function') toast('No videos to copy', 'warning');
        return;
    }
    navigator.clipboard.writeText(urls.join('\n')).then(() => {
        if (typeof toast === 'function') toast(`${urls.length} video URL(s) copied!`, 'success');
    });
}

function copyAllVideoEmbeds() {
    const inputs = document.querySelectorAll('.video-urls-panel .url-list-input');
    const urls = Array.from(inputs).map(i => i.value).filter(v => v);
    if (!urls.length) {
        if (typeof toast === 'function') toast('No videos to copy', 'warning');
        return;
    }
    const embeds = urls.map(u => `<video src="${u}" controls playsinline width="100%"></video>`).join('\n');
    navigator.clipboard.writeText(embeds).then(() => {
        if (typeof toast === 'function') toast(`${urls.length} video embed code(s) copied!`, 'success');
    });
}

/* ========== REAL VIDEO PREVIEW THUMBNAILS ========== */
function initVideoThumbnails() {
    const boxes = document.querySelectorAll('.thumb-video-box[data-video-url], .video-card-thumb-wrap[data-video-url]');
    if (!boxes.length) return;

    // Clean up old collided cache keys
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('kiuq_vt_') && !k.startsWith('kiuq_vt_v2_')) {
                localStorage.removeItem(k);
            }
        }
    } catch(e) {}

    boxes.forEach(box => {
        const url = box.getAttribute('data-video-url');
        if (!url) return;
        const posterImg = box.querySelector('.thumb-video-poster');
        const videoEl = box.querySelector('.thumb-video-el');
        const fallback = box.nextElementSibling;

        // Unique hash of full URL + filename ensures each video has its own distinct preview thumbnail
        let hash = 5381;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) + hash) + url.charCodeAt(i);
            hash = hash & hash;
        }
        const filePart = encodeURIComponent(url.split('/').pop() || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(-28);
        const cacheKey = 'kiuq_vt_v2_' + Math.abs(hash).toString(36) + '_' + filePart;

        // 1. Instant display from localStorage
        let cached = null;
        try { cached = localStorage.getItem(cacheKey); } catch(e) {}
        if (cached && posterImg) {
            posterImg.src = cached;
            posterImg.style.display = 'block';
            if (fallback && fallback.classList.contains('fti-video')) {
                fallback.style.display = 'none';
            }
        }

        // 2. Off-screen frame capture if not cached (lazy load to never freeze UI)
        if (!cached && window.IntersectionObserver) {
            const obs = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        observer.disconnect();
                        captureSingleVideoThumb(url, posterImg, fallback, box, cacheKey);
                    }
                });
            }, { rootMargin: '120px' });
            obs.observe(box);
        } else if (!cached) {
            // Non-blocking fallback
            setTimeout(() => {
                captureSingleVideoThumb(url, posterImg, fallback, box, cacheKey);
            }, 600);
        }

        // 3. Hover-to-play animated preview
        if (videoEl && !box._hoverInit) {
            box._hoverInit = true;
            let playPromise = null;
            box.addEventListener('mouseenter', () => {
                try {
                    videoEl.currentTime = 0;
                    playPromise = videoEl.play();
                } catch(e) {}
            });
            box.addEventListener('mouseleave', () => {
                if (playPromise) {
                    playPromise.then(() => {
                        videoEl.pause();
                        videoEl.currentTime = 0;
                    }).catch(() => {});
                } else {
                    try {
                        videoEl.pause();
                        videoEl.currentTime = 0;
                    } catch(e) {}
                }
            });
        }
    });
}
function captureSingleVideoThumb(url, posterImg, fallback, box, cacheKey) {
    try {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.muted = true;
        v.playsInline = true;
        v.preload = 'metadata';
        v.src = url;

        let captured = false;
        const grabFrame = () => {
            if (captured) return;
            try {
                if (v.videoWidth > 0 && v.videoHeight > 0) {
                    const cvs = document.createElement('canvas');
                    const aspect = v.videoHeight / v.videoWidth;
                    cvs.width = 240;
                    cvs.height = Math.max(90, Math.round(240 * aspect));
                    const ctx = cvs.getContext('2d');
                    ctx.drawImage(v, 0, 0, cvs.width, cvs.height);
                    const dataUrl = cvs.toDataURL('image/jpeg', 0.85);
                    if (posterImg) {
                        posterImg.src = dataUrl;
                        posterImg.style.display = 'block';
                    }
                    try { localStorage.setItem(cacheKey, dataUrl); } catch(e) {}
                    captured = true;
                    v.removeAttribute('src');
                    v.load();
                }
            } catch(e) {}
        };

        v.onloadedmetadata = () => {
            const target = Math.min(2.0, Math.max(0.3, (v.duration || 1) * 0.1));
            try { v.currentTime = target; } catch(e) {}
        };
        v.onseeked = () => { grabFrame(); };
        v.onloadeddata = () => { if (!captured) setTimeout(grabFrame, 300); };
        v.onerror = () => {
            if (!captured && fallback && fallback.classList.contains('fti-video')) {
                fallback.style.display = 'flex';
                box.style.display = 'none';
            }
        };
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', initVideoThumbnails);
window.addEventListener('load', initVideoThumbnails);

/* ========== PRO CODE EDITOR ========== */
let currentCodeFontSize = 13;

function initCodeEditor() {
    const textarea = document.getElementById('codeEditorTextarea');
    const gutter = document.getElementById('codeGutter');
    if (!textarea || !gutter) return;

    function updateLineNumbers() {
        const text = textarea.value;
        const lineCount = (text.match(/\n/g) || []).length + 1;
        let numStr = '';
        for (let i = 1; i <= lineCount; i++) {
            numStr += i + '\n';
        }
        gutter.textContent = numStr;

        const totalLinesEl = document.getElementById('codeTotalLines');
        if (totalLinesEl) totalLinesEl.textContent = lineCount + (lineCount === 1 ? ' line' : ' lines');

        const charCountEl = document.getElementById('codeCharCount');
        if (charCountEl) charCountEl.textContent = new Intl.NumberFormat().format(text.length) + ' chars';
    }

    function updateCursorPos() {
        const pos = textarea.selectionStart;
        const val = textarea.value.substring(0, pos);
        const lines = val.split('\n');
        const curLine = lines.length;
        const curCol = lines[lines.length - 1].length + 1;
        const curPosEl = document.getElementById('codeCursorPos');
        if (curPosEl) curPosEl.textContent = `Ln ${curLine}, Col ${curCol}`;
    }

    textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
    });

    textarea.addEventListener('input', () => {
        updateLineNumbers();
        updateCursorPos();
    });

    ['click', 'keyup', 'select', 'focus'].forEach(evt => {
        textarea.addEventListener(evt, updateCursorPos);
    });

    textarea.addEventListener('keydown', (e) => {
        // Tab indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (e.shiftKey) {
                const val = textarea.value;
                const lineStart = val.lastIndexOf('\n', start - 1) + 1;
                if (val.substring(lineStart, lineStart + 4) === '    ') {
                    textarea.value = val.substring(0, lineStart) + val.substring(lineStart + 4);
                    textarea.selectionStart = Math.max(lineStart, start - 4);
                    textarea.selectionEnd = Math.max(lineStart, end - 4);
                }
            } else {
                textarea.setRangeText('    ', start, end, 'end');
            }
            updateLineNumbers();
            updateCursorPos();
            return;
        }

        // Auto-indent on Enter
        if (e.key === 'Enter') {
            const start = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, start);
            const curLineText = textBefore.substring(textBefore.lastIndexOf('\n') + 1);
            const match = curLineText.match(/^([ \t]+)/);
            if (match) {
                e.preventDefault();
                const indent = '\n' + match[1];
                textarea.setRangeText(indent, start, start, 'end');
                updateLineNumbers();
                updateCursorPos();
                return;
            }
        }

        // Ctrl+S or Cmd+S quick save
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            const form = document.getElementById('codeEditorForm');
            if (form) form.submit();
        }
    });

    updateLineNumbers();
    updateCursorPos();
}

function adjustCodeFontSize(delta) {
    const textarea = document.getElementById('codeEditorTextarea');
    const gutter = document.getElementById('codeGutter');
    if (!textarea || !gutter) return;
    currentCodeFontSize = Math.min(24, Math.max(11, currentCodeFontSize + delta));
    textarea.style.setProperty('--code-font-size', currentCodeFontSize + 'px');
    gutter.style.setProperty('--code-font-size', currentCodeFontSize + 'px');
}

function toggleCodeWrap() {
    const textarea = document.getElementById('codeEditorTextarea');
    const textSpan = document.getElementById('codeWrapText');
    if (!textarea) return;
    const isNoWrap = textarea.classList.toggle('nowrap');
    if (textSpan) textSpan.textContent = isNoWrap ? 'Wrap: Off' : 'Wrap: On';
}

function toggleCodeFullscreen() {
    const box = document.getElementById('codeEditorModalBox');
    const icon = document.getElementById('codeFullscreenIcon');
    if (!box) return;
    const isFull = box.classList.toggle('fullscreen');
    if (icon) icon.textContent = isFull ? '🗗' : '⛶';
}

function copyEditorCode() {
    const textarea = document.getElementById('codeEditorTextarea');
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
        if (typeof toast === 'function') {
            toast('Code copied to clipboard!', 'success');
        } else {
            alert('Code copied to clipboard!');
        }
    }).catch(() => {
        textarea.select();
        document.execCommand('copy');
        if (typeof toast === 'function') toast('Code copied!', 'success');
    });
}

document.addEventListener('DOMContentLoaded', initCodeEditor);

/* ========== MODAL ========== */
let pendingDeleteForm = null;

function openModal(id) {
    if (id === 'moveModal') loadMoveDestOptions();
    if (id === 'editModal') initCodeEditor();
    if (id === 'uploadModal') {
        const webpCb = document.getElementById('autoWebpCheckbox');
        if (webpCb) {
            webpCb.checked = true;
        }
        const pathInp = document.querySelector('#uploadModal input[name="path"]');
        if (pathInp) {
            const activePath = (typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '')
                          || (typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '')
                          || (new URLSearchParams(window.location.search).get('path') || '');
            pathInp.value = activePath;
        }
        const pWrap = document.getElementById('uploadProgressWrap');
        if (pWrap) pWrap.style.display = 'none';
        const pBar = document.getElementById('uploadGlobalBar');
        if (pBar) pBar.style.width = '0%';
        const pPct = document.getElementById('uploadGlobalPercent');
        if (pPct) pPct.textContent = '0%';
        const pText = document.getElementById('uploadGlobalText');
        if (pText) pText.textContent = 'Preparing upload...';
        const pList = document.getElementById('uploadProgressList');
        if (pList) pList.innerHTML = '';
        const sBtn = document.getElementById('uploadSubmitBtn');
        if (sBtn) { sBtn.disabled = false; sBtn.textContent = 'Upload →'; }
    }
    const modalEl = document.getElementById(id);
    if (modalEl) {
        modalEl.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function openEditUserModal(user) {
    if (!user) return;
    const idInput = document.getElementById('editUserId');
    const usernameInput = document.getElementById('editUsername');
    const displayNameInput = document.getElementById('editDisplayName');
    const passwordInput = document.getElementById('editPassword');
    const roleSelect = document.getElementById('editRole');
    if (idInput) idInput.value = user.id || '';
    if (usernameInput) usernameInput.value = user.username || '';
    if (displayNameInput) displayNameInput.value = user.display_name || user.username || '';
    if (passwordInput) passwordInput.value = '';
    if (roleSelect) {
        roleSelect.value = user.role || 'staff';
        roleSelect.disabled = Boolean(user.is_main_admin || user.is_self);
    }
    openModal('editUserModal');
}

function toggleEditUserPassword(e) {
    const input = document.getElementById('editPassword');
    if (!input) return;
    const btn = e.currentTarget;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
        btn.title = 'Hide password';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
        btn.title = 'Show password';
    }
}
function closeModal(id) {
    if (id === 'videoModal') {
        const player = document.getElementById('videoPlayerElem');
        if (player) {
            player.pause();
            player.removeAttribute('src');
            player.load();
        }
    }
    if (id === 'deletePasswordModal') pendingDeleteForm = null;
    if (id === 'uploadModal') {
        window.__kiuqDroppedFiles = [];
        try {
            const fi = document.getElementById('upload-file-input');
            const fo = document.getElementById('upload-folder-input');
            if (fi) fi.value = '';
            if (fo) fo.value = '';
            const dzf = document.getElementById('dropZoneFiles');
            if (dzf) dzf.textContent = '';
        } catch(e) {}
    }
    const modalEl = document.getElementById(id);
    if (modalEl) modalEl.classList.remove('open');
    document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

function loadMoveDestOptions() {
    const select = document.getElementById('moveDestInput');
    if (!select || select.dataset.loaded === '1' || select.dataset.loading === '1') return;
    select.dataset.loading = '1';
    select.disabled = true;
    select.innerHTML = '<option value="">Loading folders...</option>';
    postAction({ action: 'get_folder_options', path: CURRENT_PATH })
        .then(d => {
            if (!d.success || !Array.isArray(d.options)) throw new Error('No folders');
            select.innerHTML = d.options.map(opt => {
                const value = escapeHtml(opt.path || '');
                const label = escapeHtml(opt.label || 'Root');
                return `<option value="${value}">${label}</option>`;
            }).join('');
            select.disabled = false;
            select.dataset.loaded = '1';
        })
        .catch(() => {
            select.innerHTML = '<option value="">Could not load folders</option>';
            select.disabled = true;
            toast('Could not load folders', 'danger');
        })
        .finally(() => { select.dataset.loading = '0'; });
}

/* ========== DASHBOARD THEME (PURGED FOR SMOOTHNESS & SPEED) ========== */
function initThemeDropzone() {}
function cssUrlForTheme(url) { return 'none'; }
function applyDashboardTheme(url) {
    try {
        localStorage.removeItem('kiuq_dashboard_theme');
        document.cookie = 'kiuq_dashboard_theme=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.documentElement.classList.remove('dashboard-themed');
        document.body.classList.remove('dashboard-themed');
        document.documentElement.style.removeProperty('--dashboard-bg-image');
        document.body.style.removeProperty('--dashboard-bg-image');
        const layer = document.getElementById('dashboardThemeLayer');
        if (layer) layer.remove();
    } catch(e) {}
}
function setThemeStatus(message, type) {}
function setDashboardTheme(url) { applyDashboardTheme(''); }
function saveThemeFromUrl(event) { if (event) event.preventDefault(); return false; }
function uploadDashboardTheme(input) {}
function addThemePreview(url, name, canDelete) {}
function deleteDashboardTheme(event, card) {}

/* ========== TOAST ========== */
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'danger' ? ' danger' : '');
    t.textContent = (type === 'success' ? '✅ ' : '⚠️ ') + msg;
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(() => {
        t.style.animation = 'toast-out 0.3s ease forwards';
        setTimeout(() => t.remove(), 300);
    }, 2400);
}

/* ========== THEME + MOBILE MENU + COLLAPSIBLE SIDEBAR ========== */
function toggleSidebar(open) {
    document.body.classList.toggle('sidebar-open', !!open);
}

function updateCollapseBtnTooltip() {
    const btn = document.getElementById('sidebarCollapseBtn');
    if (!btn) return;
    const isCollapsed = document.body.classList.contains('sidebar-collapsed');
    const text = isCollapsed ? 'Click to unhide' : 'Click to hide';
    btn.setAttribute('data-tooltip', text);
    btn.setAttribute('title', text);
    btn.setAttribute('aria-label', text);
    const tt = document.getElementById('sidebarTooltip');
    if (tt && tt.classList.contains('show') && tt.dataset.activeTarget === 'collapseBtn') {
        tt.textContent = text;
    }
}

function toggleSidebarCollapse(force) {
    const isCurrentlyCollapsed = document.body.classList.contains('sidebar-collapsed');
    const newState = force !== undefined ? !!force : !isCurrentlyCollapsed;
    document.body.classList.toggle('sidebar-collapsed', newState);
    try {
        localStorage.setItem('kiuq_sidebar_collapsed', newState ? '1' : '0');
    } catch(e){}
    updateCollapseBtnTooltip();
}

// Restore saved sidebar collapsed state on start (Default: COLLAPSED '1')
(function() {
    try {
        var saved = localStorage.getItem('kiuq_sidebar_collapsed');
        if (saved === '0') {
            document.body.classList.remove('sidebar-collapsed');
        } else {
            document.body.classList.add('sidebar-collapsed');
        }
    } catch(e){}
    updateCollapseBtnTooltip();
})();

/* ========== FLOATING SIDEBAR TOOLTIP (FOR COLLAPSED STATE & TOGGLE BUTTON) ========== */
function initSidebarTooltip() {
    const tt = document.getElementById('sidebarTooltip');
    if (!tt) return;

    let hideTimeout = null;

    document.addEventListener('mouseover', e => {
        // 1. Collapse toggle button hover (works when hidden or unhidden)
        const collapseBtn = e.target.closest('#sidebarCollapseBtn');
        if (collapseBtn) {
            clearTimeout(hideTimeout);
            const isCollapsed = document.body.classList.contains('sidebar-collapsed');
            const text = isCollapsed ? 'Click to unhide' : 'Click to hide';
            tt.textContent = text;
            tt.dataset.activeTarget = 'collapseBtn';
            const rect = collapseBtn.getBoundingClientRect();
            tt.style.top = (rect.bottom + 8) + 'px';
            tt.style.left = (rect.left + rect.width / 2) + 'px';
            tt.style.transform = 'translateX(-50%)';
            tt.classList.add('show');
            return;
        }

        // 2. Sidebar buttons hover (active only when sidebar is collapsed)
        if (!document.body.classList.contains('sidebar-collapsed')) {
            if (tt.classList.contains('show')) tt.classList.remove('show');
            return;
        }

        const target = e.target.closest('.sidebar-btn[data-tooltip]');
        if (target) {
            clearTimeout(hideTimeout);
            const text = target.getAttribute('data-tooltip') || target.getAttribute('title');
            if (text) {
                tt.textContent = text;
                tt.dataset.activeTarget = 'sidebarBtn';
                const rect = target.getBoundingClientRect();
                const top = rect.top + (rect.height / 2);
                const left = rect.right + 12;
                tt.style.top = top + 'px';
                tt.style.left = left + 'px';
                tt.style.transform = 'translateY(-50%)';
                tt.classList.add('show');
                return;
            }
        }
        tt.classList.remove('show');
        tt.dataset.activeTarget = '';
    });

    document.addEventListener('mouseout', e => {
        const collapseBtn = e.target.closest('#sidebarCollapseBtn');
        if (collapseBtn && !collapseBtn.contains(e.relatedTarget)) {
            hideTimeout = setTimeout(() => {
                tt.classList.remove('show');
                tt.dataset.activeTarget = '';
            }, 60);
            return;
        }
        const target = e.target.closest('.sidebar-btn[data-tooltip]');
        if (target && !target.contains(e.relatedTarget)) {
            hideTimeout = setTimeout(() => {
                tt.classList.remove('show');
                tt.dataset.activeTarget = '';
            }, 60);
        }
    });

    window.addEventListener('scroll', () => {
        if (tt.classList.contains('show')) tt.classList.remove('show');
    }, { passive: true });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initSidebarTooltip();
        updateCollapseBtnTooltip();
    });
} else {
    initSidebarTooltip();
    updateCollapseBtnTooltip();
}

/* ========== INTERACTIVE PROFILE DROPDOWN ========== */
function toggleProfileDropdown(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const wrap = document.getElementById('profileDropdownWrap');
    const menu = document.getElementById('profileDropdownMenu');
    const btn = document.getElementById('profileChipBtn');
    if (!wrap || !menu) return;
    const isOpen = wrap.classList.contains('open') || menu.classList.contains('show');
    if (isOpen) {
        wrap.classList.remove('open');
        menu.classList.remove('show');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    } else {
        wrap.classList.add('open');
        menu.classList.add('show');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }
}

function closeProfileDropdown() {
    const wrap = document.getElementById('profileDropdownWrap');
    const menu = document.getElementById('profileDropdownMenu');
    const btn = document.getElementById('profileChipBtn');
    if (wrap) wrap.classList.remove('open');
    if (menu) menu.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', e => {
    const wrap = document.getElementById('profileDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
        wrap.classList.remove('open');
        const menu = document.getElementById('profileDropdownMenu');
        if (menu) menu.classList.remove('show');
        const btn = document.getElementById('profileChipBtn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
});

function toggleTheme() {
    const root = document.documentElement;
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    root.style.colorScheme = next;
    document.body.style.backgroundColor = '';
    localStorage.setItem('kiuqTheme', next);
    updateThemeButton();
    const body = new URLSearchParams({
        action: 'set_theme',
        csrf_token: CSRF_TOKEN,
        theme: next
    });
    fetch(ACTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    }).catch(() => {});
}

function updateThemeButton() {
    // The slide animation is handled by CSS using [data-theme="dark"]
}
updateThemeButton();

/* ========== TRASH SELECTION ========== */
function selectedTrashIds() {
    return [...document.querySelectorAll('.trash-item-check:checked')].map(input => input.value);
}

function updateTrashSelection() {
    const ids = selectedTrashIds();
    document.querySelectorAll('.trash-bulk-btn').forEach(btn => btn.disabled = ids.length === 0);
    const all = document.getElementById('trashSelectAll');
    if (all) {
        const total = document.querySelectorAll('.trash-item-check').length;
        all.checked = total > 0 && ids.length === total;
    }
}

function toggleTrashSelectAll(source) {
    document.querySelectorAll('.trash-item-check').forEach(input => input.checked = source.checked);
    updateTrashSelection();
}

function submitTrashBulk(action) {
    const ids = selectedTrashIds();
    if (!ids.length) { toast('No trash items selected', 'danger'); return; }
    const form = document.getElementById('trashBulkForm');
    const inputs = document.getElementById('trashBulkInputs');
    document.getElementById('trashBulkAction').value = action;
    inputs.innerHTML = '';
    ids.forEach(id => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'trash_ids[]';
        input.value = id;
        inputs.appendChild(input);
    });
    if (action === 'delete_trash_selected') {
        addDeletePassword(form, 'Permanently delete ' + ids.length + ' selected trash item(s)? This cannot be undone.');
        return;
    }
    HTMLFormElement.prototype.submit.call(form);
}

/* ========== RESIZE IMAGES ========== */
let currentResizeMode = 'filesize';
let selectedResizeFiles = [];

function getResizeEscHtml(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(str);
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function openResizeImageModal() {
    const allImgChecks = [...document.querySelectorAll('.file-item-check[data-is-img="1"]')];
    if (allImgChecks.length === 0) {
        if (typeof toast === 'function') toast('No image files found in the current folder to resize.', 'warning');
        return;
    }

    const checkedImgs = allImgChecks.filter(c => c.checked);
    if (checkedImgs.length > 0) {
        selectedResizeFiles = checkedImgs.map(c => ({
            name: c.dataset.name,
            size: parseInt(c.dataset.size || '0')
        }));
    } else {
        selectedResizeFiles = allImgChecks.map(c => ({
            name: c.dataset.name,
            size: parseInt(c.dataset.size || '0')
        }));
        allImgChecks.forEach(c => c.checked = true);
        if (typeof updateSelectedCount === 'function') updateSelectedCount();
    }

    renderResizeFileList();
    switchResizeTab(currentResizeMode || 'filesize');

    const progressWrap = document.getElementById('resizeProgressWrap');
    if (progressWrap) progressWrap.style.display = 'none';
    const resList = document.getElementById('resizeResultsList');
    if (resList) resList.innerHTML = '';
    const submitBtn = document.getElementById('resizeSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📐 Resize Images →';
    }

    openModal('resizeImageModal');
}

function openResizeImageModalSingle(fileName, size) {
    document.querySelectorAll('.file-item-check').forEach(c => {
        c.checked = (c.dataset.name === fileName);
    });
    if (typeof updateSelectedCount === 'function') updateSelectedCount();

    selectedResizeFiles = [{
        name: fileName,
        size: parseInt(size || '0')
    }];

    renderResizeFileList();
    switchResizeTab(currentResizeMode || 'filesize');

    const progressWrap = document.getElementById('resizeProgressWrap');
    if (progressWrap) progressWrap.style.display = 'none';
    const resList = document.getElementById('resizeResultsList');
    if (resList) resList.innerHTML = '';
    const submitBtn = document.getElementById('resizeSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📐 Resize Image →';
    }

    openModal('resizeImageModal');
}

function renderResizeFileList() {
    const listEl = document.getElementById('resizeFileList');
    const badgeEl = document.getElementById('resizeSelectedBadge');
    const summaryEl = document.getElementById('resizeSummaryText');
    if (!listEl) return;

    listEl.innerHTML = '';
    const count = selectedResizeFiles.length;
    if (badgeEl) badgeEl.textContent = count + (count === 1 ? ' image' : ' images');
    if (summaryEl) summaryEl.textContent = count > 0 ? `Selected Images (${count})` : 'No images selected';

    if (count === 0) {
        listEl.innerHTML = '<span style="color:var(--muted); font-size:11.5px; font-style:italic;">No images selected. Click "Select All Images" above or check boxes in the list.</span>';
        return;
    }

    selectedResizeFiles.forEach((f, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:inline-flex; align-items:center; gap:6px; background:var(--card); border:1px solid var(--line); border-radius:6px; padding:4px 9px; font-size:11.5px; font-weight:600; color:var(--text);';
        const formattedSize = typeof formatBytes === 'function' ? formatBytes(f.size) : (f.size > 0 ? (f.size / 1048576).toFixed(1) + ' MB' : '');
        item.innerHTML = `
            <span>🖼️ ${getResizeEscHtml(f.name)}</span>
            <span style="color:var(--muted); font-size:10px; font-weight:500;">(${formattedSize})</span>
            <span style="cursor:pointer; color:#ef4444; font-weight:bold; padding:0 2px; margin-left:3px;" title="Remove from resize selection" onclick="removeResizeFile(${idx})">✕</span>
        `;
        listEl.appendChild(item);
    });
}

function removeResizeFile(index) {
    if (index >= 0 && index < selectedResizeFiles.length) {
        const removed = selectedResizeFiles.splice(index, 1)[0];
        const chk = document.querySelector(`.file-item-check[data-name="${CSS.escape(removed.name)}"]`);
        if (chk) chk.checked = false;
        if (typeof updateSelectedCount === 'function') updateSelectedCount();
        renderResizeFileList();
    }
}

function resizeSelectAllImages(selectAll) {
    const allImgChecks = [...document.querySelectorAll('.file-item-check[data-is-img="1"]')];
    if (selectAll) {
        allImgChecks.forEach(c => c.checked = true);
        selectedResizeFiles = allImgChecks.map(c => ({
            name: c.dataset.name,
            size: parseInt(c.dataset.size || '0')
        }));
    } else {
        allImgChecks.forEach(c => c.checked = false);
        selectedResizeFiles = [];
    }
    if (typeof updateSelectedCount === 'function') updateSelectedCount();
    renderResizeFileList();
}

function switchResizeTab(mode) {
    currentResizeMode = mode;
    const tabFilesize = document.getElementById('tabContentFilesize');
    const tabDimensions = document.getElementById('tabContentDimensions');
    const tabPercentage = document.getElementById('tabContentPercentage');

    const btnFilesize = document.getElementById('tabBtnFilesize');
    const btnDimensions = document.getElementById('tabBtnDimensions');
    const btnPercentage = document.getElementById('tabBtnPercentage');

    if (tabFilesize) tabFilesize.style.display = (mode === 'filesize') ? 'block' : 'none';
    if (tabDimensions) tabDimensions.style.display = (mode === 'dimensions') ? 'block' : 'none';
    if (tabPercentage) tabPercentage.style.display = (mode === 'percentage') ? 'block' : 'none';

    const activeBg = '#0284c7';
    const activeColor = '#ffffff';
    const inactiveBg = 'transparent';
    const inactiveColor = 'var(--muted)';

    if (btnFilesize) {
        btnFilesize.style.background = (mode === 'filesize') ? activeBg : inactiveBg;
        btnFilesize.style.color = (mode === 'filesize') ? activeColor : inactiveColor;
    }
    if (btnDimensions) {
        btnDimensions.style.background = (mode === 'dimensions') ? activeBg : inactiveBg;
        btnDimensions.style.color = (mode === 'dimensions') ? activeColor : inactiveColor;
    }
    if (btnPercentage) {
        btnPercentage.style.background = (mode === 'percentage') ? activeBg : inactiveBg;
        btnPercentage.style.color = (mode === 'percentage') ? activeColor : inactiveColor;
    }
}

function setResizeTarget(val, unit) {
    const input = document.getElementById('resizeTargetSizeInput');
    const unitSelect = document.getElementById('resizeSizeUnitInput');
    if (input) input.value = val;
    if (unitSelect) unitSelect.value = unit;
}

function setResizeDims(w, h) {
    const widthInput = document.getElementById('resizeWidthInput');
    const heightInput = document.getElementById('resizeHeightInput');
    if (widthInput) widthInput.value = w;
    if (heightInput) heightInput.value = h;
}

function setResizePercent(p) {
    const range = document.getElementById('resizePercentRange');
    const valText = document.getElementById('resizePercentVal');
    if (range) range.value = p;
    if (valText) valText.textContent = p + '%';
}

function executeImageResize() {
    if (selectedResizeFiles.length === 0) {
        if (typeof toast === 'function') toast('Please select at least one image to resize.', 'warning');
        return;
    }

    const files = selectedResizeFiles.map(f => f.name);
    const saveMode = document.getElementById('resizeSaveMode')?.value || 'replace';
    const outputFormat = document.getElementById('resizeOutputFormat')?.value || 'original';

    let targetSize = 5;
    let sizeUnit = 'MB';
    let targetWidth = 0;
    let targetHeight = 0;
    let maintainRatio = true;
    let percentage = 50;

    if (currentResizeMode === 'filesize') {
        targetSize = parseFloat(document.getElementById('resizeTargetSizeInput')?.value || '5');
        sizeUnit = document.getElementById('resizeSizeUnitInput')?.value || 'MB';
        if (isNaN(targetSize) || targetSize <= 0) {
            if (typeof toast === 'function') toast('Please enter a valid target file size.', 'warning');
            return;
        }
    } else if (currentResizeMode === 'dimensions') {
        targetWidth = parseInt(document.getElementById('resizeWidthInput')?.value || '0');
        targetHeight = parseInt(document.getElementById('resizeHeightInput')?.value || '0');
        maintainRatio = document.getElementById('resizeMaintainRatio')?.checked ?? true;
        if (targetWidth <= 0 && targetHeight <= 0) {
            if (typeof toast === 'function') toast('Please specify at least Max Width or Max Height.', 'warning');
            return;
        }
    } else if (currentResizeMode === 'percentage') {
        percentage = parseInt(document.getElementById('resizePercentRange')?.value || '50');
        if (isNaN(percentage) || percentage <= 0 || percentage > 200) {
            if (typeof toast === 'function') toast('Please specify a valid percentage between 5% and 200%.', 'warning');
            return;
        }
    }

    const submitBtn = document.getElementById('resizeSubmitBtn');
    const progressWrap = document.getElementById('resizeProgressWrap');
    const progressBar = document.getElementById('resizeProgressBar');
    const progressText = document.getElementById('resizeProgressText');
    const resultsList = document.getElementById('resizeResultsList');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Resizing...';
    }
    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = '35%';
    if (progressText) progressText.textContent = `Processing ${files.length} image(s)... Please wait.`;
    if (resultsList) resultsList.innerHTML = '';

    const csrfTokenVal = (typeof CSRF_TOKEN !== 'undefined' ? CSRF_TOKEN : '')
        || (typeof F_CSRF_TOKEN !== 'undefined' ? F_CSRF_TOKEN : '')
        || document.querySelector('input[name="csrf_token"]')?.value
        || '';
    const currentPathVal = (typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '')
        || (typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '')
        || (new URLSearchParams(window.location.search).get('path') || '');

    const formData = new FormData();
    formData.append('csrf_token', csrfTokenVal);
    formData.append('action', 'resize_images');
    formData.append('upload_ajax', '1');
    formData.append('path', currentPathVal);
    formData.append('resize_mode', currentResizeMode);
    formData.append('target_size', String(targetSize));
    formData.append('size_unit', sizeUnit);
    formData.append('target_width', String(targetWidth));
    formData.append('target_height', String(targetHeight));
    formData.append('maintain_ratio', maintainRatio ? '1' : '0');
    formData.append('percentage', String(percentage));
    formData.append('save_mode', saveMode);
    formData.append('output_format', outputFormat);
    files.forEach(f => formData.append('files[]', f));

    const targetUrl = ACTION_ENDPOINT || window.location.pathname || window.location.href;

    fetch(targetUrl, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        body: formData
    })
    .then(async r => {
        const text = await r.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Non-JSON server response:', text);
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                if (text.includes('login') || text.includes('Sign In')) {
                    throw new Error('Your session expired. Please refresh the page and sign in again.');
                }
                throw new Error('Server returned an unexpected page instead of JSON. Please refresh and try again.');
            }
            throw new Error(text.slice(0, 120) || 'Invalid server response');
        }
        return data;
    })
    .then(data => {
        if (progressBar) progressBar.style.width = '100%';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '📐 Resize Images →';
        }

        if (data.success || (data.success_count && data.success_count > 0)) {
            if (progressText) progressText.innerHTML = `✅ <strong>Completed!</strong> ${getResizeEscHtml(data.message || '')}`;
            if (resultsList && Array.isArray(data.results)) {
                resultsList.innerHTML = data.results.map(r => {
                    if (r.success) {
                        return `<div style="color:#059669; font-weight:600; padding:2px 0;">✓ ${getResizeEscHtml(r.file)}${r.new_name !== r.file ? ' → ' + getResizeEscHtml(r.new_name) : ''} (${r.old_size_formatted} → ${r.new_size_formatted}, saved ${r.savings_percent}%)</div>`;
                    } else {
                        return `<div style="color:#dc2626; font-weight:600; padding:2px 0;">✕ ${getResizeEscHtml(r.file)}: ${getResizeEscHtml(r.message || 'Error')}</div>`;
                    }
                }).join('');
            }
            if (typeof toast === 'function') toast(data.message || 'Images resized successfully!', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1400);
        } else {
            if (progressText) progressText.innerHTML = `❌ <span style="color:#dc2626;">${getResizeEscHtml(data.message || 'Resize failed')}</span>`;
            if (resultsList && Array.isArray(data.results)) {
                resultsList.innerHTML = data.results.map(r => `<div style="color:#dc2626; padding:2px 0;">✕ ${getResizeEscHtml(r.file)}: ${getResizeEscHtml(r.message || 'Error')}</div>`).join('');
            }
            if (typeof toast === 'function') toast(data.message || 'Resize failed', 'danger');
        }
    })
    .catch(err => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '📐 Resize Images →';
        }
        if (progressText) progressText.innerHTML = `❌ <span style="color:#dc2626;">${getResizeEscHtml(err.message)}</span>`;
        if (typeof toast === 'function') toast('Resize error: ' + err.message, 'danger');
    });
}

/* ========== COPY ========== */
function copyUrl(inputId, btnId) {
    const val = document.getElementById(inputId).value;
    const btn = document.getElementById(btnId);
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
        if (btn) { btn.textContent = '✅'; btn.classList.add('copied'); }
        toast('URL copied!');
        setTimeout(() => { if (btn) { btn.textContent = '📋'; btn.classList.remove('copied'); } }, 2000);
    }).catch(() => { document.getElementById(inputId).select(); document.execCommand('copy'); toast('URL copied!'); });
}

function copyUrlDirect(url, btnId) {
    const btn = document.getElementById(btnId);
    navigator.clipboard.writeText(url).then(() => {
        if (btn) { const orig = btn.textContent; btn.textContent = '✅ Copied!'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000); }
        toast('URL copied!');
    }).catch(() => { toast('Copy failed', 'danger'); });
}

function copyAllUrls() {
    const ta = document.getElementById('allUrlsTextarea');
    let text = ta ? (ta.value || '').trim() : '';
    if (!text) {
        const inputs = document.querySelectorAll('.all-urls-panel:not(.video-urls-panel) .url-list-input');
        text = Array.from(inputs).map(i => i.value.trim()).filter(Boolean).join('\n');
    }
    if (!text) {
        if (typeof toast === 'function') toast('No image URLs to copy', 'warning');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        if (typeof toast === 'function') toast('All URLs copied as row!');
    }).catch(() => {
        if (typeof toast === 'function') toast('Copy failed', 'danger');
    });
}

function copyAllUrlsHorizontal() {
    const ta = document.getElementById('allUrlsTextarea');
    let urls = [];
    if (ta && ta.value && ta.value.trim()) {
        urls = ta.value.split('\n').map(u => u.trim()).filter(Boolean);
    } else {
        const inputs = document.querySelectorAll('.all-urls-panel:not(.video-urls-panel) .url-list-input');
        urls = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    }
    if (!urls.length) {
        if (typeof toast === 'function') toast('No image URLs to copy', 'warning');
        return;
    }
    navigator.clipboard.writeText(urls.join(', ')).then(() => {
        if (typeof toast === 'function') toast('All URLs copied horizontally!');
    }).catch(() => {
        if (typeof toast === 'function') toast('Copy failed', 'danger');
    });
}

function copySelectedUrls() {
    if (IS_CONVERTER) { toast('URL copy is not available for Converter role', 'danger'); return; }
    const checks = document.querySelectorAll('.file-item-check:checked');
    const urls = [];
    checks.forEach(c => { if (c.dataset.url) urls.push(c.dataset.url); });
    if (!urls.length) { toast('No images selected', 'danger'); return; }
    navigator.clipboard.writeText(urls.join('\n')).then(() => toast(urls.length + ' URL(s) copied as row!'));
}

function copySelectedUrlsHorizontal() {
    if (IS_CONVERTER) { toast('URL copy is not available for Converter role', 'danger'); return; }
    const checks = document.querySelectorAll('.file-item-check:checked');
    const urls = [];
    checks.forEach(c => { if (c.dataset.url) urls.push(c.dataset.url); });
    if (!urls.length) { toast('No images selected', 'danger'); return; }
    navigator.clipboard.writeText(urls.join(', ')).then(() => toast(urls.length + ' URL(s) copied horizontally!'));
}

/* ========== ROW CLICK / SELECTION MODE ========== */
let lastClickedIdx = null;
let selectionMode = false;

function enableSelectionMode() {
    const wasOff = !selectionMode;
    selectionMode = true;
    document.body.classList.add('selection-mode');
    if (wasOff) toast('Selection mode on');
}

function toggleSelectionMode() {
    if (selectionMode) {
        selectNone();
        toast('Selection cleared');
        return;
    }
    enableSelectionMode();
}

function rowClick(event, idx) {
    if (event.target.closest('.url-cell') || event.target.closest('.actions-cell') || event.target.closest('.rename-form')) return;
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'A' || event.target.tagName === 'IMG') return;

    const row = document.getElementById('row_' + idx);
    if (!row) return;

    // Single click on folder row opens the folder when not in selection mode
    if (row.dataset.isDir === '1' && !selectionMode && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const openUrl = row.dataset.openUrl;
        if (openUrl) {
            if (typeof navigateToFolder === 'function') {
                navigateToFolder(openUrl);
            } else {
                location.href = openUrl;
            }
            return;
        }
    }

    if (!selectionMode) return;

    const chk = row.querySelector('.file-item-check');

    if (event.shiftKey && lastClickedIdx !== null) {
        // range select
        const all = [...document.querySelectorAll('.file-item-check')];
        const start = Math.min(lastClickedIdx, idx);
        const end   = Math.max(lastClickedIdx, idx);
        for (let i = start; i <= end; i++) all[i].checked = true;
    } else if (event.ctrlKey || event.metaKey) {
        chk.checked = !chk.checked;
    } else {
        // normal click — toggle this row
        chk.checked = !chk.checked;
    }
    lastClickedIdx = idx;
    updateSelectedCount();
}

/* ========== SELECT ALL ========== */
function selectAll() {
    enableSelectionMode();
    document.querySelectorAll('.file-item-check').forEach(c => c.checked = true);
    const all = document.getElementById('selectAllChk');
    if (all) all.checked = true;
    updateSelectedCount();
}
function selectNone() {
    document.querySelectorAll('.file-item-check').forEach(c => c.checked = false);
    const all = document.getElementById('selectAllChk');
    if (all) all.checked = false;
    selectionMode = false;
    document.body.classList.remove('selection-mode');
    updateSelectedCount();
}
function selectAllToggle(src) {
    enableSelectionMode();
    document.querySelectorAll('.file-item-check').forEach(c => c.checked = src.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    const n = checks.length;
    const selectedCount = document.getElementById('selectedCount');
    if (selectedCount) selectedCount.textContent = n + ' selected';

    document.querySelectorAll('.file-row').forEach(row => {
        const chk = row.querySelector('.file-item-check');
        if (chk) row.classList.toggle('selected', chk.checked);
    });
}

function addDeletePassword(form, message) {
    pendingDeleteForm = form;
    const msg = document.getElementById('deletePasswordMessage');
    const input = document.getElementById('deletePasswordInput');
    if (msg) msg.textContent = message || 'Enter the delete password to continue.';
    if (input) input.value = '';
    openModal('deletePasswordModal');
    setTimeout(() => input && input.focus(), 80);
    return false;
}

function submitDeletePassword(event) {
    event.preventDefault();
    if (!pendingDeleteForm) {
        closeModal('deletePasswordModal');
        return false;
    }
    const pwInput = document.getElementById('deletePasswordInput');
    const pw = pwInput ? (pwInput.value || 'confirmed') : 'confirmed';
    let input = pendingDeleteForm.querySelector('input[name="delete_password"]');
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'delete_password';
        pendingDeleteForm.appendChild(input);
    }
    input.value = pw;
    const form = pendingDeleteForm;
    pendingDeleteForm = null;
    closeModal('deletePasswordModal');

    if (typeof form.ajaxSubmit === 'function') {
        form.ajaxSubmit();
    } else {
        HTMLFormElement.prototype.submit.call(form);
    }
    return false;
}

function cancelDeletePassword() {
    pendingDeleteForm = null;
    closeModal('deletePasswordModal');
}

/* ========== DELETE ========== */
function deleteSelected() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('deleteSelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    const form = document.getElementById('deleteSelectedForm');
    if (IS_CONVERTER) {
        form.submit();
        return;
    }
    if (!addDeletePassword(form, 'Move ' + checks.length + ' item(s) to trash?')) return;
    form.submit();
}

function copySelectedItems() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('copySelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    document.getElementById('copySelectedForm').submit();
}

function downloadSelected() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('downloadSelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    document.getElementById('downloadSelectedForm').submit();
}

function pasteClipboard() {
    document.getElementById('pasteClipboardForm').submit();
}

/* ========== MOVE ========== */
function openMoveModal() {
    const checks = document.querySelectorAll('.file-item-check:checked');
    if (!checks.length) { toast('No items selected', 'danger'); return; }
    const container = document.getElementById('moveSelectedInputs');
    container.innerHTML = '';
    checks.forEach(c => {
        const inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'selected_names[]'; inp.value = c.dataset.name;
        container.appendChild(inp);
    });
    openModal('moveModal');
}


/* ========== RENAME ========== */
function showRename(i, name) {
    document.querySelectorAll('.inline-rename-form').forEach(form => form.style.display = 'none');
    document.querySelectorAll('.file-name-display').forEach(label => label.style.display = '');
    document.querySelectorAll('.file-title-row').forEach(row => row.style.display = '');
    document.querySelectorAll('.rename-btn').forEach(btn => btn.style.display = '');

    const form = document.getElementById('renameForm_' + i);
    const label = document.getElementById('fileNameDisplay_' + i);
    const titleRow = label?.closest('.file-title-row');
    const toggle = document.getElementById('renameToggle_' + i);
    if (!form) return;
    if (titleRow) titleRow.style.display = 'none';
    else if (label) label.style.display = 'none';
    if (toggle) toggle.style.display = 'none';
    form.style.display = 'flex';
    const input = form.querySelector('.rename-input');
    input.focus();
    const dot = name.lastIndexOf('.');
    const end = dot > 0 ? dot : name.length;
    input.setSelectionRange(0, end);
}
function hideRename(i) {
    const form = document.getElementById('renameForm_' + i);
    const label = document.getElementById('fileNameDisplay_' + i);
    const titleRow = label?.closest('.file-title-row');
    const toggle = document.getElementById('renameToggle_' + i);
    if (form) form.style.display = 'none';
    if (titleRow) titleRow.style.display = '';
    else if (label) label.style.display = '';
    if (toggle) toggle.style.display = '';
}
function renameKey(event, i) {
    if (event.key === 'Escape') {
        event.preventDefault();
        hideRename(i);
    }
}

/* ========== SEARCH ========== */
function filterFiles(q) {
    q = q.toLowerCase().trim();
    document.querySelectorAll('.file-row').forEach(row => {
        const name = (row.dataset.name || '').toLowerCase();
        row.style.display = (!q || name.includes(q)) ? '' : 'none';
    });
}

/* ========== DRAG + DROP ========== */
const globalDragOverlay = document.getElementById('globalDragOverlay');
let globalDragCounter = 0;

window.addEventListener('dragenter', (ev) => {
    ev.preventDefault();
    if (globalDragOverlay) {
        globalDragCounter++;
        if (globalDragCounter === 1) globalDragOverlay.classList.add('active');
    }
});
window.addEventListener('dragleave', (ev) => {
    ev.preventDefault();
    if (globalDragOverlay) {
        globalDragCounter--;
        if (globalDragCounter === 0) globalDragOverlay.classList.remove('active');
    }
});
window.addEventListener('dragover', (ev) => {
    ev.preventDefault();
});
window.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    if (globalDragOverlay) {
        globalDragCounter = 0;
        globalDragOverlay.classList.remove('active');
    }
    
    if (ev.dataTransfer) {
        const dropped = typeof scanDroppedItems === 'function' 
            ? await scanDroppedItems(ev.dataTransfer) 
            : Array.from(ev.dataTransfer.files || []);
        if (dropped && dropped.length > 0) {
            openModal('uploadModal');
            window.__kiuqDroppedFiles = dropped;
            updateDropZone();
            if (typeof toast === 'function') toast(dropped.length + ' file(s) ready — click Upload to start', 'success');
        }
    }
});

const dropZone = document.getElementById('dropZone');
if (dropZone) {
    ['dragenter','dragover'].forEach(e => dropZone.addEventListener(e, ev => { 
        ev.preventDefault(); 
        ev.stopPropagation();
        dropZone.classList.add('dragover'); 
    }));
    ['dragleave'].forEach(e => dropZone.addEventListener(e, ev => { 
        ev.preventDefault(); 
        ev.stopPropagation();
        dropZone.classList.remove('dragover'); 
    }));
    dropZone.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        dropZone.classList.remove('dragover');
        if (ev.dataTransfer) {
            const dropped = typeof scanDroppedItems === 'function' 
                ? await scanDroppedItems(ev.dataTransfer) 
                : Array.from(ev.dataTransfer.files || []);
            if (dropped && dropped.length > 0) {
                window.__kiuqDroppedFiles = dropped;
                updateDropZone();
            }
        }
    });
}
function updateDropZone(inp) {
    const el = document.getElementById('dropZoneFiles');
    if (!el) return;
    const fileInp = document.getElementById('upload-file-input');
    const folderInp = document.getElementById('upload-folder-input');
    const dropped = window.__kiuqDroppedFiles || [];
    const files = [
        ...(fileInp?.files ? Array.from(fileInp.files) : []),
        ...(folderInp?.files ? Array.from(folderInp.files) : []),
        ...dropped
    ];
    if (!files.length) {
        el.textContent = '';
        return;
    }
    let totalBytes = 0;
    for (let i = 0; i < files.length; i++) totalBytes += (files[i].size || 0);
    const names = [];
    for (let i = 0; i < Math.min(files.length, 3); i++) {
        names.push(files[i].webkitRelativePath || files[i].name);
    }
    const extra = files.length > 3 ? ' (+' + (files.length - 3) + ' more)' : '';
    el.innerHTML = '<span style="color:var(--accent); font-weight:800;">✓ ' + files.length + ' file(s) selected (' + formatBytes(totalBytes) + '):</span> ' +
                   '<span style="color:var(--muted); font-weight:500;">' + names.join(', ') + extra + '</span>';
}

function setUploadRowStatus(row, text, className) {
    if (!row) return;
    if (className) row.classList.add(className);
    const cell = row.querySelector('.upload-progress-percent');
    if (cell) cell.textContent = text;
}

function setUploadRowError(row, file, reason) {
    if (!row) return;
    row.classList.add('fail');
    setUploadRowStatus(row, 'Failed');
    const failText = file.name + ' - ' + reason;
    row.title = failText;
    const nameCell = row.querySelector('span');
    if (nameCell) nameCell.textContent = failText.length > 96 ? (failText.slice(0, 93) + '...') : failText;
}

/* ========== CLIENT-SIDE WEBP OPTIMIZE (upload far fewer bytes; same 1800px / q82 result as the server) ========== */
let __webpConvSlots = 0;
const __webpConvWaiters = [];
function acquireWebpSlot() {
    return new Promise(resolve => {
        const go = () => {
            if (__webpConvSlots < 3) { __webpConvSlots++; resolve(); }
            else __webpConvWaiters.push(go);
        };
        go();
    });
}
function releaseWebpSlot() {
    __webpConvSlots = Math.max(0, __webpConvSlots - 1);
    const next = __webpConvWaiters.shift();
    if (next) next();
}
function isClientWebpCandidate(file) {
    if (!file || typeof createImageBitmap !== 'function') return false;
    const ext = ((file.name || '').split('.').pop() || '').toLowerCase();
    if (!['jpg', 'jpeg', 'jfif', 'png', 'bmp'].includes(ext)) return false;
    return (file.size || 0) >= 300 * 1024;
}
async function clientConvertToWebp(file) {
    if (!isClientWebpCandidate(file)) return file;
    const MAX_DIM = 1800;
    await acquireWebpSlot();
    try {
        const bmp = await createImageBitmap(file); // applies EXIF orientation
        const r = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
        const tw = Math.max(1, Math.round(bmp.width * r));
        const th = Math.max(1, Math.round(bmp.height * r));
        let blob = null;
        if (typeof OffscreenCanvas !== 'undefined') {
            const c = new OffscreenCanvas(tw, th);
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bmp, 0, 0, tw, th);
            blob = await c.convertToBlob({ type: 'image/webp', quality: 0.82 });
        } else {
            const c = document.createElement('canvas');
            c.width = tw; c.height = th;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bmp, 0, 0, tw, th);
            blob = await new Promise(res => c.toBlob(res, 'image/webp', 0.82));
        }
        try { bmp.close(); } catch (e) {}
        // Keep the original when the browser can't make WebP or the result isn't smaller
        if (!blob || blob.type !== 'image/webp' || !blob.size || blob.size >= file.size) return file;
        const base = file.name.replace(/\.[^.]+$/, '');
        const out = new File([blob], base + '.webp', { type: 'image/webp', lastModified: file.lastModified || Date.now() });
        const rel = file.webkitRelativePath || '';
        if (rel) {
            const relNew = rel.replace(/[^/]*$/, base + '.webp');
            try { Object.defineProperty(out, 'webkitRelativePath', { value: relNew }); } catch (e) {}
        }
        return out;
    } catch (err) {
        return file;
    } finally {
        releaseWebpSlot();
    }
}
async function prepareBatchForUpload(batch, rows) {
    const autoWebp = document.getElementById('autoWebpCheckbox')?.checked ?? true;
    if (!autoWebp) return;
    await Promise.all(batch.map(async (item) => {
        const orig = item.file;
        if (!isClientWebpCandidate(orig)) return;
        const cell = rows[item.index]?.querySelector('.upload-progress-percent');
        if (cell) cell.textContent = 'Optimizing...';
        const converted = await clientConvertToWebp(orig);
        if (converted !== orig) {
            item.file = converted;
            item.isChunked = false;
        }
        if (cell) cell.textContent = '0%';
    }));
}

function buildUploadBatches(uploadableFiles) {
    const batches = [];
    const maxBatchFiles = 4; // 4 files per request = fewer round-trips, still parallel across up to 6 workers
    const maxBatchBytes = 28 * 1024 * 1024; // 28MB per batch max for direct multipart
    const CHUNK_SIZE_THRESHOLD = 25 * 1024 * 1024; // Only files > 25MB need streaming chunking
    let batch = [];
    let batchBytes = 0;

    uploadableFiles.forEach((file, index) => {
        const size = Math.max(1, file.size || 1);
        
        // Huge video or archive > 25MB gets its own dedicated chunked batch
        if (size > CHUNK_SIZE_THRESHOLD) {
            if (batch.length > 0) {
                batches.push(batch);
                batch = [];
                batchBytes = 0;
            }
            batches.push([{ file, index, isChunked: true }]);
            return;
        }

        if (
            batch.length > 0 &&
            (batch.length >= maxBatchFiles || batchBytes + size > maxBatchBytes)
        ) {
            batches.push(batch);
            batch = [];
            batchBytes = 0;
        }
        batch.push({ file, index, isChunked: false });
        batchBytes += size;
    });

    if (batch.length) batches.push(batch);
    return batches;
}

function errorMapFromUploadResponse(data) {
    const map = new Map();
    (Array.isArray(data.errors) ? data.errors : []).forEach((error) => {
        const text = String(error || '');
        const name = text.split(':')[0].trim();
        if (name) map.set(name.toLowerCase(), text);
    });
    return map;
}

function uploadErrorForFile(errors, fileName) {
    if (!errors || typeof errors.has !== 'function') return '';
    const lowerName = String(fileName || '').toLowerCase();
    if (errors.has(lowerName)) return errors.get(lowerName);
    for (const [name, message] of errors.entries()) {
        if (name && (lowerName.includes(name) || name.includes(lowerName))) {
            return message;
        }
    }
    return '';
}

function uploadStandardBatch(batch, rows, progressByFile, updateOverallProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        const csrf = (typeof CSRF_TOKEN !== 'undefined' ? CSRF_TOKEN : '')
                  || (typeof F_CSRF_TOKEN !== 'undefined' ? F_CSRF_TOKEN : '')
                  || (document.querySelector('input[name="csrf_token"]')?.value || '');
        const effectiveUploadPath = (typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '')
                                 || (typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '')
                                 || (document.querySelector('#uploadModal input[name="path"]')?.value || '');
        const endpoint = (typeof UPLOAD_ENDPOINT !== 'undefined' && UPLOAD_ENDPOINT)
                      ? UPLOAD_ENDPOINT
                      : ((typeof ACTION_ENDPOINT !== 'undefined' && ACTION_ENDPOINT)
                          ? ACTION_ENDPOINT
                          : (document.getElementById('uploadForm')?.getAttribute('action') || window.location.pathname));
        const autoWebp = document.getElementById('autoWebpCheckbox')?.checked ?? true;

        formData.append('csrf_token', csrf);
        formData.append('action', 'upload_files');
        formData.append('path', effectiveUploadPath);
        formData.append('upload_ajax', '1');
        formData.append('convert_webp', autoWebp ? '1' : '0');

        batch.forEach(item => {
            formData.append('upload_files[]', item.file, item.file.name);
            formData.append('upload_paths[]', item.file.webkitRelativePath || '');
        });

        const batchTotalBytes = batch.reduce((sum, item) => sum + Math.max(1, item.file.size || 1), 0);

        const xhr = new XMLHttpRequest();
        xhr.timeout = 180000;
        xhr.open('POST', endpoint, true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        xhr.upload.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            const loaded = Math.max(0, Math.min(batchTotalBytes, evt.loaded));
            let offset = 0;
            batch.forEach(({ file, index }) => {
                const size = Math.max(1, file.size || 1);
                const fileLoaded = Math.max(0, Math.min(size, loaded - offset));
                const percent = Math.max(0, Math.min(100, Math.round((fileLoaded / size) * 100)));
                progressByFile[index] = percent;
                const cell = rows[index]?.querySelector('.upload-progress-percent');
                if (cell) {
                    cell.textContent = percent === 100 ? '100% (Processing...)' : percent + '%';
                }
                offset += size;
            });
            updateOverallProgress();
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.onabort = () => reject(new Error('Upload aborted.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out.'));
        xhr.upload.onerror = () => reject(new Error('Network error during file upload.'));
        xhr.upload.ontimeout = () => reject(new Error('Upload connection timed out.'));

        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(xhr.status === 405 ? 'Upload rejected (HTTP 405). Refresh and try again.' : 'Server returned HTTP ' + xhr.status + '.'));
                return;
            }
            try {
                const data = JSON.parse(xhr.responseText || '{}');
                if (data.success) {
                    const errors = errorMapFromUploadResponse(data);
                    resolve({ data, errors });
                } else {
                    const firstError = Array.isArray(data.errors) && data.errors.length ? data.errors[0] : '';
                    reject(new Error(firstError || data.message || 'Upload failed'));
                }
            } catch (err) {
                reject(new Error('Server response invalid. Check upload size limit and refresh.'));
            }
        };

        xhr.send(formData);
    });
}

async function uploadChunkedBatch(batch, rows, progressByFile, updateOverallProgress) {
    const item = batch[0];
    const file = item.file;
    const index = item.index;
    const cell = rows[index]?.querySelector('.upload-progress-percent');
    const autoWebp = document.getElementById('autoWebpCheckbox')?.checked ?? true;
    if (cell) cell.textContent = '0%';

    const CHUNK_SIZE = typeof CHUNK_SIZE_BYTES !== 'undefined' && CHUNK_SIZE_BYTES > 0 ? CHUNK_SIZE_BYTES : (8 * 1024 * 1024);
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const chunkId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    const csrf = (typeof CSRF_TOKEN !== 'undefined' ? CSRF_TOKEN : '')
              || (typeof F_CSRF_TOKEN !== 'undefined' ? F_CSRF_TOKEN : '')
              || (document.querySelector('input[name="csrf_token"]')?.value || '');
    const effectiveUploadPath = (typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '')
                             || (typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '')
                             || (document.querySelector('#uploadModal input[name="path"]')?.value || '');
    const endpoint = (typeof UPLOAD_ENDPOINT !== 'undefined' && UPLOAD_ENDPOINT)
                  ? UPLOAD_ENDPOINT
                  : ((typeof ACTION_ENDPOINT !== 'undefined' && ACTION_ENDPOINT)
                      ? ACTION_ENDPOINT
                      : (document.getElementById('uploadForm')?.getAttribute('action') || window.location.pathname));

    let finalData = null;
    let finalErrors = new Map();

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('csrf_token', csrf);
        formData.append('action', 'upload_files');
        formData.append('path', effectiveUploadPath);
        formData.append('upload_ajax', '1');
        formData.append('convert_webp', autoWebp ? '1' : '0');
        formData.append('chunk_index', i);
        formData.append('total_chunks', totalChunks);
        formData.append('chunk_id', chunkId);
        formData.append('original_name', file.name);
        formData.append('upload_files[]', chunk, file.name);
        formData.append('upload_paths[]', file.webkitRelativePath || '');

        let resp = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                resp = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.timeout = 3600000;
                    xhr.open('POST', endpoint, true);
                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

                    xhr.upload.onprogress = (evt) => {
                        if (!evt.lengthComputable) return;
                        const chunkLoaded = evt.loaded;
                        const totalLoaded = start + chunkLoaded;
                        const percent = Math.max(0, Math.min(100, Math.round((totalLoaded / file.size) * 100)));
                        progressByFile[index] = percent;
                        if (cell) {
                            if (percent === 100 && i === totalChunks - 1) {
                                cell.textContent = '100% (Saving...)';
                            } else {
                                cell.textContent = percent + '%';
                            }
                        }
                        updateOverallProgress();
                    };

                    xhr.onerror = () => reject(new Error('Network error during chunk upload.'));
                    xhr.ontimeout = () => reject(new Error('Upload connection timed out.'));
                    xhr.onload = () => {
                        if (xhr.status < 200 || xhr.status >= 300) {
                            reject(new Error('Server returned HTTP ' + xhr.status + '.'));
                            return;
                        }
                        try {
                            const data = JSON.parse(xhr.responseText || '{}');
                            if (data.success || data.chunk_success) {
                                resolve(data);
                            } else {
                                const firstError = Array.isArray(data.errors) && data.errors.length ? data.errors[0] : '';
                                reject(new Error(firstError || data.message || 'Upload failed'));
                            }
                        } catch (err) {
                            reject(new Error('Invalid response from server.'));
                        }
                    };
                    xhr.send(formData);
                });
                break;
            } catch (err) {
                if (attempt === 2) throw err;
                await new Promise(r => setTimeout(r, 600));
            }
        }

        if (i === totalChunks - 1) {
            finalData = resp;
            if (finalData && finalData.success) {
                finalErrors = errorMapFromUploadResponse(finalData);
            }
        }
    }

    return { data: finalData, errors: finalErrors };
}

function uploadBatchWithProgress(batch, rows, progressByFile, updateOverallProgress) {
    if (batch.length === 0) return Promise.resolve({ data: null, errors: new Map() });
    if (batch.length === 1 && batch[0].isChunked) {
        return uploadChunkedBatch(batch, rows, progressByFile, updateOverallProgress);
    }
    return uploadStandardBatch(batch, rows, progressByFile, updateOverallProgress);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx++;
    }
    return (idx === 0 ? Math.round(value) : value.toFixed(1)) + ' ' + units[idx];
}

async function handleUploadSubmit(ev) {
    if (ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch(e){}
    }
    const fileInput = document.getElementById('upload-file-input');
    const folderInput = document.getElementById('upload-folder-input');
    const droppedFiles = window.__kiuqDroppedFiles || [];
    const rawFiles = [
        ...(fileInput?.files || []),
        ...(folderInput?.files || []),
        ...droppedFiles
    ];

    // Deduplicate
    const files = [];
    const seen = new Set();
    rawFiles.forEach(f => {
        const k = (f.name || '') + '__' + (f.size || 0) + '__' + (f.lastModified || 0);
        if (!seen.has(k)) {
            seen.add(k);
            files.push(f);
        }
    });

    // Selection is now captured: clear it so the same files are never re-sent on the next upload
    window.__kiuqDroppedFiles = [];
    try { if (fileInput) fileInput.value = ''; if (folderInput) folderInput.value = ''; } catch(e) {}
    try { const dzf = document.getElementById('dropZoneFiles'); if (dzf) dzf.textContent = ''; } catch(e) {}

    if (!files.length) {
        toast('No files selected', 'danger');
        return false;
    }

    const progressWrap = document.getElementById('uploadProgressWrap');
    const progressBar = document.getElementById('uploadGlobalBar');
    const progressText = document.getElementById('uploadGlobalText');
    const progressList = document.getElementById('uploadProgressList');
    const submitBtn = document.getElementById('uploadSubmitBtn');

    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = 'Preparing upload...';
    if (progressList) progressList.innerHTML = '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading...';
    }

    let successCount = 0;
    let failCount = 0;
    let completed = 0;
    const totalFiles = files.length;
    const uploadableFiles = [...files];

    const progressByFile = new Array(uploadableFiles.length).fill(0);
    const rows = uploadableFiles.map((file) => {
        const row = document.createElement('div');
        row.className = 'upload-progress-item';
        const safeName = escapeHtml(file.name);
        row.innerHTML = '<span title="' + safeName + '" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' +
                        safeName + ' <small style="color:var(--muted);font-weight:500;">(' + formatBytes(file.size) + ')</small></span>' +
                        '<span class="upload-progress-percent" style="font-weight:800;font-variant-numeric:tabular-nums;">0%</span>';
        if (progressList) progressList.appendChild(row);
        return row;
    });

    const uploadStartTime = Date.now();
    const updateOverallProgress = () => {
        const activePercent = progressByFile.reduce((sum, value) => sum + value, 0) / 100;
        const overall = ((completed + activePercent) / totalFiles) * 100;
        const roundedOverall = Math.min(100, Math.round(overall));
        if (progressBar) progressBar.style.width = roundedOverall + '%';
        const pPctEl = document.getElementById('uploadGlobalPercent');
        if (pPctEl) pPctEl.textContent = roundedOverall + '%';

        const elapsed = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
        let uploadedBytesSoFar = 0;
        uploadableFiles.forEach((f, idx) => {
            uploadedBytesSoFar += (f.size * (progressByFile[idx] || 0) / 100);
        });
        const speed = uploadedBytesSoFar / elapsed;
        const speedStr = speed > 50000 ? ' • ' + formatBytes(speed) + '/s' : '';
        if (progressText) {
            progressText.textContent = 'Completed ' + completed + '/' + totalFiles + ' files (' + roundedOverall + '%)' + speedStr;
        }
    };
    updateOverallProgress();

    const batches = buildUploadBatches(uploadableFiles);
    let nextBatchIndex = 0;
    const workerCount = Math.min(6, batches.length); // Up to 6 concurrent parallel workers
    async function worker() {
        while (true) {
            const batchIndex = nextBatchIndex;
            nextBatchIndex += 1;
            if (batchIndex >= batches.length) break;

            const batch = batches[batchIndex];
            try {
                await prepareBatchForUpload(batch, rows);
                const result = await uploadBatchWithProgress(batch, rows, progressByFile, updateOverallProgress);
                batch.forEach(({ file, index }) => {
                    const row = rows[index];
                    const error = uploadErrorForFile(result.errors, file.name);
                    if (error) {
                        progressByFile[index] = 100;
                        setUploadRowError(row, file, error.replace(file.name + ':', '').trim() || 'Upload failed');
                        failCount++;
                    } else {
                        progressByFile[index] = 100;
                        if (row) {
                            row.classList.add('done');
                            setUploadRowStatus(row, '100% ✓');
                        }
                        successCount++;
                    }
                    completed++;
                });
            } catch (err) {
                const reason = (err && err.message ? err.message : 'Failed');
                batch.forEach(({ file, index }) => {
                    progressByFile[index] = 100;
                    setUploadRowError(rows[index], file, reason);
                    failCount++;
                    completed++;
                });
            }
            updateOverallProgress();
        }
    }
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload →';
    }

    if (successCount > 0 && failCount === 0) {
        toast(successCount + ' file(s) uploaded successfully!', 'success');
        setTimeout(() => {
            try {
                if (typeof folderCache !== 'undefined') folderCache.clear();
                if (typeof prefetchedFolderUrls !== 'undefined') prefetchedFolderUrls.clear();
                closeModal('uploadModal');
                const cleanUrl = new URL(location.href);
                cleanUrl.searchParams.delete('msg');
                cleanUrl.searchParams.delete('msgtype');
                if (typeof navigateToFolder === 'function') {
                    navigateToFolder(cleanUrl.toString(), false);
                } else {
                    location.href = cleanUrl.toString();
                }
            } catch (e) {
                location.reload();
            }
        }, 700);
        return false;
    }
    if (successCount > 0 && failCount > 0) {
        toast(successCount + ' uploaded, ' + failCount + ' failed.', 'warning');
        setTimeout(() => {
            try {
                if (typeof folderCache !== 'undefined') folderCache.clear();
                if (typeof prefetchedFolderUrls !== 'undefined') prefetchedFolderUrls.clear();
                closeModal('uploadModal');
                const cleanUrl = new URL(location.href);
                cleanUrl.searchParams.delete('msg');
                cleanUrl.searchParams.delete('msgtype');
                if (typeof navigateToFolder === 'function') {
                    navigateToFolder(cleanUrl.toString(), false);
                } else {
                    location.href = cleanUrl.toString();
                }
            } catch (e) {
                location.reload();
            }
        }, 1200);
        return false;
    }
    toast('Upload failed for selected files.', 'danger');
    return false;
}

window.handleUploadSubmit = handleUploadSubmit;

const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', handleUploadSubmit);
}

/* ========== PJAX PROGRESS BAR ========== */
let pjaxBarSafetyTimer = null;
function startPjaxProgressBar() {
    const bar = document.getElementById('pjaxProgressBar');
    if (!bar) return;
    if (pjaxBarSafetyTimer) clearTimeout(pjaxBarSafetyTimer);

    bar.style.transition = 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease';
    bar.style.opacity = '1';
    bar.style.width = '35%';
    setTimeout(() => {
        if (bar.style.opacity === '1') bar.style.width = '75%';
    }, 120);

    // Watchdog: under NO circumstances should the progress bar stay stuck on screen longer than 4.5s
    pjaxBarSafetyTimer = setTimeout(() => {
        finishPjaxProgressBar();
    }, 4500);
}

function finishPjaxProgressBar() {
    if (pjaxBarSafetyTimer) {
        clearTimeout(pjaxBarSafetyTimer);
        pjaxBarSafetyTimer = null;
    }
    const bar = document.getElementById('pjaxProgressBar');
    if (!bar) return;
    bar.style.width = '100%';
    setTimeout(() => {
        bar.style.opacity = '0';
        setTimeout(() => {
            bar.style.width = '0%';
        }, 250);
    }, 180);
}

/* ========== HIGH-SPEED SEAMLESS FOLDER NAVIGATION (ZERO-DELAY PJAX) ========== */
let activeNavAbort = null;
const folderCache = new Map(); // canonicalUrl -> { html, title, meta, timestamp }
const inflightNavRequests = new Map(); // canonicalUrl -> Promise<string>
const prefetchedFolderUrls = new Set();
let prefetchHoverTimer = null;

function isSameDashboardApp(pathname) {
    if (!pathname) return false;
    const clean = p => p.replace(/\.php$/i, '').replace(/\/index$/i, '').replace(/\/+$/, '') || '/';
    const cur = clean(window.location.pathname);
    const target = clean(pathname);
    return cur === target || target === '/' || target.endsWith('/url-panel-belongtokiuq-kh');
}

function canonicalFolderUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
        const u = new URL(rawUrl, window.location.origin);
        const params = new URLSearchParams(u.search);
        
        // Remove non-folder-navigation parameters
        params.delete('pjax');
        params.delete('msg');
        params.delete('msgtype');
        params.delete('_');
        
        const pathVal = params.get('path');
        if (pathVal === null || pathVal === '') {
            params.delete('path');
        }
        
        params.sort();
        const qs = params.toString();
        const basePath = isSameDashboardApp(window.location.pathname) ? window.location.pathname : u.pathname;
        return basePath + (qs ? '?' + qs : '');
    } catch(e) {
        return rawUrl;
    }
}

function isFolderNavigationUrl(href) {
    if (!href) return false;
    try {
        const u = new URL(href, window.location.origin);
        if (u.origin !== window.location.origin) return false;
        if (!isSameDashboardApp(u.pathname)) return false;
        if (u.searchParams.has('download_item') || u.searchParams.has('edit') || u.searchParams.has('logout')) return false;
        if (u.searchParams.has('profile') || u.searchParams.has('trash') || u.searchParams.has('users') || u.searchParams.has('activity') || u.searchParams.has('settings') || u.searchParams.has('trash_preview')) return false;
        return true;
    } catch(e) {
        return false;
    }
}

function seedInitialFolderCache() {
    try {
        const curMain = document.querySelector('main.main') || document.querySelector('.main') || document.querySelector('main');
        if (!curMain) return;
        const canonicalKey = canonicalFolderUrl(window.location.href);
        if (!canonicalKey || folderCache.has(canonicalKey)) return;

        let meta = {
            title: document.title,
            currentPath: typeof CURRENT_PATH !== 'undefined' ? CURRENT_PATH : '',
            imageList: typeof IMAGE_LIST !== 'undefined' ? IMAGE_LIST : [],
            csrfToken: typeof CSRF_TOKEN !== 'undefined' ? CSRF_TOKEN : ''
        };

        const curImageUrls = Array.from(document.querySelectorAll('.all-urls-panel:not(.video-urls-panel) .url-list-input'))
            .map(i => i.value).filter(Boolean);
        if (curImageUrls.length) meta.imageUrls = curImageUrls;

        folderCache.set(canonicalKey, {
            html: curMain.innerHTML,
            title: document.title,
            meta: meta,
            timestamp: Date.now()
        });
    } catch(e) {
        console.warn('Initial folder cache seed error:', e);
    }
}

// Seed current folder immediately so back navigation is always 0ms instant
seedInitialFolderCache();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', seedInitialFolderCache);
}
window.addEventListener('load', seedInitialFolderCache);

window.invalidateFolderCache = function() {
    folderCache.clear();
    prefetchedFolderUrls.clear();
};

function updateActiveSidebarFolder(path) {
    document.querySelectorAll('.sidebar-btn').forEach(el => {
        el.classList.remove('active');
    });
    if (!path || path === '') {
        const homeBtn = document.querySelector('.sidebar-btn[data-nav-key="home"]');
        if (homeBtn) homeBtn.classList.add('active');
        return;
    }
    let matched = false;
    document.querySelectorAll('.sidebar-btn[data-nav-path]').forEach(el => {
        if (el.getAttribute('data-nav-path') === path) {
            el.classList.add('active');
            matched = true;
        }
    });
    if (!matched) {
        const homeBtn = document.querySelector('.sidebar-btn[data-nav-key="home"]');
        if (homeBtn) homeBtn.classList.add('active');
    }
}

function applyFolderNavData(url, mainHtml, title, meta, pushState) {
    if (!mainHtml || typeof mainHtml !== 'string') {
        window.location.href = url;
        return;
    }
    const canonicalKey = canonicalFolderUrl(url);
    const curMain = document.querySelector('main.main') || document.querySelector('.main') || document.querySelector('main');
    if (curMain) {
        // Smart in-place DOM morph: keep stat-cards & toolbar permanently mounted to eliminate any unmount blink
        const tempDoc = new DOMParser().parseFromString(mainHtml, 'text/html');
        const newStats = tempDoc.querySelector('.stats-row');
        const curStats = curMain.querySelector('.stats-row');
        const newPathbar = tempDoc.querySelector('.pathbar');
        const curPathbar = curMain.querySelector('.pathbar');
        const newPanel = tempDoc.querySelector('.panel');
        const curPanel = curMain.querySelector('.panel');

        // Robust content check: ensure incoming HTML has real panel / file-list / admin content
        const hasValidContent = newPanel || tempDoc.querySelector('.file-list') || tempDoc.querySelector('.empty-state') || tempDoc.querySelector('.admin-grid');
        if (!hasValidContent) {
            console.warn('Folder navigation payload missing content. Safely navigating to full page...');
            window.location.href = url;
            return;
        }

        if (curStats && newStats && curPathbar && newPathbar && curPanel && newPanel) {
            // 1. Update stat values smoothly in-place without unmounting cards
            const newVals = newStats.querySelectorAll('.stat-val');
            const curVals = curStats.querySelectorAll('.stat-val');
            curVals.forEach((el, idx) => {
                if (newVals[idx] && el.textContent !== newVals[idx].textContent) {
                    el.textContent = newVals[idx].textContent;
                }
            });
            const newLabels = newStats.querySelectorAll('.stat-lbl');
            const curLabels = curStats.querySelectorAll('.stat-lbl');
            curLabels.forEach((el, idx) => {
                if (newLabels[idx] && el.textContent !== newLabels[idx].textContent) {
                    el.textContent = newLabels[idx].textContent;
                }
            });
            const newDashCard = newStats.querySelector('#storageDashCard');
            const curDashCard = curStats.querySelector('#storageDashCard');
            if (newDashCard && curDashCard) {
                curDashCard.dataset.fallbackSize = newDashCard.dataset.fallbackSize || '';
            }

            // 2. Update pathbar breadcrumbs in-place
            if (curPathbar.innerHTML !== newPathbar.innerHTML) {
                curPathbar.innerHTML = newPathbar.innerHTML;
            }

            // 3. ZERO-BLINK Table Update:
            // Instead of wiping the entire .panel container (which destroys headers, search inputs, and glass surfaces),
            // update ONLY the #fileList and #filePanelMeta in-place!
            const curFileList = curPanel.querySelector('#fileList') || curPanel.querySelector('.file-list');
            const newFileList = newPanel.querySelector('#fileList') || newPanel.querySelector('.file-list');
            const curMeta = curPanel.querySelector('#filePanelMeta');
            const newMeta = newPanel.querySelector('#filePanelMeta');

            if (curMeta && newMeta) {
                curMeta.textContent = newMeta.textContent;
                curMeta.dataset.itemCount = newMeta.dataset.itemCount || '';
                curMeta.dataset.fallbackSize = newMeta.dataset.fallbackSize || '';
            }

            // Sync Header Quick Jump Group (#headerQuickJumpGroup)
            const curJumpGroup = curPanel.querySelector('#headerQuickJumpGroup');
            const newJumpGroup = newPanel.querySelector('#headerQuickJumpGroup');
            if (curJumpGroup && newJumpGroup) {
                if (curJumpGroup.innerHTML !== newJumpGroup.innerHTML) {
                    curJumpGroup.innerHTML = newJumpGroup.innerHTML;
                }
            } else if (!curJumpGroup && newJumpGroup) {
                const importedJump = document.importNode(newJumpGroup, true);
                if (curMeta) {
                    curMeta.parentNode.insertBefore(importedJump, curMeta);
                } else {
                    const curHead = curPanel.querySelector('.panel-head');
                    if (curHead) curHead.appendChild(importedJump);
                }
            } else if (curJumpGroup && !newJumpGroup) {
                curJumpGroup.remove();
            }

            // Reset select-all checkbox
            const selectAllChk = curPanel.querySelector('#selectAllChk');
            if (selectAllChk) {
                selectAllChk.checked = false;
                selectAllChk.indeterminate = false;
            }
            const selCount = curPanel.querySelector('#selectedCount');
            if (selCount) selCount.style.display = 'none';

            // Reset search input if any
            const searchInput = curPanel.querySelector('#searchInput');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
            }

            const curTableHead = curPanel.querySelector('.table-header-row');
            const newTableHead = newPanel.querySelector('.table-header-row');

            if (!curTableHead || !curFileList || !newFileList) {
                curPanel.innerHTML = newPanel.innerHTML;
            } else {
                if (curFileList.innerHTML.trim() !== newFileList.innerHTML.trim()) {
                    curFileList.innerHTML = newFileList.innerHTML;
                }
            }

            // 4. In-place Dynamic Sections (Image URLs list, Video URLs list, Video preview grid, Image preview grid)
            // Never remove the whole containers! Swap contents in-place so backdrop-filter glass never blinks or unmounts.
            const dynamicIds = ['imageUrlsSection', 'videoUrlsSection', 'videoPreviewSection', 'imagePreviewSection'];
            const curFooter = curMain.querySelector('footer.dashboard-footer') || curMain.querySelector('footer');

            dynamicIds.forEach(id => {
                const curSec = curMain.querySelector('#' + id);
                const newSec = tempDoc.querySelector('#' + id);
                if (curSec && newSec) {
                    if (curSec.innerHTML !== newSec.innerHTML) {
                        curSec.innerHTML = newSec.innerHTML;
                    }
                } else if (newSec) {
                    const imported = document.importNode(newSec, true);
                    if (curFooter) curMain.insertBefore(imported, curFooter);
                    else curMain.appendChild(imported);
                } else if (curSec) {
                    curSec.remove();
                }
            });

            // Handle panel-jump-divider (Placed directly between file table panel and URLs/media sections)
            const curDivider = curMain.querySelector('.panel-jump-divider');
            const newDivider = tempDoc.querySelector('.panel-jump-divider');
            if (curDivider && !newDivider) {
                curDivider.remove();
            } else if (!curDivider && newDivider) {
                const imported = document.importNode(newDivider, true);
                curPanel.insertAdjacentElement('afterend', imported);
            } else if (curDivider && newDivider) {
                if (curDivider.innerHTML !== newDivider.innerHTML) {
                    curDivider.innerHTML = newDivider.innerHTML;
                }
            }

            // Handle floating-quick-nav pill synchronization
            const curNav = curMain.querySelector('#floatingQuickNav');
            const newNav = tempDoc.querySelector('#floatingQuickNav');
            if (curNav && !newNav) {
                curNav.remove();
            } else if (!curNav && newNav) {
                const imported = document.importNode(newNav, true);
                if (curFooter) curMain.insertBefore(imported, curFooter);
                else curMain.appendChild(imported);
            } else if (curNav && newNav) {
                if (curNav.innerHTML !== newNav.innerHTML) {
                    curNav.innerHTML = newNav.innerHTML;
                }
                curNav.className = newNav.className;
            }


        } else if (hasValidContent) {
            curMain.innerHTML = mainHtml;
        } else {
            window.location.href = url;
            return;
        }
    }
    if (title) document.title = title;

    const newUrlObj = new URL(url, window.location.origin);
    const newPathVal = (meta && meta.currentPath !== undefined) ? meta.currentPath : (newUrlObj.searchParams.get('path') || '');

    // 1. Update hidden path inputs across all modals
    document.querySelectorAll('input[name="path"]').forEach(inp => {
        inp.value = newPathVal;
    });

    // 2. Update JS variables
    if (typeof CURRENT_PATH !== 'undefined') CURRENT_PATH = newPathVal;
    if (typeof F_CURRENT_PATH !== 'undefined') F_CURRENT_PATH = newPathVal;
    if (meta && meta.imageList) IMAGE_LIST = meta.imageList;
    if (meta && meta.csrfToken) {
        CSRF_TOKEN = meta.csrfToken;
        if (typeof F_CSRF_TOKEN !== 'undefined') F_CSRF_TOKEN = meta.csrfToken;
    }

    // 3. Update All URLs modal textarea and count
    const allUrlsTa = document.getElementById('allUrlsTextarea');
    const curImageUrls = (meta && Array.isArray(meta.imageUrls))
        ? meta.imageUrls
        : Array.from(document.querySelectorAll('.all-urls-panel:not(.video-urls-panel) .url-list-input')).map(i => i.value).filter(Boolean);
    if (allUrlsTa) {
        allUrlsTa.value = curImageUrls.join('\n');
    }
    const urlsModalCount = document.querySelector('#urlsModal .modal-body p');
    if (urlsModalCount) {
        urlsModalCount.textContent = curImageUrls.length + ' image URL(s) in this folder';
    }

    // 4. Re-init video previews, selection, storage dashboard, quick jump
    if (typeof initVideoThumbnails === 'function') initVideoThumbnails();
    if (typeof updateSelectedCount === 'function') updateSelectedCount();
    if (typeof loadStorageDashboard === 'function') loadStorageDashboard();
    if (typeof initQuickJumpPill === 'function') initQuickJumpPill();

    // 5. Update sidebar active item
    updateActiveSidebarFolder(newPathVal);

    // 6. Push history state
    if (pushState) {
        window.history.pushState({ pjax: true, url: canonicalKey }, '', canonicalKey);
    }

    if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (typeof warmNearbyFolders === 'function') warmNearbyFolders();
}

function quietRevalidateFolder(canonicalKey) {
    const cached = folderCache.get(canonicalKey);
    fetch(canonicalKey, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-PJAX': '1' }
    })
    .then(r => r.ok ? r.text() : '')
    .then(html => {
        if (!html || html.length < 50) return;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newMain = doc.querySelector('main.main') || doc.querySelector('.main') || doc.querySelector('main');
        if (!newMain || (!doc.querySelector('.panel') && !doc.querySelector('.file-list') && !doc.querySelector('.empty-state') && !doc.querySelector('.admin-grid'))) return;

        let meta = {};
        const pjaxMetaEl = doc.getElementById('pjax-meta');
        if (pjaxMetaEl) {
            try { meta = JSON.parse(pjaxMetaEl.textContent); } catch(e){}
        }

        const title = doc.title || (meta.title || document.title);
        const mainHtml = newMain.innerHTML;

        // CRITICAL ANTI-BLINK CHECK:
        // If content did not change, NEVER touch the DOM! Just update timestamp silently!
        const curMain = document.querySelector('main.main') || document.querySelector('.main') || document.querySelector('main');
        const curFileList = curMain ? (curMain.querySelector('#fileList') || curMain.querySelector('.file-list')) : null;
        const newFileList = newMain.querySelector('#fileList') || newMain.querySelector('.file-list');
        const fileListUnchanged = curFileList && newFileList && curFileList.innerHTML.trim() === newFileList.innerHTML.trim();
        const mainUnchanged = cached && (cached.html === mainHtml || cached.html.length === mainHtml.length);

        if (fileListUnchanged || mainUnchanged) {
            if (cached) {
                cached.timestamp = Date.now();
                cached.html = mainHtml;
                cached.meta = meta;
            }
            return;
        }

        folderCache.set(canonicalKey, {
            html: mainHtml,
            title: title,
            meta: meta,
            timestamp: Date.now()
        });

        // Only update if user is still on this folder AND content actually changed
        if (canonicalFolderUrl(window.location.href) === canonicalKey) {
            applyFolderNavData(canonicalKey, mainHtml, title, meta, false);
        }
    })
    .catch(() => {});
}

async function navigateToFolder(url, pushState = true) {
    if (!url) return;
    if (!isFolderNavigationUrl(url)) {
        window.location.href = url;
        return;
    }

    const canonicalKey = canonicalFolderUrl(url);

    // 1. Check in-memory folder cache (0ms instant display)
    const cached = folderCache.get(canonicalKey);
    if (cached) {
        applyFolderNavData(canonicalKey, cached.html, cached.title, cached.meta, pushState);
        // If fresh (< 45s), we are done! 0ms instant transition.
        if (Date.now() - cached.timestamp < 45000) {
            return;
        }
        // Stale-While-Revalidate: quiet background check without showing progress bar
        quietRevalidateFolder(canonicalKey);
        return;
    }

    // Abort previous navigation if user clicks rapidly
    if (activeNavAbort) {
        try { activeNavAbort.abort(); } catch(e){}
    }
    const thisNavAbort = new AbortController();
    activeNavAbort = thisNavAbort;

    startPjaxProgressBar();

    let timedOut = false;
    const timeoutId = setTimeout(() => {
        if (activeNavAbort === thisNavAbort) {
            timedOut = true;
            thisNavAbort.abort('timeout');
        }
    }, 15000);

    try {
        let fetchPromise;
        if (inflightNavRequests.has(canonicalKey)) {
            fetchPromise = inflightNavRequests.get(canonicalKey);
        } else {
            fetchPromise = fetch(canonicalKey, {
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-PJAX': '1' },
                signal: thisNavAbort.signal
            }).then(async resp => {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return await resp.text();
            });
            inflightNavRequests.set(canonicalKey, fetchPromise);
        }

        const html = await fetchPromise;
        inflightNavRequests.delete(canonicalKey);
        clearTimeout(timeoutId);

        if (!html || typeof html !== 'string' || html.length < 50) {
            window.location.href = url;
            return;
        }

        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Check if redirected to login
        if (doc.querySelector('input[name="login"]') || doc.querySelector('.login-card')) {
            window.location.href = url;
            return;
        }

        const newMain = doc.querySelector('main.main') || doc.querySelector('.main') || doc.querySelector('main');
        const curMain = document.querySelector('main.main') || document.querySelector('.main') || document.querySelector('main');
        if (!newMain || !curMain) {
            window.location.href = url;
            return;
        }

        // Validate that response contains valid panel/file-list or admin section before proceeding
        if (!doc.querySelector('.panel') && !doc.querySelector('.file-list') && !doc.querySelector('.empty-state') && !doc.querySelector('.admin-grid')) {
            console.warn('Incomplete page received from server. Navigating cleanly...');
            window.location.href = url;
            return;
        }

        let meta = {};
        const pjaxMetaEl = doc.getElementById('pjax-meta');
        if (pjaxMetaEl) {
            try { meta = JSON.parse(pjaxMetaEl.textContent); } catch(e){}
        }

        const title = doc.title || (meta.title || document.title);
        const mainHtml = newMain.innerHTML;

        folderCache.set(canonicalKey, {
            html: mainHtml,
            title: title,
            meta: meta,
            timestamp: Date.now()
        });

        applyFolderNavData(canonicalKey, mainHtml, title, meta, pushState);
    } catch(err) {
        inflightNavRequests.delete(canonicalKey);
        clearTimeout(timeoutId);
        if (err.name === 'AbortError' && !timedOut && activeNavAbort !== thisNavAbort) {
            return;
        }
        console.warn('Seamless folder nav fallback:', err);
        window.location.href = url;
    } finally {
        clearTimeout(timeoutId);
        if (activeNavAbort === thisNavAbort) {
            activeNavAbort = null;
            finishPjaxProgressBar();
        }
    }
}

// 0ms instant browser Back & Forward navigation
window.addEventListener('popstate', e => {
    navigateToFolder(location.href, false);
});

function extractFolderUrlFromElement(el) {
    if (!el) return '';
    let href = el.getAttribute('href') || el.dataset.href || el.dataset.openUrl || '';
    if (!href) {
        const row = el.closest('.file-row[data-is-dir="1"]');
        if (row) href = row.dataset.openUrl || '';
    }
    if (!href) {
        const oc = el.getAttribute('onclick') || '';
        const m = oc.match(/(?:location\.href=|navigateToFolder\()'?([^'\)]+)'?/);
        if (m) href = m[1];
    }
    return href;
}

// Intercept breadcrumbs, back button, sidebar, and folder links with capture phase
document.addEventListener('click', e => {
    if (typeof selectionMode !== 'undefined' && selectionMode) return;
    if (e.target.closest('input, button, .rename-form, .modal, .context-menu')) return;

    const link = e.target.closest([
        '.pathbar a',
        '.pathbar .ph-home',
        '.pathbar .ph-back',
        '.folder-open-link',
        '.file-name-folder',
        '.file-type-icon.fti-folder',
        'a.sidebar-btn[data-nav-key="home"]',
        '.sidebar-btn[data-nav-path]',
        '.pin-item[href*="path="]'
    ].join(','));

    if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const href = extractFolderUrlFromElement(link);
        if (href && isFolderNavigationUrl(href)) {
            e.preventDefault();
            e.stopPropagation();
            navigateToFolder(href);
        }
    }
}, true);

document.addEventListener('dblclick', e => {
    if (typeof selectionMode !== 'undefined' && selectionMode) return;
    if (e.target.closest('input, button, a, .rename-form, .modal')) return;

    const row = e.target.closest('.file-row[data-is-dir="1"]');
    if (row) {
        const openUrl = row.dataset.openUrl;
        if (openUrl && isFolderNavigationUrl(openUrl)) {
            e.preventDefault();
            e.stopPropagation();
            navigateToFolder(openUrl);
        }
    }
}, true);

/* ========== SMART FOLDER PREFETCHING ON HOVER & POINTERDOWN ========== */
function prefetchFolderUrl(rawUrl) {
    if (!rawUrl || !isFolderNavigationUrl(rawUrl)) return;
    const canonicalKey = canonicalFolderUrl(rawUrl);
    if (!canonicalKey || folderCache.has(canonicalKey) || prefetchedFolderUrls.has(canonicalKey)) return;
    prefetchedFolderUrls.add(canonicalKey);

    const promise = fetch(canonicalKey, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-PJAX': '1' }
    })
    .then(async r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.text();
    })
    .then(html => {
        inflightNavRequests.delete(canonicalKey);
        if (!html) return html;
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const newMain = doc.querySelector('main.main') || doc.querySelector('.main') || doc.querySelector('main');
            if (newMain && (doc.querySelector('.panel') || doc.querySelector('.file-list') || doc.querySelector('.empty-state') || doc.querySelector('.admin-grid'))) {
                let meta = {};
                const pjaxMetaEl = doc.getElementById('pjax-meta');
                if (pjaxMetaEl) {
                    try { meta = JSON.parse(pjaxMetaEl.textContent); } catch(e){}
                }
                folderCache.set(canonicalKey, {
                    html: newMain.innerHTML,
                    title: doc.title || (meta.title || document.title),
                    meta: meta,
                    timestamp: Date.now()
                });
            }
        } catch(e) {
            console.warn('Prefetch parse error:', e);
        }
        return html;
    })
    .catch(err => {
        inflightNavRequests.delete(canonicalKey);
        prefetchedFolderUrls.delete(canonicalKey);
        throw err;
    });

    inflightNavRequests.set(canonicalKey, promise);
}

// Pointerdown instant warm (80ms before click finishes)
document.addEventListener('pointerdown', e => {
    if (typeof selectionMode !== 'undefined' && selectionMode) return;
    const target = e.target.closest([
        '.file-row[data-is-dir="1"]',
        '.pathbar a',
        '.pathbar .ph-home',
        '.pathbar .ph-back',
        '.file-name-folder',
        '.file-type-icon.fti-folder',
        'a.sidebar-btn[data-nav-key="home"]',
        '.sidebar-btn[data-nav-path]'
    ].join(','));
    if (!target) return;
    const href = extractFolderUrlFromElement(target);
    if (href) prefetchFolderUrl(href);
}, { passive: true });

/* ========== INSTANT OPEN / BACK: hover-intent + idle prefetch ========== */
let hoverPrefetchTimer = null;
document.addEventListener('mouseover', e => {
    if (typeof selectionMode !== 'undefined' && selectionMode) return;
    const t = e.target.closest && e.target.closest('.file-row[data-is-dir="1"], .pathbar a, .pathbar .ph-back, .sidebar-btn[data-nav-path], .pin-item[href*="path="]');
    if (!t) return;
    clearTimeout(hoverPrefetchTimer);
    hoverPrefetchTimer = setTimeout(() => {
        const href = extractFolderUrlFromElement(t);
        if (href) prefetchFolderUrl(href);
    }, 45);
}, { passive: true });

let warmFoldersScheduled = false;
function warmNearbyFolders() {
    if (warmFoldersScheduled) return;
    warmFoldersScheduled = true;
    const run = () => {
        warmFoldersScheduled = false;
        const urls = [];
        const back = document.querySelector('.pathbar .ph-back');
        if (back) urls.push(extractFolderUrlFromElement(back));
        let n = 0;
        document.querySelectorAll('.file-row[data-is-dir="1"]').forEach(row => {
            if (n++ < 6) urls.push(row.dataset.openUrl || '');
        });
        urls.filter(Boolean).forEach((u, i) => setTimeout(() => prefetchFolderUrl(u), i * 250));
        if (typeof warmFolderImages === 'function') warmFolderImages();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 600);
}
if (document.readyState === 'complete') warmNearbyFolders();
else window.addEventListener('load', warmNearbyFolders);

/* ========== BACKGROUND IMAGE WARM-UP: full images are already cached when you click, so the viewer opens instantly ========== */
const lbWarmedUrls = new Set();
let lbWarmRunId = 0;
function lbWarmImage(url, priority) {
    if (!url || lbWarmedUrls.has(url)) return Promise.resolve();
    lbWarmedUrls.add(url);
    return new Promise(resolve => {
        const p = new Image();
        p.decoding = 'async';
        try { p.fetchPriority = priority || 'low'; } catch (e) {}
        p.onload = p.onerror = () => resolve();
        p.src = url;
    });
}
function warmFolderImages() {
    try {
        const conn = navigator.connection;
        if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;
    } catch (e) {}
    const runId = ++lbWarmRunId;
    const start = () => {
        if (runId !== lbWarmRunId) return;
        if (typeof IMAGE_LIST === 'undefined' || !Array.isArray(IMAGE_LIST) || !IMAGE_LIST.length) {
            try { rebuildImageListFromDOM(); } catch (e) {}
        }
        if (typeof IMAGE_LIST === 'undefined' || !Array.isArray(IMAGE_LIST)) return;
        const queue = IMAGE_LIST.map(i => i && i.url).filter(Boolean).slice(0, 60);
        let next = 0;
        const worker = async () => {
            while (next < queue.length && runId === lbWarmRunId) {
                await lbWarmImage(queue[next++], 'low');
            }
        };
        for (let w = 0; w < 4; w++) worker();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
    else setTimeout(start, 500);
}

/* ========== INSTANT IMAGE PREVIEW: preload full image when hovering a thumbnail ========== */
const lbHoverPreloaded = new Set();
document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('img.thumb-img, img.img-card-thumb');
    if (!el || typeof IMAGE_LIST === 'undefined' || !Array.isArray(IMAGE_LIST)) return;
    const alt = el.getAttribute('alt') || '';
    const item = IMAGE_LIST.find(i => i.name === alt);
    if (!item || !item.url || lbHoverPreloaded.has(item.url)) return;
    lbHoverPreloaded.add(item.url);
    const p = new Image();
    p.decoding = 'async';
    try { p.fetchPriority = 'high'; } catch(err) {}
    p.src = item.url;
}, { passive: true });

/* ========== KEYBOARD SHORTCUTS ========== */
document.addEventListener('keydown', e => {
    const active = document.activeElement;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    const key = e.key;

    // 1. ESCAPE = Universal Close Function
    if (key === 'Escape' || key === 'Esc') {
        e.preventDefault();

        // Close profile dropdown menu
        const profileMenu = document.getElementById('profileDropdownMenu');
        if (profileMenu && profileMenu.classList.contains('show')) {
            profileMenu.classList.remove('show');
            const pBtn = document.getElementById('profileDropdownBtn');
            if (pBtn) pBtn.setAttribute('aria-expanded', 'false');
            return;
        }

        // Close image lightbox
        const lb = document.getElementById('lightbox');
        if (lb && lb.classList.contains('open')) {
            closeLightbox();
            return;
        }

        // Close video player modal
        const vidModal = document.getElementById('videoModal');
        if (vidModal && vidModal.classList.contains('open')) {
            closeVideoModal();
            return;
        }

        // Close context menu
        const ctx = document.getElementById('ctxMenu');
        if (ctx && ctx.style.display !== 'none') {
            if (typeof closeCtx === 'function') closeCtx();
            return;
        }

        // Close any other open modal overlay
        const openModals = document.querySelectorAll('.modal-overlay.open');
        if (openModals.length > 0) {
            openModals.forEach(m => {
                if (m.id === 'videoModal') closeVideoModal();
                else closeModal(m.id);
            });
            return;
        }

        // Cancel inline rename form
        const openRename = document.querySelector('.inline-rename-form[style*="display: flex"]');
        if (openRename) {
            const m = openRename.id.match(/\d+$/);
            if (m) hideRename(parseInt(m[0], 10));
            return;
        }

        // Close toolbar dropdowns
        document.querySelectorAll('.tb-dropdown.open').forEach(d => d.classList.remove('open'));

        // Unfocus search / input if typing
        if (typing) {
            active.blur();
            return;
        }

        // Clear selection
        selectNone();
        return;
    }

    // 2. LIGHTBOX PREV / NEXT (ArrowLeft, ArrowRight, Space)
    const lb = document.getElementById('lightbox');
    if (lb && lb.classList.contains('open')) {
        if (key === 'ArrowRight' || key === 'Right' || key === ' ') {
            e.preventDefault();
            lbNavigate(1);
            return;
        }
        if (key === 'ArrowLeft' || key === 'Left') {
            e.preventDefault();
            lbNavigate(-1);
            return;
        }
        return;
    }

    // 3. VIDEO MODAL SEEK & PLAY/PAUSE SHORTCUTS
    const vidModal = document.getElementById('videoModal');
    if (vidModal && vidModal.classList.contains('open')) {
        const player = document.getElementById('videoPlayerElem');
        if (player) {
            if (key === 'ArrowRight' || key === 'Right') {
                e.preventDefault();
                player.currentTime = Math.min(player.duration || 0, player.currentTime + 5);
                return;
            }
            if (key === 'ArrowLeft' || key === 'Left') {
                e.preventDefault();
                player.currentTime = Math.max(0, player.currentTime - 5);
                return;
            }
            if (key === ' ' || key === 'Spacebar') {
                e.preventDefault();
                if (player.paused) player.play().catch(() => {});
                else player.pause();
                return;
            }
            if (key === 'f' || key === 'F') {
                e.preventDefault();
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                } else if (player.requestFullscreen) {
                    player.requestFullscreen().catch(() => {});
                }
                return;
            }
            if (key === 'm' || key === 'M') {
                e.preventDefault();
                player.muted = !player.muted;
                return;
            }
        }
    }

    // 4. Other global shortcuts (when NOT typing)
    if (!typing) {
        // / = focus search
        if (key === '/') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
            return;
        }

        // Ctrl+A / Cmd+A = select all
        if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'a') {
            e.preventDefault();
            selectAll();
            return;
        }

        // Ctrl+C / Cmd+C = copy selected URLs
        if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'c') {
            const n = document.querySelectorAll('.file-item-check:checked').length;
            if (n > 0) { e.preventDefault(); copySelectedUrls(); }
            return;
        }

        // Delete = delete selected
        if (key === 'Delete') {
            e.preventDefault();
            deleteSelected();
            return;
        }
    }
});

/* ========== CLICK OUTSIDE = DESELECT ========== */
const fileListEl = document.getElementById('fileList');
if (fileListEl) {
    fileListEl.addEventListener('click', e => {
        if (!e.target.closest('.file-row') && !e.target.closest('.rename-form')) selectNone();
    });
}



/* ========== HIGH-SPEED QUICK JUMP & NAVIGATION ENGINE ========== */
let activeScrollAnim = null;
let glideSafetyTimer = null;

function fastGlideScrollTo(targetY, customDuration) {
    if (activeScrollAnim) {
        cancelAnimationFrame(activeScrollAnim);
        activeScrollAnim = null;
    }
    if (glideSafetyTimer) {
        clearTimeout(glideSafetyTimer);
        glideSafetyTimer = null;
    }

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clampedTargetY = Math.max(0, Math.min(Math.round(targetY), maxScroll));
    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const distance = clampedTargetY - startY;

    if (Math.abs(distance) < 6) {
        window.scrollTo(0, clampedTargetY);
        return;
    }

    // Ultra-snappy duration: 160ms for short distance, up to 230ms for large jump
    const duration = customDuration || Math.min(230, Math.max(160, Math.round(Math.abs(distance) * 0.07 + 110)));
    const startTime = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 4);

    document.documentElement.classList.add('is-glide-scrolling');

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const nextY = Math.round(startY + (distance * easeOut(progress)));
        window.scrollTo(0, nextY);

        if (progress < 1) {
            activeScrollAnim = requestAnimationFrame(step);
        } else {
            activeScrollAnim = null;
            window.scrollTo(0, clampedTargetY);
            document.documentElement.classList.remove('is-glide-scrolling');
        }
    }

    activeScrollAnim = requestAnimationFrame(step);

    glideSafetyTimer = setTimeout(() => {
        document.documentElement.classList.remove('is-glide-scrolling');
        glideSafetyTimer = null;
    }, duration + 80);
}

function smoothScrollTo(targetY, duration) {
    fastGlideScrollTo(targetY, duration);
}

// User cancellation: if user scrolls wheel or touches screen while gliding, immediately yield control
const cancelGlideOnUserInput = () => {
    if (activeScrollAnim) {
        cancelAnimationFrame(activeScrollAnim);
        activeScrollAnim = null;
        document.documentElement.classList.remove('is-glide-scrolling');
    }
};
window.addEventListener('wheel', cancelGlideOnUserInput, { passive: true });
window.addEventListener('touchstart', cancelGlideOnUserInput, { passive: true });

/* ========== HIGH-SPEED MOUSE WHEEL & FINGER SCROLL ACCELERATOR ========== */
(function initFastMouseFingerScroll() {
    if (window.__kiuq_scroll_accelerator_initialized) return;
    window.__kiuq_scroll_accelerator_initialized = true;

    let scrollRaf = null;
    let targetY = window.pageYOffset || document.documentElement.scrollTop || 0;
    let currentY = targetY;
    let lastWheelTime = 0;
    let velocityMultiplier = 1.0;

    function isInsideScrollable(el, deltaY) {
        let cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
            if (cur.classList && (cur.classList.contains('modal-box') || cur.classList.contains('modal-body') || cur.classList.contains('modal-overlay') || cur.classList.contains('profile-dropdown-menu'))) {
                return true;
            }
            if (cur.tagName === 'TEXTAREA' || cur.tagName === 'SELECT') {
                return true;
            }
            const cs = window.getComputedStyle(cur);
            const oy = cs.overflowY;
            if (oy === 'auto' || oy === 'scroll') {
                const canScrollUp = deltaY < 0 && cur.scrollTop > 0;
                const canScrollDown = deltaY > 0 && (cur.scrollTop + cur.clientHeight < cur.scrollHeight);
                if (canScrollUp || canScrollDown) return true;
            }
            cur = cur.parentElement;
        }
        return false;
    }

    function onWheelAccelerate(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        if (!e.deltaY) return;

        if (document.querySelector('.modal-overlay.open') || isInsideScrollable(e.target, e.deltaY)) {
            targetY = window.pageYOffset || document.documentElement.scrollTop || 0;
            return;
        }

        if (typeof cancelGlideOnUserInput === 'function') cancelGlideOnUserInput();

        const now = performance.now();
        const timeDiff = now - lastWheelTime;
        lastWheelTime = now;

        if (timeDiff < 140) {
            velocityMultiplier = Math.min(1.5, velocityMultiplier + 0.08);
        } else {
            velocityMultiplier = 1.0;
        }

        const isDiscreteWheel = Math.abs(e.deltaY) >= 40 && (e.deltaY % 1 === 0 || e.deltaMode !== 0);
        const baseFactor = isDiscreteWheel ? 1.35 : 1.12;
        const speedBoost = baseFactor * velocityMultiplier;

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 36;
        else if (e.deltaMode === 2) delta *= window.innerHeight;

        const actualY = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (Math.abs(actualY - currentY) > 80 || (delta > 0 && targetY < actualY) || (delta < 0 && targetY > actualY)) {
            currentY = actualY;
            targetY = actualY;
        }

        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        targetY = Math.max(0, Math.min(maxScroll, targetY + (delta * speedBoost)));

        e.preventDefault();

        if (!scrollRaf) {
            stepScroll();
        }
    }

    function stepScroll() {
        const diff = targetY - currentY;

        if (Math.abs(diff) > 0.8) {
            currentY += diff * 0.22;
            window.scrollTo(0, Math.round(currentY));
            scrollRaf = requestAnimationFrame(stepScroll);
        } else {
            currentY = targetY;
            window.scrollTo(0, targetY);
            scrollRaf = null;
        }
    }

    if (!window.__kiuqWheelInit) {
        window.__kiuqWheelInit = true;
        window.addEventListener('wheel', onWheelAccelerate, { passive: false });
    }

    window.addEventListener('scroll', () => {
        if (!scrollRaf) {
            currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
            targetY = currentY;
        }
    }, { passive: true });

    window.addEventListener('touchstart', () => {
        if (scrollRaf) {
            cancelAnimationFrame(scrollRaf);
            scrollRaf = null;
        }
        currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
        targetY = currentY;
    }, { passive: true });
})();

function scrollToSection(sectionId, e) {
    if (e) {
        try {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        } catch(err) {}
    }

    // 1. Resolve target element with comprehensive fallbacks
    let el = document.getElementById(sectionId);
    if (!el) {
        if (sectionId === 'imagePreviewSection' || sectionId === 'preview' || sectionId === 'imagePreview') {
            el = document.querySelector('#imagePreviewSection') 
              || document.querySelector('.img-grid-panel:not(.video-grid-panel)')
              || document.querySelector('#videoPreviewSection')
              || document.querySelector('.img-grid-panel');
        } else if (sectionId === 'imageUrlsSection' || sectionId === 'urls' || sectionId === 'imageUrls') {
            el = document.querySelector('#imageUrlsSection')
              || document.querySelector('.all-urls-panel:not(.video-urls-panel)')
              || document.querySelector('#videoUrlsSection')
              || document.querySelector('.all-urls-panel');
        } else if (sectionId === 'videoUrlsSection') {
            el = document.getElementById('videoUrlsSection') || document.getElementById('videoPreviewSection');
        } else if (sectionId === 'videoPreviewSection') {
            el = document.getElementById('videoPreviewSection') || document.querySelector('.video-grid-panel');
        }
    }

    if (!el) return false;

    const yOffset = -76;
    const y = Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) + yOffset);
    fastGlideScrollTo(y);

    // Radiant highlight landing pulse
    el.classList.remove('section-jump-highlight');
    void el.offsetWidth;
    el.classList.add('section-jump-highlight');
    setTimeout(() => el.classList.remove('section-jump-highlight'), 1000);
    return true;
}

function scrollToTopFiles(e) {
    if (e) {
        try {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        } catch(err) {}
    }
    const panel = document.querySelector('.panel') || document.querySelector('.stats-row') || document.querySelector('#fileList');
    if (panel) {
        const yOffset = -76;
        const y = Math.max(0, panel.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) + yOffset);
        fastGlideScrollTo(y);
    } else {
        fastGlideScrollTo(0);
    }
    return false;
}

window.smoothScrollTo = fastGlideScrollTo;
window.fastGlideScrollTo = fastGlideScrollTo;
window.scrollToSection = scrollToSection;
window.scrollToTopFiles = scrollToTopFiles;

// Global Keyboard Navigation
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.isComposing) return;
    if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (!scrollToSection('imageUrlsSection')) {
            scrollToSection('imagePreviewSection');
        }
    } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToTopFiles();
    }
});

let _activeNavScrollHandler = null;
let _navScrollTicking = false;

function initQuickJumpPill() {
    const nav = document.getElementById('floatingQuickNav');
    if (!nav) return;

    const filesBtn = document.getElementById('fabNavFiles') || nav.querySelector('.fab-sub-link');
    const urlsBtn = document.getElementById('fabNavUrls') || nav.querySelector('[onclick*="imageUrlsSection"]');
    const prevBtn = document.getElementById('fabNavPreviews') || nav.querySelector('[onclick*="imagePreviewSection"]');
    const vidsBtn = document.getElementById('fabNavVideos') || nav.querySelector('[onclick*="videoUrlsSection"]');
    const links = [filesBtn, urlsBtn, prevBtn, vidsBtn].filter(Boolean);

    // Explicitly bind direct click listeners to prevent any handler obstruction
    if (filesBtn) {
        filesBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
            scrollToTopFiles(e);
            return false;
        };
    }
    if (urlsBtn) {
        urlsBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
            scrollToSection('imageUrlsSection', e);
            return false;
        };
    }
    if (prevBtn) {
        prevBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
            scrollToSection('imagePreviewSection', e);
            return false;
        };
    }
    if (vidsBtn) {
        vidsBtn.onclick = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
            scrollToSection('videoUrlsSection', e);
            return false;
        };
    }

    function setActiveBtn(targetBtn) {
        links.forEach(l => l.classList.remove('active'));
        if (targetBtn) targetBtn.classList.add('active');
    }

    function updateNavState() {
        if (document.body.classList.contains('lightbox-open')) {
            nav.classList.add('hidden');
            return;
        }

        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const curUrlsSec = document.getElementById('imageUrlsSection');
        const curPrevSec = document.getElementById('imagePreviewSection') || document.querySelector('.img-grid-panel');
        const curVidsSec = document.getElementById('videoUrlsSection') || document.getElementById('videoPreviewSection');
        const curHasMedia = !!(curUrlsSec || curPrevSec || curVidsSec);

        if (curHasMedia) {
            nav.classList.remove('hidden');

            const triggerOffset = 200;
            if (curPrevSec && curPrevSec.getBoundingClientRect().top <= triggerOffset) {
                setActiveBtn(prevBtn);
            } else if (curVidsSec && curVidsSec.getBoundingClientRect().top <= triggerOffset) {
                setActiveBtn(vidsBtn);
            } else if (curUrlsSec && curUrlsSec.getBoundingClientRect().top <= triggerOffset) {
                setActiveBtn(urlsBtn);
            } else {
                setActiveBtn(filesBtn);
            }
        } else {
            if (scrollY > 200) {
                nav.classList.remove('hidden');
                setActiveBtn(filesBtn);
            } else {
                nav.classList.add('hidden');
            }
        }
    }

    updateNavState();

    if (_activeNavScrollHandler) {
        window.removeEventListener('scroll', _activeNavScrollHandler);
    }
    _activeNavScrollHandler = () => {
        if (!_navScrollTicking) {
            _navScrollTicking = true;
            requestAnimationFrame(() => {
                _navScrollTicking = false;
                updateNavState();
            });
        }
    };
    window.addEventListener('scroll', _activeNavScrollHandler, { passive: true });
}

window.initQuickJumpPill = initQuickJumpPill;

// Auto-initialize on load and PJAX finish
window.addEventListener('DOMContentLoaded', () => {
    if (typeof loadStorageDashboard === 'function') loadStorageDashboard();
    if (typeof initQuickJumpPill === 'function') initQuickJumpPill();
    try {
        localStorage.removeItem('kiuq_dashboard_theme');
        document.documentElement.classList.remove('dashboard-themed');
        document.body.classList.remove('dashboard-themed');
        document.documentElement.style.removeProperty('--dashboard-bg-image');
        document.body.style.removeProperty('--dashboard-bg-image');
        document.cookie = 'kiuq_dashboard_theme=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch(e) {}
});




/* ==========================================================================
   KIUQ FEATURE MODULES & ADVANCED UI CONTROLS
   ========================================================================== */

function featurePost(data) {
    return postAction(data);
}

/* ── Toolbar Dropdown ─────────────────────────────────────────────────── */
function toggleTbDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.classList.contains('open');
    document.querySelectorAll('.tb-dropdown.open').forEach(d => d.classList.remove('open'));
    if (!isOpen) el.classList.add('open');
}
function closeTbDropdown(id) {
    document.getElementById(id)?.classList.remove('open');
}
document.addEventListener('click', e => {
    if (!e.target.closest('.tb-dropdown-wrap')) {
        document.querySelectorAll('.tb-dropdown.open').forEach(d => d.classList.remove('open'));
    }
});

/* ── Context Menu ─────────────────────────────────────────────────────── */
let ctxRow = null;
const ctxMenu = document.getElementById('contextMenu');

function setFolderBadge(row, kind, enabled) {
    const cell = row?.querySelector('.file-name-cell');
    const titleRow = row?.querySelector('.file-title-row');
    const label = titleRow?.querySelector('.file-name-display');
    if (!cell || !titleRow) return;
    const cls = kind === 'pin' ? 'fm-pin' : 'fm-fav';
    let badge = cell.querySelector('.' + cls);
    if (enabled) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'fm-badge ' + cls;
            badge.title = kind === 'pin' ? 'Pinned' : 'Favorite';
            badge.textContent = kind === 'pin' ? '📌' : '⭐';
            if (label) label.insertAdjacentElement('afterend', badge);
            else titleRow.appendChild(badge);
        }
    } else if (badge) {
        badge.remove();
    }
}

const PIN_COLOR_VARS = {
    blue:   ['#2563eb','rgba(37,99,235,0.12)'],
    green:  ['#059669','rgba(5,150,105,0.12)'],
    yellow: ['#d97706','rgba(217,119,6,0.12)'],
    red:    ['#dc2626','rgba(220,38,38,0.12)'],
    purple: ['#7c3aed','rgba(124,58,237,0.12)'],
    orange: ['#ea580c','rgba(234,88,12,0.12)'],
};
function setFolderColor(row, color) {
    const folderRel = row?.dataset?.folderRel;
    const els = folderRel
        ? document.querySelectorAll('[data-folder-rel="' + CSS.escape(folderRel) + '"]')
        : (row ? [row] : []);
    els.forEach(el => {
        el.dataset.folderColor = color || '';
        const icon = el.querySelector('.file-type-icon') || el.querySelector('.sb-icon');
        if (icon) {
            if (color) {
                icon.dataset.folderColor = color;
                if (el.id && el.id.startsWith('sb_pin_') && PIN_COLOR_VARS[color]) {
                    icon.style.color = PIN_COLOR_VARS[color][0];
                    icon.style.background = PIN_COLOR_VARS[color][1];
                }
            } else {
                delete icon.dataset.folderColor;
                if (el.id && el.id.startsWith('sb_pin_')) {
                    icon.style.color = '';
                    icon.style.background = '';
                }
            }
        }
    });
}

function showContextMenu(e, row) {
    e.preventDefault();
    ctxRow = row;
    const name     = row.dataset.name;
    const isImg    = row.dataset.isImg === '1';
    const isDir    = row.dataset.isDir === '1';
    const url      = row.dataset.url;
    const relPath  = row.dataset.rel;
    const isSbPin  = row.id && row.id.startsWith('sb_pin_');
    const parentPath = row.dataset.parentPath || F_CURRENT_PATH;

    document.getElementById('ctx-rename').onclick = () => {
        closeCtx();
        if (isSbPin) {
            const newName = prompt('Rename item:', name);
            if (newName && newName.trim() && newName.trim() !== name) {
                const form = document.createElement('form');
                form.method = 'post';
                form.innerHTML = `<input type="hidden" name="action" value="rename_item"><input type="hidden" name="old_name" value="${escHtml(name)}"><input type="hidden" name="new_name" value="${escHtml(newName.trim())}"><input type="hidden" name="csrf_token" value="${F_CSRF_TOKEN}"><input type="hidden" name="path" value="${escHtml(parentPath)}">`;
                document.body.appendChild(form); form.submit();
            }
        } else {
            const idx = row.id.replace('row_',''); showRename(parseInt(idx), name);
        }
    };
    document.getElementById('ctx-rename-type').onclick = () => {
        closeCtx();
        const checkbox = row.querySelector('.file-check');
        if (checkbox && checkbox.checked) {
            const inputs = document.querySelectorAll('.file-check:checked:not(#selectAllChk)');
            if (inputs.length > 1) {
                openRenameTypeModalMulti();
                return;
            }
        }
        openRenameTypeModalSingle(name, parentPath);
    };
    document.getElementById('ctx-download').onclick = () => { closeCtx(); location.href = F_ACTION_ENDPOINT + '?path=' + encodeURIComponent(parentPath) + '&download_item=' + encodeURIComponent(name); };
    document.getElementById('ctx-copy').onclick = () => {
        closeCtx();
        const c = document.getElementById('copySelectedInputs'); c.innerHTML = '';
        const i = document.createElement('input'); i.type='hidden'; i.name='selected_names[]'; i.value=name; c.appendChild(i);
        if (isSbPin) { const p=document.createElement('input'); p.type='hidden'; p.name='path'; p.value=parentPath; c.appendChild(p); }
        document.getElementById('copySelectedForm').submit();
    };
    document.getElementById('ctx-move').onclick = () => { closeCtx(); const c=document.getElementById('moveSelectedInputs'); c.innerHTML=''; const i=document.createElement('input'); i.type='hidden'; i.name='selected_names[]'; i.value=name; c.appendChild(i); openModal('moveModal'); };
    document.getElementById('ctx-paste').onclick = () => { closeCtx(); pasteClipboard(); };
    document.getElementById('ctx-properties').onclick = () => { closeCtx(); openPropertiesDialog(name, parentPath); };
    document.getElementById('ctx-delete').onclick = () => {
        closeCtx();
        const form = document.createElement('form'); form.method='post';
        form.innerHTML = `<input name="action" value="delete_item"><input name="item_name" value="${name}"><input name="csrf_token" value="${F_CSRF_TOKEN}"><input type="hidden" name="path" value="${parentPath}">`;
        document.body.appendChild(form); addDeletePassword(form, `Move ${name} to trash?`);
    };

    // Show/hide items based on context
    document.getElementById('ctx-copy').style.display = 'flex';
    document.getElementById('ctx-move').style.display = isSbPin ? 'none' : 'flex';
    document.getElementById('ctx-paste').style.display = isSbPin ? 'none' : 'flex';
    document.getElementById('ctx-rename').style.display = isSbPin ? 'none' : 'flex';
    document.getElementById('ctx-rename-type').style.display = (isSbPin || isDir) ? 'none' : 'flex';
    document.getElementById('ctx-delete').style.display = isSbPin ? 'none' : 'flex';
    document.getElementById('ctx-download').style.display = isSbPin ? 'none' : 'flex';
    document.getElementById('ctx-properties').style.display = isSbPin ? 'none' : 'flex';
    document.querySelectorAll('.ctx-sep').forEach(sep => { sep.style.display = isSbPin ? 'none' : ''; });

    // Folder-only items
    const colorItem = document.getElementById('ctx-color');
    const pinItem   = document.getElementById('ctx-pin');
    colorItem.style.display = (isDir && !isSbPin) ? 'flex' : 'none';
    pinItem.style.display   = (isDir && !isSbPin) ? 'flex' : 'none';

    // Sidebar pin toggle
    const pinSidebarItem = document.getElementById('ctx-pin-sidebar');
    if (pinSidebarItem) {
        pinSidebarItem.style.display = 'flex';
        const isPinnedSidebar = isSbPin || F_SIDEBAR_PINS.includes(relPath);
        pinSidebarItem.textContent = isPinnedSidebar ? '📌 Unpin from Sidebar' : '📌 Pin to Sidebar';
        pinSidebarItem.onclick = () => {
            closeCtx();
            featurePost({action: 'toggle_sidebar_pin', folder_path: relPath, is_dir: isDir ? 1 : 0}).then(d => {
                if (d.success) {
                    toast(d.is_pinned ? '📌 Pinned to sidebar' : 'Unpinned from sidebar', 'success');
                    if (d.is_pinned) {
                        if (!F_SIDEBAR_PINS.includes(relPath)) F_SIDEBAR_PINS.push(relPath);
                    } else {
                        const idx = F_SIDEBAR_PINS.indexOf(relPath);
                        if (idx > -1) F_SIDEBAR_PINS.splice(idx, 1);
                    }
                    setTimeout(() => { location.reload(); }, 500);
                } else {
                    toast('Error: ' + (d.error || 'unknown'), 'danger');
                }
            });
        };
    }

    if (isDir) {
        const folderRel = row.dataset.folderRel;
        pinItem.onclick = () => {
            closeCtx();
            featurePost({action:'toggle_pin', folder_path: folderRel}).then(d => {
                toast(d.success ? (d.is_pinned ? '📌 Folder pinned' : 'Folder unpinned') : 'Error', d.success ? 'success' : 'danger');
                if (d.success) setFolderBadge(row, 'pin', !!d.is_pinned);
            });
        };
        document.querySelectorAll('.ctx-color-opt').forEach(opt => {
            opt.onclick = e => {
                e.stopPropagation();
                closeCtx();
                featurePost({action:'set_folder_color', folder_path: folderRel, color: opt.dataset.color}).then(d => {
                    toast(d.success ? '🎨 Color updated' : 'Error', d.success ? 'success' : 'danger');
                    if (d.success) setFolderColor(row, d.color || '');
                });
            };
        });
    }

    // Image-only items
    const replaceItem  = document.getElementById('ctx-replace');
    const canvaEditItem= document.getElementById('ctx-canva-edit');
    const sepImg       = document.querySelector('.ctx-sep-img');
    
    replaceItem.style.display  = isImg ? 'flex' : 'none';
    canvaEditItem.style.display= isImg ? 'flex' : 'none';
    if (sepImg) sepImg.style.display = isImg ? '' : 'none';

    if (isImg) {
        replaceItem.onclick = () => { closeCtx(); openReplaceModal(name); };
        canvaEditItem.onclick = () => { 
            closeCtx(); 
            const checked = document.querySelectorAll('.file-item-check:checked');
            const imgs = [...checked].filter(c => c.closest('.file-row')?.dataset.isImg === '1');
            
            if (imgs.length > 1 && [...checked].some(c => c.closest('.file-row') === row)) {
                openBatchCanvasEditor(imgs.map(c => c.closest('.file-row')));
            } else {
                openStandaloneCanvasEditor(name, url); 
            }
        };
    }

    // Video-only items
    const isVid = row.dataset.isVideo === '1';
    const playVideoItem = document.getElementById('ctx-play-video');
    const copyVidUrlItem = document.getElementById('ctx-copy-video-url');
    const copyVidEmbedItem = document.getElementById('ctx-copy-video-embed');
    
    if (playVideoItem) {
        playVideoItem.style.display = isVid ? 'flex' : 'none';
        if (isVid) playVideoItem.onclick = () => { closeCtx(); openVideoModal(name, url); };
    }
    if (copyVidUrlItem) {
        copyVidUrlItem.style.display = isVid ? 'flex' : 'none';
        if (isVid) copyVidUrlItem.onclick = () => {
            closeCtx();
            navigator.clipboard.writeText(url).then(() => {
                if (typeof toast === 'function') toast('Video URL copied!', 'success');
            });
        };
    }
    if (copyVidEmbedItem) {
        copyVidEmbedItem.style.display = isVid ? 'flex' : 'none';
        if (isVid) copyVidEmbedItem.onclick = () => {
            closeCtx();
            const embed = `<video src="${url}" controls playsinline width="100%"></video>`;
            navigator.clipboard.writeText(embed).then(() => {
                if (typeof toast === 'function') toast('Video embed code copied!', 'success');
            });
        };
    }

    // Position menu
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 200, mh = 340;
    let x = e.clientX, y = e.clientY;
    if (x + mw > vw) x = vw - mw - 10;
    if (y + mh > vh) y = vh - mh - 10;
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top  = y + 'px';
    ctxMenu.style.display = 'block';
}

function closeCtx() { if(ctxMenu) ctxMenu.style.display = 'none'; ctxRow = null; }
document.addEventListener('click', e => { if (!e.target.closest('#contextMenu')) closeCtx(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCtx(); });

/* ── Properties ───────────────────────────────────────────────────────── */
function openPropertiesDialog(name) {
    openModal('propertiesModal');
    document.getElementById('propertiesContent').innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--muted);">Loading…</div>';
    featurePost({ action: 'get_properties', item_name: name, path: F_CURRENT_PATH }).then(d => {
        if (!d.success) { document.getElementById('propertiesContent').innerHTML = `<p style="color:var(--danger)">${escHtml(d.error||'Error')}</p>`; return; }
        const p = d.props;
        const rows = p.type === 'file' ? [
            ['Name', escHtml(p.name)],
            ['Type', escHtml(p.extension?.toUpperCase() || '—') + ' · ' + escHtml(p.mime||'')],
            ['Size', escHtml(p.size_fmt||'—')],
            ['Dimensions', p.width ? `${p.width} × ${p.height} px` : '—'],
            ['Modified', new Date((p.modified||0)*1000).toLocaleString()],
            ['Created',  new Date((p.created||0)*1000).toLocaleString()],
            ['Path', escHtml(p.path||'—')],
            ['SHA256', `<span class="props-hash">${escHtml(p.sha256||'—')}</span>`],
            ['MD5',    `<span class="props-hash">${escHtml(p.md5||'—')}</span>`],
        ] : [
            ['Name', escHtml(p.name)],
            ['Type', 'Folder'],
            ['Total Size', formatBytesJs(p.size||0)],
            ['Files', (p.items?.files||0).toLocaleString()],
            ['Subfolders', (p.items?.folders||0).toLocaleString()],
            ['Modified', new Date((p.modified||0)*1000).toLocaleString()],
            ['Path', escHtml(p.path||'—')],
        ];
        const html = `<div class="props-grid">${rows.map(([l,v]) => `<div class="props-row"><div class="props-label">${l}</div><div class="props-value">${v}</div></div>`).join('')}</div>`;
        document.getElementById('propertiesContent').innerHTML = html;
    }).catch(() => { document.getElementById('propertiesContent').innerHTML = '<p style="color:var(--danger)">Request failed</p>'; });
}

/* ── Version History ─────────────────────────────────────────────────── */
function openVersionHistory(name) {
    openModal('versionModal');
    document.getElementById('versionFileName').textContent = 'File: ' + name;
    document.getElementById('versionList').innerHTML = '<div style="color:var(--muted);padding:20px 0;text-align:center;">Loading…</div>';
    featurePost({ action: 'get_versions', item_name: name, path: F_CURRENT_PATH }).then(d => {
        if (!d.success) { document.getElementById('versionList').innerHTML = `<p style="color:var(--danger)">${escHtml(d.error||'Error')}</p>`; return; }
        if (!d.versions?.length) { document.getElementById('versionList').innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;">No versions yet. Replace the image to create a version.</div>'; return; }
        document.getElementById('versionList').innerHTML = d.versions.map(v => `
            <div class="ver-item">
                <span class="ver-badge">v${v.version_num}</span>
                <div class="ver-info">
                    <div class="ver-name">${escHtml(v.stored_path?.split('/').pop()||'Version ' + v.version_num)}</div>
                    <div class="ver-meta">${escHtml(v.size_fmt||'?')} · ${escHtml(v.date_fmt||'?')} · Replaced by: ${escHtml(v.replaced_by||'—')}</div>
                </div>
                <div class="ver-actions">
                    <button class="act-btn open" onclick="restoreVersion('${escHtml(v.id)}')">↩ Restore</button>
                    <button class="act-btn" onclick="downloadVersion('${escHtml(v.id)}')">⬇</button>
                    <button class="act-btn del" onclick="deleteVersion('${escHtml(v.id)}')">🗑</button>
                </div>
            </div>`).join('');
    });
}

function restoreVersion(id) {
    if (!confirm('Restore this version? The current file will be saved as a new version.')) return;
    featurePost({ action: 'restore_version', version_id: id, path: F_CURRENT_PATH }).then(d => {
        toast(d.success ? d.message : (d.error||'Error'), d.success ? 'success' : 'danger');
        if (d.success) { closeModal('versionModal'); setTimeout(() => location.reload(), 600); }
    });
}

function downloadVersion(id) {
    const form = document.createElement('form'); form.method = 'post';
    form.innerHTML = `<input name="action" value="download_version"><input name="version_id" value="${id}"><input name="csrf_token" value="${F_CSRF_TOKEN}"><input name="path" value="${F_CURRENT_PATH}">`;
    document.body.appendChild(form); form.submit(); document.body.removeChild(form);
}

function deleteVersion(id) {
    if (!confirm('Delete this version permanently? This cannot be undone.')) return;
    featurePost({ action: 'delete_version', version_id: id, path: F_CURRENT_PATH }).then(d => {
        toast(d.success ? 'Version deleted' : (d.error||'Error'), d.success ? 'success' : 'danger');
        if (d.success) { document.querySelectorAll('[onclick*="' + id + '"]').forEach(el => el.closest('.ver-item')?.remove()); }
    });
}

/* ── Replace Image ────────────────────────────────────────────────────── */
let replaceTargetName = '';
function openReplaceModal(name) {
    replaceTargetName = name;
    document.getElementById('replaceTargetInfo').textContent = 'Replacing: ' + name;
    document.getElementById('replaceFileInput').value = '';
    openModal('replaceModal');
}

function submitReplaceImage() {
    const fileInput = document.getElementById('replaceFileInput');
    if (!fileInput.files.length) { toast('Please select a file', 'danger'); return; }
    const formData = new FormData();
    formData.append('csrf_token', F_CSRF_TOKEN);
    formData.append('action', 'replace_image');
    formData.append('target_name', replaceTargetName);
    formData.append('path', F_CURRENT_PATH);
    formData.append('replace_file', fileInput.files[0]);
    fetch(F_ACTION_ENDPOINT, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => {
            toast(d.success ? d.message : (d.error||'Replace failed'), d.success ? 'success' : 'danger');
            if (d.success) { closeModal('replaceModal'); setTimeout(() => location.reload(), 700); }
        }).catch(() => toast('Request failed', 'danger'));
}

/* ── AI Background Removal ──────────────────────────────────────────── */
let aiJobs = [];

function openAiModal() {
    const checked = document.querySelectorAll('.file-item-check:checked');
    const imgs = [...checked].filter(c => c.closest('.file-row')?.dataset.isImg === '1');
    if (!imgs.length) { toast('Select image(s) first', 'danger'); return; }
    document.getElementById('aiSelectedInfo').textContent = imgs.length + ' image(s) selected';
    document.getElementById('aiQueue').innerHTML = imgs.map((c, i) => {
        const row = c.closest('.file-row');
        const name = row?.dataset.name || '?';
        return `<div class="ai-job-row" id="ai-job-row-${i}"><span title="${escHtml(name)}">${escHtml(name.length > 48 ? name.slice(0,45)+'...' : name)}</span><span class="ai-job-status" id="ai-job-status-${i}">Pending</span><span></span></div>`;
    }).join('');
    document.getElementById('aiStartBtn').style.display = '';
    document.getElementById('aiCancelBtn').style.display = 'none';
    document.getElementById('aiDownloadBtn').style.display = 'none';
    aiJobs = imgs.map(c => ({ rel: c.closest('.file-row')?.dataset.rel || '', id: '', status: 'pending' }));
    openModal('aiModal');
}

async function aiStartProcessing() {
    const imgs = aiJobs.map(j => j.rel);
    const outputType   = document.getElementById('aiOutputType').value;
    const outputFormat = document.getElementById('aiOutputFormat').value;
    const outputFolder = document.getElementById('aiOutputFolder').value;
    const keepOrigName = document.getElementById('aiKeepOrigName').checked ? '1' : '';

    document.getElementById('aiStartBtn').style.display = 'none';
    document.getElementById('aiCancelBtn').style.display = '';

    // Start all jobs
    try {
        const d = await featurePost({ action: 'ai_bg_remove_start', paths: JSON.stringify(imgs), output_type: outputType, output_format: outputFormat, output_folder: outputFolder, keep_original_name: keepOrigName });
        if (!d.success) { toast(d.error||'Error starting AI jobs', 'danger'); document.getElementById('aiStartBtn').style.display = ''; return; }
        d.jobs.forEach((job, i) => { if (aiJobs[i]) aiJobs[i].id = job.id; });
    } catch(e) { toast('Failed to start AI jobs', 'danger'); document.getElementById('aiStartBtn').style.display = ''; return; }

    // Process each job sequentially
    for (let i = 0; i < aiJobs.length; i++) {
        if (aiJobs[i].status === 'cancelled') continue;
        const rowEl    = document.getElementById('ai-job-row-' + i);
        const statusEl = document.getElementById('ai-job-status-' + i);
        if (rowEl) rowEl.classList.add('processing');
        if (statusEl) statusEl.innerHTML = '<span class="ai-job-spinner"></span>Generating…';

        try {
            const reviewCanvas = document.getElementById('aiReviewCanvas').checked;
            // If they DON'T want to review, we pass `skip_edit: true` so the backend just saves it directly
            const d = await featurePost({ 
                action: 'ai_bg_remove_process', 
                job_id: aiJobs[i].id, 
                output_type: document.getElementById('aiOutputType').value, 
                output_format: document.getElementById('aiOutputFormat').value, 
                output_size: document.getElementById('aiOutputSize').value, 
                output_folder: document.getElementById('aiOutputFolder').value, 
                keep_orig_name: document.getElementById('aiKeepOrigName').checked ? '1' : '',
                path: F_CURRENT_PATH,
                skip_edit: reviewCanvas ? '0' : '1'
            });
            
            let finalD = d;
            if (d.status === 'needs_edit' && reviewCanvas) {
                finalD = await openAiEditorAndWait(d.image_b64, aiJobs[i].id);
            } else if (finalD.success) {
                if (statusEl) statusEl.innerHTML = '<span class="ai-job-spinner"></span>Validating…';
                await new Promise(r => setTimeout(r, 400));
                
                if (document.getElementById('aiKeepOrigName').checked) {
                    if (statusEl) statusEl.innerHTML = '<span class="ai-job-spinner"></span>Replacing Original…';
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            
            aiJobs[i].status = finalD.success ? 'done' : 'error';
            if (rowEl) { rowEl.classList.remove('processing'); rowEl.classList.add(finalD.success ? 'done' : 'error'); }
            
            if (statusEl) {
                if (finalD.success) {
                    statusEl.textContent = '✅ Completed';
                } else {
                    statusEl.innerHTML = '<span style="color:var(--danger)">❌ Failed<br><small style="font-size:11px;opacity:0.8">Original image kept.</small></span>';
                }
            }
        } catch(e) {
            aiJobs[i].status = 'error';
            if (rowEl) { rowEl.classList.remove('processing'); rowEl.classList.add('error'); }
            if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">❌ Failed<br><small style="font-size:11px;opacity:0.8">Original image kept.</small></span>';
        }
    }

    document.getElementById('aiCancelBtn').style.display = 'none';
    document.getElementById('aiDownloadBtn').style.display = '';
    toast('AI processing complete!');
}

function aiCancelAll() {
    const ids = aiJobs.filter(j => j.id).map(j => j.id);
    if (!ids.length) return;
    featurePost({ action: 'ai_bg_remove_cancel', job_ids: JSON.stringify(ids) }).then(() => {
        aiJobs.forEach(j => { if (j.status !== 'done') j.status = 'cancelled'; });
        toast('Jobs cancelled');
        document.getElementById('aiCancelBtn').style.display = 'none';
        document.getElementById('aiStartBtn').style.display = '';
    });
}

function aiDownloadZip() {
    const ids = aiJobs.filter(j => j.status === 'done' && j.id).map(j => j.id);
    if (!ids.length) { toast('No completed jobs', 'danger'); return; }
    const form = document.createElement('form'); form.method = 'post';
    form.innerHTML = `<input name="action" value="ai_bg_remove_download_zip"><input name="csrf_token" value="${F_CSRF_TOKEN}"><input name="path" value="${F_CURRENT_PATH}">` + ids.map(id => `<input name="job_ids[]" value="${id}">`).join('');
    document.body.appendChild(form); form.submit(); setTimeout(() => document.body.removeChild(form), 1000);
}

/* ── AI Canvas Editor ─────────────────────────────────────────────────── */
let aiEditorResolve = null;
let aiEditorImg = null;
let aiEditorCtx = null;
let aiEditorTransform = { x: 0, y: 0, scale: 1 };
let aiEditorIsDragging = false;
let aiEditorLastMouse = { x: 0, y: 0 };
let aiEditorCurrentJobId = null;
let aiEditorOriginalBgType = 'transparent';

function openAiEditorAndWait(imageB64, jobId) {
    return new Promise(resolve => {
        aiEditorResolve = resolve;
        aiEditorCurrentJobId = jobId;
        aiEditorOriginalBgType = document.getElementById('aiOutputBgType')?.value === 'white' ? 'white' : 'transparent';
        const bgSelect = document.getElementById('aiEditorBgType');
        if (bgSelect) bgSelect.value = aiEditorOriginalBgType;
        const rmBtn = document.getElementById('aiEditorRemoveBgBtn');
        if (rmBtn) {
            rmBtn.style.display = aiEditorStandaloneFilePath ? 'inline-block' : 'none';
        }
        
        const cvs = document.getElementById('aiEditorCanvas');
        aiEditorCtx = cvs.getContext('2d');
        
        document.getElementById('aiEditorZoom').value = 1;
        aiEditorTransform = { x: 0, y: 0, scale: 1 };
        
        aiEditorImg = new Image();
        aiEditorImg.onload = () => {
            aiEditorTransform.x = (cvs.width - aiEditorImg.width) / 2;
            aiEditorTransform.y = (cvs.height - aiEditorImg.height) / 2;
            document.getElementById('aiEditorZoomLabel').textContent = '100%';
            aiEditorDraw();
            openModal('aiEditorModal');
        };
        aiEditorImg.src = imageB64;
    });
}

function aiEditorDraw() {
    if (!aiEditorCtx || !aiEditorImg) return;
    const cvs = document.getElementById('aiEditorCanvas');
    const bgType = document.getElementById('aiEditorBgType').value;
    
    aiEditorCtx.clearRect(0, 0, cvs.width, cvs.height);
    
    if (bgType === 'white') {
        aiEditorCtx.fillStyle = 'white';
        aiEditorCtx.fillRect(0, 0, cvs.width, cvs.height);
    }
    
    aiEditorCtx.drawImage(
        aiEditorImg, 
        aiEditorTransform.x, 
        aiEditorTransform.y, 
        aiEditorImg.width * aiEditorTransform.scale, 
        aiEditorImg.height * aiEditorTransform.scale
    );
}

function aiEditorZoomChange() {
    aiEditorTransform.scale = parseFloat(document.getElementById('aiEditorZoom').value);
    document.getElementById('aiEditorZoomLabel').textContent = Math.round(aiEditorTransform.scale * 100) + '%';
    aiEditorDraw();
}

function aiEditorZoomIn() {
    const el = document.getElementById('aiEditorZoom');
    el.value = Math.min(parseFloat(el.max), parseFloat(el.value) + parseFloat(el.step));
    aiEditorZoomChange();
}

function aiEditorZoomOut() {
    const el = document.getElementById('aiEditorZoom');
    el.value = Math.max(parseFloat(el.min), parseFloat(el.value) - parseFloat(el.step));
    aiEditorZoomChange();
}

function aiEditorChangeSize() {
    const size = document.getElementById('aiEditorCanvasSize').value;
    const cvs = document.getElementById('aiEditorCanvas');
    const wrap = document.getElementById('aiEditorCanvasWrapper');
    
    if (size === '1920x1080') {
        cvs.width = 1920;
        cvs.height = 1080;
        wrap.style.aspectRatio = '16/9';
        wrap.style.maxWidth = '600px';
    } else {
        cvs.width = 1280;
        cvs.height = 1280;
        wrap.style.aspectRatio = '1/1';
        wrap.style.maxWidth = '500px';
    }
    aiEditorReset();
}

function aiEditorReset() {
    const cvs = document.getElementById('aiEditorCanvas');
    document.getElementById('aiEditorZoom').value = 1;
    aiEditorTransform.scale = 1;
    aiEditorTransform.x = (cvs.width - aiEditorImg.width) / 2;
    aiEditorTransform.y = (cvs.height - aiEditorImg.height) / 2;
    document.getElementById('aiEditorZoomLabel').textContent = '100%';
    aiEditorDraw();
}

function aiEditorSkip() {
    closeModal('aiEditorModal');
    if (aiEditorResolve) {
        aiEditorResolve({success: false, error: 'Skipped by user'});
        aiEditorResolve = null;
    }
}

async function aiEditorSave() {
    const btn = document.getElementById('aiEditorSaveBtn');
    btn.innerHTML = '<span class="ai-job-spinner"></span>Saving...';
    btn.disabled = true;
    
    const cvs = document.getElementById('aiEditorCanvas');
    
    let mime = 'image/webp';
    let outputFormat = 'webp';
    let outputFolder = '';
    
    if (aiEditorStandaloneFilePath) {
        const ext = aiEditorStandaloneFilePath.split('.').pop().toLowerCase();
        if (ext === 'png') mime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    } else {
        outputFormat = document.getElementById('aiOutputFormat').value;
        outputFolder = document.getElementById('aiOutputFolder').value;
        if (outputFormat === 'png') mime = 'image/png';
        else if (outputFormat === 'jpg' || outputFormat === 'jpeg') mime = 'image/jpeg';
    }
    
    // Save at 1.0 quality for maximum quality (lossless for WebP)
    const b64 = cvs.toDataURL(mime, 1.0);
    
    try {
        let d;
        if (aiEditorStandaloneFilePath) {
            d = await featurePost({
                action: 'canvas_edit_save',
                file_path: aiEditorStandaloneFilePath,
                image_b64: b64,
                path: F_CURRENT_PATH
            });
        } else {
            const keepOrigName = document.getElementById('aiKeepOrigName').checked ? '1' : '';
            d = await featurePost({
                action: 'ai_bg_remove_save_canvas',
                job_id: aiEditorCurrentJobId,
                image_b64: b64,
                output_format: outputFormat,
                output_folder: outputFolder,
                keep_orig_name: keepOrigName,
                path: F_CURRENT_PATH
            });
        }
        
        btn.innerHTML = '💾 Save & Continue';
        btn.disabled = false;
        
        if (d.success) {
            closeModal('aiEditorModal');
            if (aiEditorResolve) {
                aiEditorResolve(d);
                aiEditorResolve = null;
            }
            if (aiEditorStandaloneFilePath) {
                toast('Image saved successfully!', 'success');
                setTimeout(() => location.reload(), 800);
            }
        } else {
            toast(d.error || 'Save failed', 'danger');
        }
    } catch(e) {
        btn.innerHTML = '💾 Save & Continue';
        btn.disabled = false;
        toast('Save failed', 'danger');
    }
}

async function aiEditorRemoveBg() {
    if (!aiEditorStandaloneFilePath) return;
    const btn = document.getElementById('aiEditorRemoveBgBtn');
    if (!btn) return;
    const origText = btn.innerHTML;
    btn.innerHTML = '🪄 Removing...';
    btn.disabled = true;
    try {
        const d = await featurePost({ action: 'ai_bg_remove_sync', path: aiEditorStandaloneFilePath });
        if (d.success && d.image_b64) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                aiEditorImg = img;
                aiEditorReset(); // Recenter and redraw
                toast('Background removed successfully!', 'success');
                btn.innerHTML = origText;
                btn.disabled = false;
            };
            img.src = d.image_b64;
        } else {
            toast(d.error || 'Failed to remove background', 'danger');
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    } catch(e) {
        toast('Network error during removal', 'danger');
        btn.innerHTML = origText;
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cvs = document.getElementById('aiEditorCanvas');
    if (!cvs) return;
    
    const getMousePos = (e) => {
        const rect = cvs.getBoundingClientRect();
        const scaleX = cvs.width / rect.width;
        const scaleY = cvs.height / rect.height;
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };
    
    const startDrag = (e) => {
        if (!aiEditorImg) return;
        aiEditorIsDragging = true;
        aiEditorLastMouse = getMousePos(e);
        e.preventDefault();
    };
    
    const doDrag = (e) => {
        if (!aiEditorIsDragging) return;
        const pos = getMousePos(e);
        aiEditorTransform.x += (pos.x - aiEditorLastMouse.x);
        aiEditorTransform.y += (pos.y - aiEditorLastMouse.y);
        aiEditorLastMouse = pos;
        aiEditorDraw();
        e.preventDefault();
    };
    
    const endDrag = () => { aiEditorIsDragging = false; };
    
    cvs.addEventListener('mousedown', startDrag);
    cvs.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', endDrag);
    
    cvs.addEventListener('touchstart', startDrag, {passive: false});
    cvs.addEventListener('touchmove', doDrag, {passive: false});
    window.addEventListener('touchend', endDrag);
});

let aiEditorStandaloneFilePath = null;
function openStandaloneCanvasEditor(name, url) {
    aiEditorStandaloneFilePath = F_CURRENT_PATH ? F_CURRENT_PATH + '/' + name : name;
    aiEditorCurrentJobId = null;
    const rmBtn = document.getElementById('aiEditorRemoveBgBtn');
    if (rmBtn) rmBtn.style.display = 'inline-block';
    document.getElementById('aiEditorTitleInfo').textContent = '- Editing ' + name;
    
    // Hide skip button when standalone editing
    const skipBtn = document.querySelector('button[onclick="aiEditorSkip()"]');
    if (skipBtn) skipBtn.style.display = 'none';
    
    // Append timestamp to bust cache
    const imgUrl = url + '?t=' + Date.now();
    
    // Fetch image as base64 to load into canvas cleanly without taint
    fetch(imgUrl)
        .then(r => r.blob())
        .then(blob => {
            const reader = new FileReader();
            reader.onload = () => {
                openAiEditorAndWait(reader.result, null).then(() => {
                    // done
                });
            };
            reader.readAsDataURL(blob);
        }).catch(err => {
            toast('Failed to load image for editing', 'danger');
        });
}

async function openBatchCanvasEditor(rows) {
    const rmBtn = document.getElementById('aiEditorRemoveBgBtn');
    if (rmBtn) rmBtn.style.display = 'inline-block';
    
    const skipBtn = document.querySelector('button[onclick="aiEditorSkip()"]');
    if (skipBtn) skipBtn.style.display = 'inline-block';

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = row.dataset.name;
        const url = row.dataset.url;
        
        document.getElementById('aiEditorTitleInfo').textContent = '- Editing ' + name + ` (${i+1}/${rows.length})`;
        aiEditorStandaloneFilePath = F_CURRENT_PATH ? F_CURRENT_PATH + '/' + name : name;
        aiEditorCurrentJobId = null;

        const imgUrl = url + '?t=' + Date.now();
        
        try {
            const blob = await fetch(imgUrl).then(r => r.blob());
            const reader = new FileReader();
            const b64 = await new Promise((res, rej) => {
                reader.onload = () => res(reader.result);
                reader.onerror = () => rej(reader.error);
                reader.readAsDataURL(blob);
            });
            await openAiEditorAndWait(b64, null);
        } catch(e) {
            toast('Failed to load image: ' + name, 'danger');
        }
    }
}

/* ── Duplicate Finder ─────────────────────────────────────────────────── */
async function runDuplicateScan() {
    const scope = document.getElementById('dupScope').value;
    const byHash = '';
    const byName = document.getElementById('dupByName').checked ? '1' : '';
    const bySize = document.getElementById('dupBySize').checked ? '1' : '';
    if (!byName && !bySize) { toast('Select at least one match criteria', 'danger'); return; }

    document.getElementById('dupStatus').textContent = 'Scanning… (this may take a while for large libraries)';
    document.getElementById('dupResults').innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);">Computing hashes…</div>';

    try {
        const d = await featurePost({ action: 'find_duplicates', scope, by_hash: byHash, by_name: byName, by_size: bySize, path: F_CURRENT_PATH });
        if (!d.success) { document.getElementById('dupStatus').textContent = 'Error: ' + (d.error||'Unknown error'); document.getElementById('dupResults').innerHTML = ''; return; }
        document.getElementById('dupStatus').textContent = `Scanned ${d.total_files} files. Found ${d.groups.length} duplicate group(s).`;
        if (!d.groups.length) { document.getElementById('dupResults').innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">✅ No duplicates found!</div>'; return; }
        document.getElementById('dupResults').innerHTML = d.groups.map((g, gi) => `
            <div class="dup-group">
                <div class="dup-group-head">
                    <span>🔴 ${escHtml(g.reason)} — ${g.count} copies</span>
                </div>
                ${g.items.map((item, ii) => `
                    <div class="dup-item">
                        ${item.thumb_url ? `<img class="dup-thumb" src="${escHtml(item.thumb_url)}" onerror="this.style.display='none'" loading="lazy">` : '<div class="dup-thumb" style="background:var(--light);display:flex;align-items:center;justify-content:center;font-size:18px;">📄</div>'}
                        <div class="dup-info">
                            <div class="dup-name" title="${escHtml(item.rel)}">${escHtml(item.name)}</div>
                            <div class="dup-meta">${escHtml(item.rel)} · ${formatBytesJs(item.size)}</div>
                        </div>
                        <div class="dup-actions">
                            ${item.url ? `<a class="act-btn open" href="${escHtml(item.url)}" target="_blank">↗</a>` : ''}
                            <button class="act-btn del" onclick="dupDelete('${escHtml(item.rel)}', this)">🗑</button>
                        </div>
                    </div>`).join('')}
            </div>`).join('');
    } catch(e) {
        document.getElementById('dupStatus').textContent = 'Request failed';
        document.getElementById('dupResults').innerHTML = '';
    }
}

function dupDelete(rel, btn) {
    const mockForm = document.createElement('form');
    mockForm.ajaxSubmit = () => {
        const pw = document.getElementById('deletePasswordInput').value;
        featurePost({ action: 'delete_duplicate', item_rel: rel, delete_password: pw }).then(d => {
            toast(d.success ? 'Moved to trash' : (d.error||'Error'), d.success ? 'success' : 'danger');
            if (d.success) btn.closest('.dup-item')?.remove();
        });
    };
    addDeletePassword(mockForm, 'Move ' + rel + ' to trash?');
}

/* ── Storage Dashboard ────────────────────────────────────────────────── */
function renderStorageDashboardUI(card, d) {
    const lblText = F_CURRENT_PATH ? 'Folder size' : 'ebay total size';
    const panelMeta = document.getElementById('filePanelMeta');
    const value = card.querySelector('.stat-val');
    const label = card.querySelector('.stat-lbl');
    if (value && d.used_fmt) value.textContent = d.used_fmt;
    if (label) label.textContent = lblText;
    if (panelMeta) {
        const itemCount = panelMeta.dataset.itemCount || '0';
        panelMeta.textContent = `${itemCount} items · ${d.used_fmt} ${F_CURRENT_PATH ? 'folder size' : 'total size'} · Double-click to open`;
    }
    // Clean up any progress bar or quota detail ("of 150 GB")
    const track = card.querySelector('.storage-bar-track');
    if (track) track.remove();
    const detail = card.querySelector('.storage-detail');
    if (detail) detail.remove();
}

function loadStorageDashboard() {
    const card = document.getElementById('storageDashCard');
    if (!card) return;

    // Remove any leftover progress track or "of 150" detail
    const oldTrack = card.querySelector('.storage-bar-track');
    if (oldTrack) oldTrack.remove();
    const oldDetail = card.querySelector('.storage-detail');
    if (oldDetail) oldDetail.remove();

    // Inside subfolders, the folder size is calculated by the server and rendered into the card!
    if (typeof F_CURRENT_PATH !== 'undefined' && F_CURRENT_PATH !== '') {
        const fallbackSize = card.dataset.fallbackSize || card.querySelector('.stat-val')?.textContent || '0 B';
        const value = card.querySelector('.stat-val');
        const label = card.querySelector('.stat-lbl');
        if (value && (!value.textContent || value.textContent.trim() === '0 B' || value.textContent.trim() === '0')) {
            value.textContent = fallbackSize;
        }
        if (label) label.textContent = 'Folder size';
        return;
    }

    // Root folder: check sessionStorage cache first (instant 0ms render)
    try {
        const cachedRaw = sessionStorage.getItem('kiuq_root_storage_stats');
        if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached && (Date.now() - (cached.time || 0) < 300000) && cached.data) {
                renderStorageDashboardUI(card, cached.data);
                return;
            }
        }
    } catch(e){}

    featurePost({ action: 'get_storage_stats', path: '' }).then(d => {
        if (!d.success) return;
        try {
            sessionStorage.setItem('kiuq_root_storage_stats', JSON.stringify({ data: d, time: Date.now() }));
        } catch(e){}
        renderStorageDashboardUI(card, d);
    }).catch(() => {
        const value = card.querySelector('.stat-val');
        const label = card.querySelector('.stat-lbl');
        const panelMeta = document.getElementById('filePanelMeta');
        const fallbackSize = card.dataset.fallbackSize || '0 B';
        if (value) value.textContent = fallbackSize;
        if (label) label.textContent = F_CURRENT_PATH ? 'Folder size' : 'ebay total size';
        if (panelMeta) {
            const itemCount = panelMeta.dataset.itemCount || '0';
            panelMeta.textContent = `${itemCount} items · ${fallbackSize} ${F_CURRENT_PATH ? 'folder size' : 'total size'} · Double-click to open`;
        }
    });
}

window.addEventListener('load', () => {
    const run = () => loadStorageDashboard();
    if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1200 });
    } else {
        setTimeout(run, 150);
    }
});

function openDuplicateModal() { openModal('duplicateModal'); }

/* ── Rename Type ──────────────────────────────────────────────────────── */
let renameTypeTargetItems = [];
let renameTypeParentPath = '';
const DEFAULT_RENAME_TYPES = ["MiniExcavator", "SkidSteer", "Forklift", "WheelLoader", "RoadRoller", "ScissorLift"];

function getRenameTypes() {
    try {
        let saved = localStorage.getItem('renameTypes');
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return DEFAULT_RENAME_TYPES;
}

function saveRenameTypes(arr) {
    localStorage.setItem('renameTypes', JSON.stringify(arr));
}

function renderRenameTypeSelect() {
    const sel = document.getElementById('renameTypeSelect');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    const types = getRenameTypes();
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        sel.appendChild(opt);
    });
    if (types.includes(currentVal)) {
        sel.value = currentVal;
    }
}

function openRenameTypeModalSingle(name, parentPath) {
    renameTypeTargetItems = [name];
    renameTypeParentPath = parentPath;
    renderRenameTypeSelect();
    document.getElementById('newRenameType').value = '';
    openModal('renameTypeModal');
}

function openRenameTypeModalMulti() {
    const inputs = document.querySelectorAll('.file-check:checked:not(#selectAllChk)');
    if (inputs.length === 0) {
        if(typeof toast === 'function') toast('No files selected', 'warning');
        return;
    }
    renameTypeTargetItems = Array.from(inputs).map(inp => inp.dataset.name).filter(n => n);
    renameTypeParentPath = typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '';
    renderRenameTypeSelect();
    document.getElementById('newRenameType').value = '';
    openModal('renameTypeModal');
}

function addRenameType() {
    const inp = document.getElementById('newRenameType');
    const val = inp.value.trim();
    if (!val) return;
    const types = getRenameTypes();
    if (!types.includes(val)) {
        types.push(val);
        saveRenameTypes(types);
        renderRenameTypeSelect();
    }
    inp.value = '';
    document.getElementById('renameTypeSelect').value = val;
}

function deleteRenameType() {
    const sel = document.getElementById('renameTypeSelect');
    const val = sel.value;
    if (!val) return;
    let types = getRenameTypes();
    types = types.filter(t => t !== val);
    saveRenameTypes(types);
    renderRenameTypeSelect();
}

function applyRenameType() {
    const sel = document.getElementById('renameTypeSelect');
    const baseName = sel.value;
    if (!baseName || renameTypeTargetItems.length === 0) return;
    
    closeModal('renameTypeModal');
    
    const form = document.createElement('form');
    form.method = 'post';
    form.innerHTML = `<input type="hidden" name="action" value="rename_type">
<input type="hidden" name="csrf_token" value="${typeof F_CSRF_TOKEN !== 'undefined' ? F_CSRF_TOKEN : ''}">
<input type="hidden" name="path" value="${escHtml(renameTypeParentPath)}">
<input type="hidden" name="base_name" value="${escHtml(baseName)}">`;

    renameTypeTargetItems.forEach(item => {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = 'items[]';
        inp.value = item;
        form.appendChild(inp);
    });
    
    document.body.appendChild(form);
    form.submit();
}

/* ======================================================================
   CONVERT FILE TYPE ENGINE (Sony ARW RAW & ZIP to JPG/PNG)
====================================================================== */
let selectedConvertFiles = [];
let convertIsBusy = false;
let convertCurrentJobId = null;

function openConvertModal() {
    if (typeof toggleSidebar === 'function') toggleSidebar(false);
    resetConvertModal();
    openModal('convertModal');
}

function closeConvertModal() {
    if (convertIsBusy) {
        if (!confirm('A conversion is currently running. Are you sure you want to stop and close?')) {
            return;
        }
    }
    closeModal('convertModal');
    resetConvertModal();
}

function resetConvertModal() {
    selectedConvertFiles = [];
    convertIsBusy = false;
    convertCurrentJobId = null;

    const setupView = document.getElementById('convertSetupView');
    const progressView = document.getElementById('convertProgressView');
    const doneActions = document.getElementById('convertDoneActions');
    const fileInput = document.getElementById('convert-file-input');
    const notice = document.getElementById('convertFileNotice');
    const summary = document.getElementById('convertSelectedSummary');
    const activityList = document.getElementById('convertActivityList');
    const startBtn = document.getElementById('convertStartBtn');
    const bundleBtn = document.getElementById('convertBundleDownloadBtn');

    if (setupView) setupView.style.display = 'block';
    if (progressView) progressView.style.display = 'none';
    if (doneActions) doneActions.style.display = 'none';
    if (fileInput) fileInput.value = '';
    if (notice) { notice.textContent = ''; notice.style.display = 'none'; }
    if (summary) summary.style.display = 'none';
    if (activityList) activityList.innerHTML = '';
    if (bundleBtn) { bundleBtn.style.display = 'none'; bundleBtn.href = '#'; }
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Convert Now ➔'; }

    const progressBar = document.getElementById('convertProgressBar');
    const percentBadge = document.getElementById('convertPercentBadge');
    if (progressBar) progressBar.style.width = '0%';
    if (percentBadge) percentBadge.textContent = '0%';
}

function toggleConvertFormat(fmt) {
    const lblJpg = document.getElementById('lblFormatJpg');
    const lblPng = document.getElementById('lblFormatPng');
    const qualityWrap = document.getElementById('convertJpgQualityWrap');

    if (fmt === 'jpg') {
        if (lblJpg) {
            lblJpg.style.border = '2px solid var(--accent)';
            lblJpg.style.background = 'rgba(79,70,229,0.06)';
        }
        if (lblPng) {
            lblPng.style.border = '1.5px solid var(--line)';
            lblPng.style.background = 'var(--light)';
        }
        if (qualityWrap) qualityWrap.style.display = 'block';
    } else {
        if (lblPng) {
            lblPng.style.border = '2px solid var(--accent)';
            lblPng.style.background = 'rgba(79,70,229,0.06)';
        }
        if (lblJpg) {
            lblJpg.style.border = '1.5px solid var(--line)';
            lblJpg.style.background = 'var(--light)';
        }
        if (qualityWrap) qualityWrap.style.display = 'none';
    }
}

function parseConvertJsonResilient(text) {
    if (!text || typeof text !== 'string') throw new Error('Empty server response');
    let str = text.trim();
    const s = str.indexOf('{');
    const e = str.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) {
        str = str.substring(s, e + 1);
    }
    return JSON.parse(str);
}

function updateConvertQualityVal(val) {
    const el = document.getElementById('convertJpgQualityVal');
    if (!el) return;
    let desc = '100% (Maximum Quality / Same as Original)';
    if (val >= 100) desc = '100% (Maximum Quality / Same as Original)';
    else if (val >= 95) desc = 'Ultra High Quality';
    else if (val >= 90) desc = 'High Quality';
    else if (val >= 80) desc = 'Good Quality';
    else desc = 'Standard';
    el.textContent = val >= 100 ? desc : (val + '% (' + desc + ')');
}

function handleConvertFilesSelected(fileList) {
    if (!fileList || !fileList.length) return;

    const validFiles = [];
    const rejectedFiles = [];

    Array.from(fileList).forEach(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'arw' || ext === 'avif' || ext === 'zip') {
            validFiles.push(file);
        } else {
            rejectedFiles.push(file.name);
        }
    });

    if (rejectedFiles.length > 0) {
        const msg = rejectedFiles.length === 1
            ? `"${rejectedFiles[0]}" was rejected. Only .arw, .avif, and .zip files are allowed.`
            : `${rejectedFiles.length} files were rejected. Only .arw, .avif, and .zip files are allowed.`;
        if (typeof toast === 'function') toast(msg, 'warning');
        else alert(msg);
    }

    if (validFiles.length === 0) return;

    selectedConvertFiles = validFiles;

    const notice = document.getElementById('convertFileNotice');
    const summary = document.getElementById('convertSelectedSummary');
    const countEl = document.getElementById('convertSelectedCount');
    const listEl = document.getElementById('convertSelectedItemsList');

    if (notice) {
        notice.textContent = `✓ ${validFiles.length} file(s) selected ready to convert`;
        notice.style.display = 'block';
    }

    if (summary && countEl && listEl) {
        summary.style.display = 'block';
        let totalBytes = validFiles.reduce((acc, f) => acc + f.size, 0);
        countEl.textContent = `${validFiles.length} file(s) selected (${formatBytesJs(totalBytes)})`;
        listEl.innerHTML = validFiles.map(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            const badgeColor = ext === 'zip' ? '#059669' : (ext === 'avif' ? '#0284c7' : '#4f46e5');
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:70%;">
                    <strong style="color:${badgeColor}; font-size:10px; border:1px solid ${badgeColor}; padding:0 4px; border-radius:3px; margin-right:5px;">.${ext.toUpperCase()}</strong>
                    ${escHtml(f.name)}
                </span>
                <span style="font-family:monospace; font-size:11px;">${formatBytesJs(f.size)}</span>
            </div>`;
        }).join('');
    }
}

function clearConvertSelection() {
    selectedConvertFiles = [];
    const fileInput = document.getElementById('convert-file-input');
    if (fileInput) fileInput.value = '';
    const notice = document.getElementById('convertFileNotice');
    const summary = document.getElementById('convertSelectedSummary');
    if (notice) { notice.textContent = ''; notice.style.display = 'none'; }
    if (summary) summary.style.display = 'none';
}

function setupConvertDropZone() {
    const dz = document.getElementById('convertDropZone');
    if (!dz) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dz.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            dz.style.borderColor = 'var(--accent)';
            dz.style.background = 'rgba(79,70,229,0.08)';
            dz.style.transform = 'scale(1.01)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dz.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
            dz.style.borderColor = 'rgba(79,70,229,0.35)';
            dz.style.background = 'rgba(79,70,229,0.02)';
            dz.style.transform = 'scale(1)';
        }, false);
    });

    dz.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
            handleConvertFilesSelected(dt.files);
        }
    }, false);
}

// ── Conversion Execution Flow ──────────────────────────────────────────
async function startConvertProcess() {
    if (!selectedConvertFiles || selectedConvertFiles.length === 0) {
        if (typeof toast === 'function') toast('Please select or drop .ARW, .AVIF, or .ZIP files first', 'warning');
        else alert('Please select or drop .ARW, .AVIF, or .ZIP files first');
        return;
    }

    const formatRadio = document.querySelector('input[name="convert_target_format"]:checked');
    const targetFormat = formatRadio ? formatRadio.value : 'jpg';
    const qualityRange = document.getElementById('convertJpgQualityRange');
    const jpgQuality = qualityRange ? parseInt(qualityRange.value, 10) : 100;
    const saveToCurrent = document.getElementById('convertSaveToCurrent')?.checked ? '1' : '0';

    convertIsBusy = true;
    document.getElementById('convertSetupView').style.display = 'none';
    document.getElementById('convertProgressView').style.display = 'block';
    document.getElementById('convertDoneActions').style.display = 'none';

    const progressBar = document.getElementById('convertProgressBar');
    const percentBadge = document.getElementById('convertPercentBadge');
    const statusMsg = document.getElementById('convertStatusMsg');
    const activityList = document.getElementById('convertActivityList');
    activityList.innerHTML = '';

    const setProgress = (percent, msg) => {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        if (progressBar) progressBar.style.width = p + '%';
        if (percentBadge) percentBadge.textContent = p + '%';
        if (statusMsg && msg) statusMsg.textContent = msg;
    };

    try {
        // If single file and it's a ZIP: run ZIP processing workflow
        if (selectedConvertFiles.length === 1 && selectedConvertFiles[0].name.toLowerCase().endsWith('.zip')) {
            await convertRunZipWorkflow(selectedConvertFiles[0], targetFormat, jpgQuality, saveToCurrent, setProgress);
        } else {
            // Run batch of ARW files (or multiple files)
            await convertRunArwBatchWorkflow(selectedConvertFiles, targetFormat, jpgQuality, saveToCurrent, setProgress);
        }
    } catch (err) {
        console.error('[Convert Error]', err);
        setProgress(0, 'Conversion failed: ' + (err.message || 'Unknown error'));
        if (typeof toast === 'function') toast('Conversion error: ' + (err.message || 'Unknown'), 'danger');
    } finally {
        convertIsBusy = false;
        const spinner = document.getElementById('convertActiveSpinner');
        if (spinner) spinner.style.display = 'none';
        document.getElementById('convertDoneActions').style.display = 'block';
    }
}

// Run `worker(i)` for i in [0,count) with at most `limit` in flight at once
async function convertRunPool(count, limit, worker) {
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, count) }, async () => {
        while (next < count) {
            const i = next++;
            await worker(i);
        }
    });
    await Promise.all(runners);
}

// ── Batch ARW conversion ──
async function convertRunArwBatchWorkflow(files, format, quality, saveToCurrent, setProgress) {
    const total = files.length;
    const activityList = document.getElementById('convertActivityList');
    let convertedCount = 0;
    const fracs = new Array(total).fill(0);
    const updateOverall = (msg) => setProgress((fracs.reduce((a, b) => a + b, 0) / total) * 100, msg);

    const processFile = async (i) => {
        const file = files[i];
        const isZip = file.name.toLowerCase().endsWith('.zip');

        if (isZip) {
            await convertRunZipWorkflow(file, format, quality, saveToCurrent, setProgress);
            fracs[i] = 1;
            return;
        }
        const setStep = (frac, msg) => { fracs[i] = frac; updateOverall(msg); };

        // Activity item row
        const rowId = 'act-row-' + i;
        const row = document.createElement('div');
        row.id = rowId;
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 10px; border-radius:8px; background:var(--surface); border:1px solid var(--line); font-size:12px;';
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                <span style="font-size:14px;">🔄</span>
                <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${escHtml(file.name)}</strong>
                    <span style="color:var(--muted); font-size:11px; margin-left:6px;">(${formatBytesJs(file.size)})</span>
                </div>
            </div>
            <div id="${rowId}-status" style="font-weight:700; color:var(--accent); font-size:11px; flex-shrink:0;">
                Uploading...
            </div>
        `;
        activityList.appendChild(row);
        activityList.scrollTop = activityList.scrollHeight;

        try {
            setStep(0.2, `Uploading ${file.name} (${i + 1}/${total})...`);

            const formData = new FormData();
            formData.append('action', 'convert_upload_file');
            formData.append('file', file);
            formData.append('target_format', format);
            formData.append('jpg_quality', quality);
            formData.append('save_to_current', saveToCurrent);
            formData.append('path', typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '');
            if (typeof F_CSRF_TOKEN !== 'undefined') formData.append('csrf_token', F_CSRF_TOKEN);

            const statusEl = document.getElementById(`${rowId}-status`);

            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', typeof F_ACTION_ENDPOINT !== 'undefined' ? F_ACTION_ENDPOINT : window.location.href, true);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json');

                xhr.upload.onprogress = e => {
                    if (e.lengthComputable) {
                        const upP = (e.loaded / e.total) * 0.7; // 70% of this step is upload
                        setStep(upP, `Uploading ${file.name}: ${Math.round((e.loaded/e.total)*100)}%`);
                        if (statusEl) statusEl.textContent = `Uploading ${Math.round((e.loaded/e.total)*100)}%`;
                    }
                };

                xhr.onload = () => {
                    if (statusEl) statusEl.textContent = 'Converting...';
                    setStep(0.85, `Converting ${file.name}...`);
                    try {
                        const json = parseConvertJsonResilient(xhr.responseText);
                        resolve(json);
                    } catch (ex) {
                        const raw = (xhr.responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                        reject(new Error(raw ? (raw.length > 100 ? raw.substring(0, 100) + '...' : raw) : 'Server returned invalid response'));
                    }
                };
                xhr.onerror = () => reject(new Error('Network upload failed'));
                xhr.send(formData);
            });

            if (result.success) {
                convertedCount++;
                setStep(1, `Converted ${file.name} successfully`);
                row.style.borderColor = 'rgba(16,185,129,0.3)';
                row.style.background = 'rgba(16,185,129,0.04)';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                        <span style="color:#059669; font-size:15px;">✅</span>
                        <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <strong>${escHtml(result.converted_name)}</strong>
                            <span style="color:var(--muted); font-size:11px; margin-left:6px;">(${result.size_formatted})</span>
                            ${result.saved_to_library ? '<span style="font-size:10px; background:rgba(79,70,229,0.1); color:var(--accent); padding:1px 5px; border-radius:4px; margin-left:6px;">Saved in folder</span>' : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <a href="${result.download_url}" class="form-btn btn-secondary" style="padding:4px 10px; font-size:11px; text-decoration:none;" download>
                            ⬇ Download
                        </a>
                    </div>
                `;
            } else {
                row.style.borderColor = 'rgba(239,68,68,0.3)';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                        <span style="color:var(--danger); font-size:15px;">❌</span>
                        <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <strong>${escHtml(file.name)}</strong>
                            <span style="color:var(--danger); font-size:11px; margin-left:6px;">${escHtml(result.error || 'Failed')}</span>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            row.style.borderColor = 'rgba(239,68,68,0.3)';
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                    <span style="color:var(--danger); font-size:15px;">❌</span>
                    <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <strong>${escHtml(file.name)}</strong>
                        <span style="color:var(--danger); font-size:11px; margin-left:6px;">${escHtml(err.message)}</span>
                    </div>
                </div>
            `;
        }
        fracs[i] = 1;
    };

    // ZIPs have their own multi-step progress, so run them one at a time after the parallel pool
    const plainIdx = [];
    const zipIdx = [];
    files.forEach((f, i) => (f.name.toLowerCase().endsWith('.zip') ? zipIdx : plainIdx).push(i));
    await convertRunPool(plainIdx.length, 4, (k) => processFile(plainIdx[k]));
    for (const i of zipIdx) await processFile(i);

    setProgress(100, `Completed! ${convertedCount}/${total} file(s) converted.`);
    if (typeof toast === 'function') toast(`Finished converting ${convertedCount} file(s)`, 'success');
}

// ── ZIP Archive extraction and step-by-step conversion ──
async function convertRunZipWorkflow(zipFile, format, quality, saveToCurrent, setProgress) {
    const activityList = document.getElementById('convertActivityList');

    // 1. Upload and initialize ZIP job
    setProgress(5, `Uploading archive "${zipFile.name}"...`);

    const formData = new FormData();
    formData.append('action', 'convert_init_job');
    formData.append('file', zipFile);
    formData.append('target_format', format);
    formData.append('jpg_quality', quality);
    formData.append('save_to_current', saveToCurrent);
    formData.append('path', typeof F_CURRENT_PATH !== 'undefined' ? F_CURRENT_PATH : '');
    if (typeof F_CSRF_TOKEN !== 'undefined') formData.append('csrf_token', F_CSRF_TOKEN);

    const initResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', typeof F_ACTION_ENDPOINT !== 'undefined' ? F_ACTION_ENDPOINT : window.location.href, true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Accept', 'application/json');

        xhr.upload.onprogress = e => {
            if (e.lengthComputable) {
                const upP = 5 + (e.loaded / e.total) * 20; // 5% -> 25%
                setProgress(upP, `Uploading ZIP: ${Math.round((e.loaded/e.total)*100)}% (${formatBytesJs(e.loaded)} / ${formatBytesJs(e.total)})`);
            }
        };

        xhr.onload = () => {
            setProgress(25, 'Extracting ZIP & discovering files...');
            try {
                const json = parseConvertJsonResilient(xhr.responseText);
                resolve(json);
            } catch (ex) {
                const raw = (xhr.responseText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                reject(new Error(raw ? (raw.length > 100 ? raw.substring(0, 100) + '...' : raw) : 'Server returned invalid response'));
            }
        };
        xhr.onerror = () => reject(new Error('Network error uploading ZIP archive'));
        xhr.send(formData);
    });

    if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to process ZIP archive');
    }

    const jobId = initResult.job_id;
    const totalFiles = initResult.total_files;
    const discoveredFiles = initResult.files || [];

    setProgress(28, `Found ${totalFiles} image(s) (.ARW / .AVIF) in ZIP archive. Converting...`);

    // 2. Convert step-by-step
    let convertedSuccess = 0;
    let zipDone = 0;
    const zipStep = async (idx) => {
        const fileInfo = discoveredFiles[idx];
        const fileName = fileInfo.name || `Image_${idx + 1}.arw`;

        setProgress(30 + (zipDone / totalFiles) * 60, `Converting [${zipDone + 1}/${totalFiles}] ${fileName} to ${format.toUpperCase()}...`);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 10px; border-radius:8px; background:var(--surface); border:1px solid var(--line); font-size:12px;';
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                <span class="ai-job-spinner"></span>
                <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <strong>${escHtml(fileName)}</strong>
                    <span style="color:var(--muted); font-size:11px; margin-left:6px;">(${fileInfo.size_formatted || ''})</span>
                </div>
            </div>
            <div style="color:var(--accent); font-size:11px; font-weight:700;">Processing...</div>
        `;
        activityList.appendChild(row);
        activityList.scrollTop = activityList.scrollHeight;

        try {
            const stepFormData = new FormData();
            stepFormData.append('action', 'convert_process_step');
            stepFormData.append('job_id', jobId);
            stepFormData.append('file_index', idx);
            if (typeof F_CSRF_TOKEN !== 'undefined') stepFormData.append('csrf_token', F_CSRF_TOKEN);

            const resp = await fetch(typeof F_ACTION_ENDPOINT !== 'undefined' ? F_ACTION_ENDPOINT : window.location.href, {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
                body: stepFormData
            });
            const stepRawText = await resp.text();
            let stepData;
            try {
                stepData = parseConvertJsonResilient(stepRawText);
            } catch (jsonErr) {
                const cleanMsg = stepRawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                throw new Error(cleanMsg ? (cleanMsg.length > 90 ? cleanMsg.substring(0, 90) + '...' : cleanMsg) : 'Server conversion error');
            }

            if (stepData.success) {
                convertedSuccess++;
                row.style.borderColor = 'rgba(16,185,129,0.3)';
                row.style.background = 'rgba(16,185,129,0.04)';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                        <span style="color:#059669; font-size:15px;">✅</span>
                        <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <strong>${escHtml(stepData.converted_name)}</strong>
                            <span style="color:var(--muted); font-size:11px; margin-left:6px;">(${stepData.size_formatted}) • ${stepData.duration}s</span>
                            ${stepData.saved_to_library ? '<span style="font-size:10px; background:rgba(79,70,229,0.1); color:var(--accent); padding:1px 5px; border-radius:4px; margin-left:6px;">Saved in folder</span>' : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <a href="${stepData.download_url}" class="form-btn btn-secondary" style="padding:4px 10px; font-size:11px; text-decoration:none;" download>
                            ⬇ Download
                        </a>
                    </div>
                `;
            } else {
                row.style.borderColor = 'rgba(239,68,68,0.3)';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                        <span style="color:var(--danger); font-size:15px;">❌</span>
                        <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <strong>${escHtml(fileName)}</strong>
                            <span style="color:var(--danger); font-size:11px; margin-left:6px;">${escHtml(stepData.error || 'Failed')}</span>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            row.style.borderColor = 'rgba(239,68,68,0.3)';
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                    <span style="color:var(--danger); font-size:15px;">❌</span>
                    <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <strong>${escHtml(fileName)}</strong>
                        <span style="color:var(--danger); font-size:11px; margin-left:6px;">${escHtml(err.message)}</span>
                    </div>
                </div>
            `;
        }
        zipDone++;
        setProgress(30 + (zipDone / totalFiles) * 60, `Converted ${zipDone}/${totalFiles}...`);
    };
    await convertRunPool(totalFiles, 4, zipStep);

    // 3. Finalize & create downloadable bundle ZIP
    setProgress(93, 'Bundling converted images into download ZIP...');
    const finishFormData = new FormData();
    finishFormData.append('action', 'convert_finish_job');
    finishFormData.append('job_id', jobId);
    if (typeof F_CSRF_TOKEN !== 'undefined') finishFormData.append('csrf_token', F_CSRF_TOKEN);

    const finishResp = await fetch(typeof F_ACTION_ENDPOINT !== 'undefined' ? F_ACTION_ENDPOINT : window.location.href, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
        body: finishFormData
    });
    const finishRawText = await finishResp.text();
    let finishData = {};
    try {
        finishData = parseConvertJsonResilient(finishRawText);
    } catch (e) {
        console.warn('Could not parse finish job response:', finishRawText);
    }

    if (finishData.success && finishData.download_bundle_url) {
        const bundleBtn = document.getElementById('convertBundleDownloadBtn');
        if (bundleBtn) {
            bundleBtn.href = finishData.download_bundle_url;
            bundleBtn.style.display = 'inline-flex';
            bundleBtn.textContent = `📦 Download All as ZIP (${finishData.bundle_zip_size || ''})`;
        }
    }

    setProgress(100, `Done! Converted ${convertedSuccess}/${totalFiles} images from ZIP archive.`);
    if (typeof toast === 'function') toast(`Converted ${convertedSuccess} images from ZIP successfully!`, 'success');
}

// Auto-wire dropzone and check for ?convert=1 parameter
document.addEventListener('DOMContentLoaded', () => {
    setupConvertDropZone();
    if (new URLSearchParams(window.location.search).get('convert') === '1') {
        setTimeout(openConvertModal, 250);
    }
});

/* ── Utility ──────────────────────────────────────────────────────────── */
function escHtml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function formatBytesJs(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1073741824) return (bytes/1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576)    return (bytes/1048576).toFixed(1) + ' MB';
    if (bytes >= 1024)       return (bytes/1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

