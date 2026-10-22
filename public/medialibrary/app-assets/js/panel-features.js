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
function loadStorageDashboard() {
    const card = document.getElementById('storageDashCard');
    if (!card) return;
    const oldTrack = card.querySelector('.storage-bar-track');
    if (oldTrack) oldTrack.remove();
    const oldDetail = card.querySelector('.storage-detail');
    if (oldDetail) oldDetail.remove();

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

    featurePost({ action: 'get_storage_stats', path: F_CURRENT_PATH }).then(d => {
        if (!d.success) return;
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

// ── Batch ARW conversion ──
async function convertRunArwBatchWorkflow(files, format, quality, saveToCurrent, setProgress) {
    const total = files.length;
    const activityList = document.getElementById('convertActivityList');
    let convertedCount = 0;

    for (let i = 0; i < total; i++) {
        const file = files[i];
        const isZip = file.name.toLowerCase().endsWith('.zip');

        if (isZip) {
            await convertRunZipWorkflow(file, format, quality, saveToCurrent, setProgress);
            continue;
        }

        const basePercent = (i / total) * 100;
        const stepPercent = (1 / total) * 100;

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
            setProgress(basePercent + stepPercent * 0.2, `Uploading ${file.name} (${i + 1}/${total})...`);

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
                        setProgress(basePercent + stepPercent * upP, `Uploading ${file.name}: ${Math.round((e.loaded/e.total)*100)}%`);
                        if (statusEl) statusEl.textContent = `Uploading ${Math.round((e.loaded/e.total)*100)}%`;
                    }
                };

                xhr.onload = () => {
                    if (statusEl) statusEl.textContent = 'Converting...';
                    setProgress(basePercent + stepPercent * 0.85, `Converting ${file.name}...`);
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
                setProgress(basePercent + stepPercent, `Converted ${file.name} successfully`);
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
    }

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
    for (let idx = 0; idx < totalFiles; idx++) {
        const fileInfo = discoveredFiles[idx];
        const fileName = fileInfo.name || `Image_${idx + 1}.arw`;
        const stepBasePercent = 30 + (idx / totalFiles) * 60; // 30% -> 90%
        const stepSlice = (1 / totalFiles) * 60;

        setProgress(stepBasePercent, `Converting [${idx + 1}/${totalFiles}] ${fileName} to ${format.toUpperCase()}...`);

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
    }

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

