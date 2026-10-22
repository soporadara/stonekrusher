<!-- Upload -->
<!-- Rename Type Modal -->
<div class="modal-overlay" id="renameTypeModal">
    <div class="modal-content">
        <div class="modal-header">
            <span class="modal-title">🏷️ Rename Type</span>
            <button class="modal-close" onclick="closeModal('renameTypeModal')">✕</button>
        </div>
        <div class="modal-body">
            <p class="modal-desc">Select a product type. It will automatically rename selected files to Product-01, Product-02, etc.</p>
            <div style="display:flex; gap:8px; margin-bottom: 15px;">
                <select class="form-input" id="renameTypeSelect" style="flex:1;">
                    <!-- Populated by JS -->
                </select>
                <button type="button" class="form-btn danger" onclick="deleteRenameType()" title="Delete selected type" style="padding: 0 12px;">🗑️</button>
            </div>
            <div style="display:flex; gap:8px; margin-bottom: 15px;">
                <input type="text" class="form-input" id="newRenameType" placeholder="New product name..." style="flex:1;">
                <button type="button" class="form-btn primary" onclick="addRenameType()">+ Add</button>
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="form-btn btn-secondary" onclick="closeModal('renameTypeModal')">Cancel</button>
            <button type="button" class="form-btn primary" onclick="applyRenameType()">Apply to Selected</button>
        </div>
    </div>
</div>

<div class="modal-overlay" id="uploadModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📤 Upload Files</span>
            <button class="modal-close" onclick="closeModal('uploadModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post" enctype="multipart/form-data" id="uploadForm" onsubmit="event.preventDefault(); handleUploadSubmit(event); return false;">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="upload_files">
                <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
                <div class="drop-zone" id="dropZone">
                    <div class="dz-icon">☁️</div>
                    <h4>Drop files or folders here or click to browse</h4>
                    <p>Images (jpg, png, webp, gif, svg, avif, jfif, bmp, heic...), Videos, Code, or ZIP</p>
                    <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                        <button type="button" class="form-btn btn-secondary" onclick="document.getElementById('upload-file-input').click()">Select Files</button>
                        <button type="button" class="form-btn btn-secondary" onclick="document.getElementById('upload-folder-input').click()">Select Folder</button>
                    </div>
                    <p style="margin-top:8px;font-size:12px;color:var(--accent);font-weight:700;" id="dropZoneFiles"></p>
                </div>
                <input type="file" id="upload-file-input" style="display:none" name="upload_files[]" multiple
                    accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.avif,.jfif,.bmp,.ico,.tiff,.tif,.heic,.heif,image/*,.html,.txt,.css,.js,.json,.php,.zip,.mp4,.webm,.mov,.mkv,.avi,.wmv,.flv,.m4v,.3gp,.ogv,.ogg,.ts,.mts,.m2ts,.vob,video/*"
                    onchange="updateDropZone(this)">
                <input type="file" id="upload-folder-input" style="display:none" name="upload_files[]" multiple webkitdirectory directory
                    onchange="updateDropZone(this)">
                <div style="margin-top:12px; padding:10px 14px; background:rgba(79,70,229,0.06); border:1.5px solid rgba(79,70,229,0.18); border-radius:10px; display:flex; align-items:center; gap:10px;">
                    <input type="hidden" name="convert_webp" value="0">
                    <input type="checkbox" id="autoWebpCheckbox" name="convert_webp" value="1" checked style="width:18px; height:18px; cursor:pointer; accent-color:#4f46e5; margin:0;">
                    <label for="autoWebpCheckbox" style="font-size:12.5px; font-weight:700; color:var(--text); cursor:pointer; margin:0; user-select:none; display:flex; flex-direction:column; gap:2px;">
                        <span>⚡ Auto-convert images to WebP <span style="font-size:11px; color:#4f46e5; font-weight:800; background:rgba(79,70,229,0.12); padding:1px 6px; border-radius:4px;">Recommended</span></span>
                        <span style="font-size:11px; color:var(--muted); font-weight:500;">Uncheck to keep 100% original image formats (PNG stays PNG, JPG stays JPG, etc.)</span>
                    </label>
                </div>
                <p style="font-size:11.5px;color:var(--muted);margin-top:10px;font-weight:600;">
                    ⚡ Ultra-fast uploads. All original video formats & quality 100% preserved.
                </p>
                <div id="uploadProgressWrap" style="display:none;margin-top:14px;padding:12px 14px;background:var(--light);border:1.5px solid var(--line);border-radius:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span class="upload-global-text" id="uploadGlobalText" style="margin:0;font-weight:700;font-size:12px;color:var(--text);">Preparing upload...</span>
                        <span id="uploadGlobalPercent" style="font-size:12px;font-weight:800;color:var(--accent);">0%</span>
                    </div>
                    <div class="upload-global-track" style="height:10px;background:rgba(79,70,229,0.12);border-radius:6px;overflow:hidden;">
                        <div class="upload-global-bar" id="uploadGlobalBar" style="height:100%;width:0%;background:linear-gradient(135deg, #4f46e5, #6366f1);transition:width 0.15s ease;"></div>
                    </div>
                    <div class="upload-progress-list" id="uploadProgressList" style="margin-top:10px;max-height:190px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
                </div>
                <div class="btn-row" style="margin-top:18px;">
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('uploadModal')">Cancel</button>
                    <button type="button" class="form-btn btn-primary" id="uploadSubmitBtn" onclick="handleUploadSubmit(event)">Upload →</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Convert File Type Modal (ARW & ZIP to JPG/PNG) -->
<div class="modal-overlay" id="convertModal">
    <div class="modal-box" style="max-width: 640px; width: 95%;">
        <div class="modal-header">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:38px; height:38px; border-radius:11px; background:linear-gradient(135deg, rgba(79,70,229,0.18), rgba(99,102,241,0.28)); color:var(--accent); display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 4px 12px rgba(79,70,229,0.15);">
                    🔄
                </div>
                <div>
                    <span class="modal-title" style="display:block; line-height:1.2; font-size:16px;">Convert File Type</span>
                    <span style="font-size:11.5px; color:var(--muted); font-weight:600;">Sony RAW (.ARW), AVIF (.AVIF) & ZIP Converter to PNG / JPG</span>
                </div>
            </div>
            <button class="modal-close" type="button" onclick="closeConvertModal()">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px 24px 24px;">
            <div id="convertSetupView">
                <!-- Drop Zone -->
                <div class="drop-zone" id="convertDropZone" style="border: 2px dashed rgba(79,70,229,0.35); border-radius: 18px; padding: 28px 20px; text-align: center; cursor: pointer; transition: all 0.22s ease; background: rgba(79,70,229,0.02); position:relative;" onclick="document.getElementById('convert-file-input').click()">
                    <div style="font-size: 40px; margin-bottom: 8px; filter: drop-shadow(0 4px 8px rgba(79,70,229,0.2));">📷 ➔ 🖼️</div>
                    <h4 style="margin: 0 0 6px; font-size: 15.5px; font-weight: 800; color: var(--text);">Drop .ARW, .AVIF, or .ZIP files here</h4>
                    <p style="margin: 0; font-size: 12px; color: var(--muted); font-weight: 600;">
                        Accepts Sony RAW (<strong style="color:var(--accent);">.arw</strong>), <strong style="color:var(--accent);">.avif</strong>, or <strong style="color:var(--accent);">.zip</strong> archives containing images
                    </p>
                    <div style="margin-top: 14px; display: flex; gap: 10px; justify-content: center;">
                        <button type="button" class="form-btn btn-primary" style="padding: 9px 20px; font-size: 13px;" onclick="event.stopPropagation(); document.getElementById('convert-file-input').click();">
                            Browse Files
                        </button>
                    </div>
                    <p id="convertFileNotice" style="margin-top: 10px; font-size: 12px; color: var(--accent); font-weight: 700; display: none;"></p>
                </div>
                <input type="file" id="convert-file-input" style="display:none;" accept=".arw,.avif,image/avif,.zip,application/zip,application/x-zip-compressed" multiple onchange="handleConvertFilesSelected(this.files)">

                <!-- Format Selection -->
                <div style="margin-top: 18px;">
                    <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                        <span>Target Output Format</span>
                        <span style="font-size:10.5px; text-transform:none; color:var(--muted); font-weight:600;">Auto-converts Sony RAW & AVIF with Apple ImageIO & GD</span>
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
                        <label id="lblFormatJpg" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border:2px solid var(--accent); background:rgba(79,70,229,0.06); border-radius:14px; cursor:pointer; transition:all 0.18s ease;">
                            <input type="radio" name="convert_target_format" value="jpg" checked onchange="toggleConvertFormat('jpg')" style="width:17px; height:17px; accent-color:var(--accent); cursor:pointer;">
                            <div style="flex:1;">
                                <div style="font-size:13.5px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                                    JPG <span style="font-size:10px; background:rgba(79,70,229,0.14); color:var(--accent); padding:1px 6px; border-radius:4px; font-weight:800;">Popular</span>
                                </div>
                                <div style="font-size:11px; color:var(--muted); font-weight:600; margin-top:2px;">Compact & photo-ready</div>
                            </div>
                        </label>
                        <label id="lblFormatPng" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border:1.5px solid var(--line); background:var(--light); border-radius:14px; cursor:pointer; transition:all 0.18s ease;">
                            <input type="radio" name="convert_target_format" value="png" onchange="toggleConvertFormat('png')" style="width:17px; height:17px; accent-color:var(--accent); cursor:pointer;">
                            <div style="flex:1;">
                                <div style="font-size:13.5px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px;">
                                    PNG <span style="font-size:10px; background:rgba(16,185,129,0.14); color:#059669; padding:1px 6px; border-radius:4px; font-weight:800;">Lossless</span>
                                </div>
                                <div style="font-size:11px; color:var(--muted); font-weight:600; margin-top:2px;">Maximum crisp detail</div>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- JPEG Quality Slider (shown when JPG selected) -->
                <div id="convertJpgQualityWrap" style="margin-top: 14px; padding: 12px 16px; background: var(--light); border: 1.5px solid var(--line); border-radius: 14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                        <label for="convertJpgQualityRange" class="form-label" style="margin:0;">JPEG Quality</label>
                        <span id="convertJpgQualityVal" style="font-size:12px; font-weight:800; color:var(--accent);">100% (Maximum Quality / Same as Original)</span>
                    </div>
                    <input type="range" id="convertJpgQualityRange" min="70" max="100" value="100" step="1" oninput="updateConvertQualityVal(this.value)" style="width:100%; accent-color:var(--accent); cursor:pointer;">
                </div>

                <!-- Destination Options -->
                <div style="margin-top: 14px; display:flex; flex-direction:column; gap:8px;">
                    <label style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(79,70,229,0.04); border:1.5px solid rgba(79,70,229,0.14); border-radius:12px; cursor:pointer;">
                        <input type="checkbox" id="convertSaveToCurrent" checked style="width:17px; height:17px; accent-color:var(--accent); cursor:pointer;">
                        <div style="font-size:12.5px; font-weight:700; color:var(--text);">
                            Save converted images into current folder 
                            <span style="font-size:11px; color:var(--accent); background:rgba(79,70,229,0.12); padding:1px 7px; border-radius:6px; font-weight:700; margin-left:4px;">
                                <?php echo htmlspecialchars($current ? basename($current) : 'Root'); ?>
                            </span>
                        </div>
                    </label>
                </div>

                <!-- Selected Files List Preview -->
                <div id="convertSelectedSummary" style="display:none; margin-top:14px; padding:10px 14px; background:var(--light); border:1.5px solid var(--line); border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; font-weight:700; color:var(--text);" id="convertSelectedCount">0 files ready</span>
                        <button type="button" class="form-btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="clearConvertSelection()">Clear</button>
                    </div>
                    <div id="convertSelectedItemsList" style="max-height:100px; overflow-y:auto; margin-top:6px; font-size:11.5px; color:var(--muted); display:flex; flex-direction:column; gap:4px;"></div>
                </div>

                <div class="btn-row" style="margin-top: 20px; justify-content: flex-end;">
                    <button type="button" class="form-btn btn-secondary" onclick="closeConvertModal()">Cancel</button>
                    <button type="button" class="form-btn btn-primary" id="convertStartBtn" onclick="startConvertProcess()" style="padding: 11px 24px; font-weight:800;">
                        Convert Now ➔
                    </button>
                </div>
            </div>

            <!-- Progress & Activity View (shown while running and on completion) -->
            <div id="convertProgressView" style="display:none;">
                <div style="margin-bottom: 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 8px;">
                        <span id="convertActivityTitle" style="font-size:14px; font-weight:800; color:var(--text);">Converting Files...</span>
                        <span id="convertPercentBadge" style="font-size:14px; font-weight:800; color:var(--accent); font-family:monospace;">0%</span>
                    </div>
                    <div style="width:100%; height:10px; background:var(--line); border-radius:999px; overflow:hidden; position:relative;">
                        <div id="convertProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, #4f46e5, #06b6d4); border-radius:999px; transition:width 0.25s ease;"></div>
                    </div>
                    <div id="convertStatusText" style="font-size:12px; color:var(--muted); font-weight:600; margin-top:8px; display:flex; align-items:center; gap:6px;">
                        <span class="ai-job-spinner" id="convertActiveSpinner"></span>
                        <span id="convertStatusMsg">Initializing conversion...</span>
                    </div>
                </div>

                <!-- Live Activity Feed -->
                <div style="margin-top:14px;">
                    <div style="font-size:11px; font-weight:800; color:var(--muted); text-transform:uppercase; letter-spacing:0.07em; margin-bottom:8px;">
                        Activity Log
                    </div>
                    <div id="convertActivityList" style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; border:1.5px solid var(--line); border-radius:14px; padding:8px; background:var(--light);">
                        <!-- Dynamic items -->
                    </div>
                </div>

                <!-- Completed Actions -->
                <div id="convertDoneActions" style="display:none; margin-top:20px; padding-top:16px; border-top:1px solid var(--line);">
                    <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
                        <button type="button" class="form-btn btn-secondary" onclick="resetConvertModal()">
                            🔄 Convert More Files
                        </button>
                        <a id="convertBundleDownloadBtn" class="form-btn btn-primary" href="#" style="display:none;">
                            📦 Download All as ZIP
                        </a>
                        <button type="button" class="form-btn btn-primary" onclick="location.reload()">
                            📂 View in Folder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Create Folder -->
<div class="modal-overlay" id="folderModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📁 Create Folder</span>
            <button class="modal-close" onclick="closeModal('folderModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="create_folder">
                <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
                <div class="form-group">
                    <label class="form-label">Folder Name</label>
                    <input class="form-input" name="folder_name" placeholder="e.g. product-images" required autofocus>
                </div>
                <div class="btn-row">
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('folderModal')">Cancel</button>
                    <button type="submit" class="form-btn btn-primary">Create →</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Create File -->
<div class="modal-overlay" id="fileModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📝 Create File</span>
            <button class="modal-close" onclick="closeModal('fileModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="create_file">
                <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
                <div class="form-group">
                    <label class="form-label">File Name</label>
                    <input class="form-input" name="file_name" placeholder="e.g. notes.txt or custom.css" required autofocus>
                </div>
                <div class="btn-row">
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('fileModal')">Cancel</button>
                    <button type="submit" class="form-btn btn-primary">Create →</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- All URLs Modal -->
<div class="modal-overlay" id="urlsModal">
    <div class="modal-box" style="max-width:900px; width:95%;">
        <div class="modal-header">
            <span class="modal-title">🔗 All Image URLs</span>
            <button class="modal-close" onclick="closeModal('urlsModal')">✕</button>
        </div>
        <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin-bottom:12px;font-weight:600;">
                <?php echo count($imageUrls); ?> image URL(s) in this folder
            </p>
            <textarea id="allUrlsTextarea" class="url-textarea" readonly style="min-height:200px;"><?php echo htmlspecialchars(implode("\n", $imageUrls)); ?></textarea>
            <div class="btn-row" style="margin-top:14px; flex-wrap:wrap; gap:8px;">
                <button class="form-btn btn-primary" onclick="copyAllUrls()">📋 Copy All URLs as row</button>
                <button class="form-btn btn-primary" onclick="copyAllUrlsHorizontal()">📋 Copy All URLs as horizontal</button>
                <button class="form-btn btn-secondary" onclick="copySelectedUrls()">✅ Copy Selected as row</button>
                <button class="form-btn btn-secondary" onclick="copySelectedUrlsHorizontal()">✅ Copy Selected as horizontal</button>
                <button class="form-btn btn-secondary" onclick="closeModal('urlsModal')">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Resize Image Modal -->
<div class="modal-overlay" id="resizeImageModal">
    <div class="modal-box" style="max-width:620px; width:95%;">
        <div class="modal-header">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="modal-title">📐 Resize & Compress Images</span>
                <span id="resizeSelectedBadge" style="background:rgba(2,132,199,0.12); color:#0284c7; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">0 images</span>
            </div>
            <button class="modal-close" onclick="closeModal('resizeImageModal')">✕</button>
        </div>
        <div class="modal-body">
            <!-- Selected Images Preview Box -->
            <div style="background:var(--light); border:1.5px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:12px; font-weight:700; color:var(--text);" id="resizeSummaryText">Selected Images</span>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="act-btn" onclick="resizeSelectAllImages(true)" style="font-size:11px; padding:3px 8px;">Select All Images</button>
                        <button type="button" class="act-btn" onclick="resizeSelectAllImages(false)" style="font-size:11px; padding:3px 8px;">Clear</button>
                    </div>
                </div>
                <div id="resizeFileList" style="max-height:110px; overflow-y:auto; display:flex; flex-wrap:wrap; gap:6px; padding:4px 0;">
                    <!-- Populated dynamically via JS -->
                </div>
            </div>

            <!-- Mode Tabs -->
            <div style="display:flex; gap:6px; margin-bottom:16px; background:var(--light); padding:4px; border-radius:10px; border:1px solid var(--line);">
                <button type="button" id="tabBtnFilesize" class="form-btn" onclick="switchResizeTab('filesize')" style="flex:1; font-size:12px; font-weight:700; padding:8px 10px; border-radius:7px; background:#0284c7; color:#fff; border:none; cursor:pointer;">
                    🎯 Target File Size
                </button>
                <button type="button" id="tabBtnDimensions" class="form-btn" onclick="switchResizeTab('dimensions')" style="flex:1; font-size:12px; font-weight:700; padding:8px 10px; border-radius:7px; background:transparent; color:var(--muted); border:none; cursor:pointer;">
                    📏 Dimensions (px)
                </button>
                <button type="button" id="tabBtnPercentage" class="form-btn" onclick="switchResizeTab('percentage')" style="flex:1; font-size:12px; font-weight:700; padding:8px 10px; border-radius:7px; background:transparent; color:var(--muted); border:none; cursor:pointer;">
                    📊 Percentage (%)
                </button>
            </div>

            <!-- Tab 1: Target File Size -->
            <div id="tabContentFilesize">
                <div class="form-group" style="margin-bottom:14px;">
                    <label class="form-label" style="display:flex; justify-content:space-between;">
                        <span>Target Maximum File Size</span>
                        <span style="font-size:11px; color:var(--muted); font-weight:500;">e.g., reduce 6 MB to 5 MB</span>
                    </label>
                    <div style="display:flex; gap:10px;">
                        <input type="number" step="0.1" min="0.01" max="500" class="form-input" id="resizeTargetSizeInput" value="5" style="font-size:15px; font-weight:700; flex:1;" placeholder="e.g. 5">
                        <select class="form-input" id="resizeSizeUnitInput" style="width:90px; font-weight:700;">
                            <option value="MB" selected>MB</option>
                            <option value="KB">KB</option>
                        </select>
                    </div>
                </div>
                <!-- Quick Presets -->
                <div style="display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap;">
                    <span style="font-size:11px; color:var(--muted); font-weight:600; align-self:center;">Presets:</span>
                    <button type="button" class="act-btn" onclick="setResizeTarget(5, 'MB')">5 MB</button>
                    <button type="button" class="act-btn" onclick="setResizeTarget(2, 'MB')">2 MB</button>
                    <button type="button" class="act-btn" onclick="setResizeTarget(1, 'MB')">1 MB</button>
                    <button type="button" class="act-btn" onclick="setResizeTarget(500, 'KB')">500 KB</button>
                    <button type="button" class="act-btn" onclick="setResizeTarget(200, 'KB')">200 KB</button>
                </div>
                <div style="font-size:11.5px; color:var(--muted); line-height:1.45; background:rgba(2,132,199,0.06); padding:8px 12px; border-radius:8px; border-left:3px solid #0284c7; margin-bottom:16px;">
                    💡 <strong>Smart Optimization:</strong> The system automatically tunes quality and downscales resolution only if needed to guarantee every image is compressed under your target size while preserving 100% crisp detail.
                </div>
            </div>

            <!-- Tab 2: Custom Dimensions -->
            <div id="tabContentDimensions" style="display:none;">
                <div class="form-group" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
                    <div>
                        <label class="form-label">Max Width (px)</label>
                        <input type="number" min="10" max="10000" class="form-input" id="resizeWidthInput" placeholder="e.g. 1920">
                    </div>
                    <div>
                        <label class="form-label">Max Height (px)</label>
                        <input type="number" min="10" max="10000" class="form-input" id="resizeHeightInput" placeholder="e.g. 1080">
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
                    <input type="checkbox" id="resizeMaintainRatio" checked style="width:16px; height:16px; accent-color:#0284c7;">
                    <label for="resizeMaintainRatio" style="font-size:12px; font-weight:600; color:var(--text); cursor:pointer; margin:0;">Maintain original aspect ratio (Recommended)</label>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap;">
                    <span style="font-size:11px; color:var(--muted); font-weight:600; align-self:center;">Presets:</span>
                    <button type="button" class="act-btn" onclick="setResizeDims(1920, 1080)">1920×1080 (FHD)</button>
                    <button type="button" class="act-btn" onclick="setResizeDims(1200, 1200)">1200×1200 (Square)</button>
                    <button type="button" class="act-btn" onclick="setResizeDims(800, 800)">800×800</button>
                    <button type="button" class="act-btn" onclick="setResizeDims(400, 400)">400×400</button>
                </div>
            </div>

            <!-- Tab 3: Percentage Scale -->
            <div id="tabContentPercentage" style="display:none;">
                <div class="form-group" style="margin-bottom:14px;">
                    <label class="form-label" style="display:flex; justify-content:space-between;">
                        <span>Scale Percentage</span>
                        <span id="resizePercentVal" style="font-weight:700; color:#0284c7;">50%</span>
                    </label>
                    <input type="range" min="10" max="100" step="5" value="50" class="form-input" id="resizePercentRange" style="padding:0; cursor:pointer;" oninput="document.getElementById('resizePercentVal').textContent = this.value + '%'">
                </div>
                <div style="display:flex; gap:6px; margin-bottom:16px;">
                    <button type="button" class="act-btn" onclick="setResizePercent(75)">75%</button>
                    <button type="button" class="act-btn" onclick="setResizePercent(50)">50%</button>
                    <button type="button" class="act-btn" onclick="setResizePercent(25)">25%</button>
                </div>
            </div>

            <!-- Options Grid: Save Mode & Output Format -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; padding-top:14px; border-top:1px solid var(--line);">
                <div>
                    <label class="form-label" style="font-size:11.5px; margin-bottom:6px;">Save Result As</label>
                    <select class="form-input" id="resizeSaveMode" style="font-size:12px;">
                        <option value="replace" selected>Replace original file(s)</option>
                        <option value="copy">Save as copy (_resized)</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" style="font-size:11.5px; margin-bottom:6px;">Output Format</label>
                    <select class="form-input" id="resizeOutputFormat" style="font-size:12px;">
                        <option value="original" selected>Keep original format (PNG, JPG...)</option>
                        <option value="webp">Convert to WebP</option>
                    </select>
                </div>
            </div>

            <!-- Progress Tracker -->
            <div id="resizeProgressWrap" style="display:none; margin-top:16px;">
                <div class="upload-global-track">
                    <div class="upload-global-bar" id="resizeProgressBar" style="background:linear-gradient(90deg,#0284c7,#38bdf8); width:0%;"></div>
                </div>
                <div id="resizeProgressText" style="font-size:11.5px; font-weight:700; color:var(--text); margin-top:6px; text-align:center;">
                    Processing images...
                </div>
                <div id="resizeResultsList" style="max-height:120px; overflow-y:auto; margin-top:8px; font-size:11px; display:flex; flex-direction:column; gap:4px;"></div>
            </div>

            <!-- Action Buttons -->
            <div class="btn-row" style="margin-top:18px;">
                <button type="button" class="form-btn btn-secondary" onclick="closeModal('resizeImageModal')">Cancel</button>
                <button type="button" class="form-btn" id="resizeSubmitBtn" onclick="executeImageResize()" style="background:linear-gradient(135deg,#0284c7,#0369a1); color:#fff; font-weight:700; padding:10px 22px;">
                    📐 Resize Images →
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Move Modal -->
<div class="modal-overlay" id="moveModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">📦 Move Items</span>
            <button class="modal-close" onclick="closeModal('moveModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post" id="moveForm">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="move_selected">
                <div id="moveSelectedInputs"></div>
                <div class="form-group">
                    <label class="form-label">Destination Folder</label>
                    <select class="form-input" name="move_destination" id="moveDestInput" data-loaded="0" disabled autofocus>
                        <option value="">Loading folders...</option>
                    </select>
                    <p style="font-size:11.5px;color:var(--muted);margin-top:6px;font-weight:500;">
                        Choose one of the available folders. Root means the <?php echo $isWebsiteTeam ? "Website-Team" : "main ebay"; ?> folder.
                    </p>
                </div>
                <div class="btn-row">
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('moveModal')">Cancel</button>
                    <button type="submit" class="form-btn btn-primary">Move →</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Delete Confirmation Modal (NO password required) -->
<div class="modal-overlay" id="deletePasswordModal">
    <div class="modal-box" style="max-width:440px;">
        <div class="modal-header">
            <span class="modal-title">🗑️ Confirm Deletion</span>
            <button class="modal-close" onclick="cancelDeletePassword()">✕</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:26px 22px;">
            <div style="width:54px;height:54px;border-radius:50%;background:rgba(239,68,68,0.12);color:#ef4444;font-size:24px;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 14px auto;">
                🗑️
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;">
                Are you sure?
            </div>
            <div style="font-size:13.5px;color:var(--muted);line-height:1.5;margin-bottom:22px;word-break:break-word;" id="deletePasswordMessage">
                Move selected item(s) to trash? You can restore them anytime.
            </div>
            <form id="deletePasswordModalForm" onsubmit="return submitDeletePassword(event)">
                <input type="hidden" id="deletePasswordInput" value="confirmed">
                <div class="btn-row" style="display:flex;gap:10px;justify-content:center;">
                    <button type="button" class="form-btn btn-secondary" style="flex:1;" onclick="cancelDeletePassword()">Cancel</button>
                    <button type="submit" class="form-btn btn-danger" style="flex:1;">Delete →</button>
                </div>
            </form>
        </div>
    </div>
</div>

<?php if ($isAdmin): ?>
<!-- Security Modal -->
<div class="modal-overlay" id="securityModal">
    <div class="modal-box" style="max-width:720px;">
        <div class="modal-header">
            <span class="modal-title">🛡️ Login Security</span>
            <button class="modal-close" onclick="closeModal('securityModal')">✕</button>
        </div>
        <div class="modal-body">
            <p style="font-size:13px;color:var(--muted);margin-bottom:12px;font-weight:600;">
                Devices are banned after <?php echo (int)$MAX_LOGIN_ATTEMPTS; ?> failed login attempts.
            </p>
            <div class="security-list" style="padding:0;">
                <?php if (empty($bannedDevices)): ?>
                    <div class="empty-state" style="padding:26px 12px;">
                        <div class="es-icon">🛡️</div>
                        <h3>No banned devices</h3>
                        <p>Failed login bans will appear here.</p>
                    </div>
                <?php endif; ?>
                <?php foreach ($bannedDevices as $ban): ?>
                    <div class="security-row">
                        <div>
                            <div class="security-name"><?php echo htmlspecialchars($ban["ip"] ?? "Unknown IP"); ?></div>
                            <div class="security-meta">
                                <?php echo htmlspecialchars($ban["reason"] ?? "Failed login attempts"); ?> ·
                                <?php echo date("M d, Y H:i", (int)($ban["banned_at"] ?? time())); ?><br>
                                <?php echo htmlspecialchars($ban["user_agent"] ?? "Unknown device"); ?>
                            </div>
                        </div>
                        <div class="row-actions">
                            <form method="post" class="inline-form">
                                <?php echo csrfField(); ?>
                                <input type="hidden" name="action" value="unban_device">
                                <input type="hidden" name="ban_id" value="<?php echo htmlspecialchars($ban["id"] ?? ""); ?>">
                                <button class="act-btn open" type="submit">Unban</button>
                            </form>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<?php if ($isSuperAdmin): ?>
<!-- Edit User Modal (Super Admin) -->
<div class="modal-overlay" id="editUserModal">
    <div class="modal-box" style="max-width:540px;">
        <div class="modal-header">
            <span class="modal-title">✏️ Edit User Credentials</span>
            <button class="modal-close" onclick="closeModal('editUserModal')">✕</button>
        </div>
        <div class="modal-body">
            <form method="post" id="editUserModalForm">
                <?php echo csrfField(); ?>
                <input type="hidden" name="action" value="admin_edit_user">
                <input type="hidden" name="user_id" id="editUserId" value="">
                
                <div class="form-group">
                    <label class="form-label">👤 Username <span style="font-size:11px;color:var(--muted);font-weight:normal;">(Used to sign in)</span></label>
                    <input class="form-input" id="editUsername" name="edit_username" pattern="[a-z0-9@._-]{3,120}" required title="3-120 lowercase characters: letters, numbers, @, ., _, -">
                    <p style="font-size:11.5px;color:var(--muted);margin:4px 0 0 0;">Must be unique across all users.</p>
                </div>

                <div class="form-group">
                    <label class="form-label">📝 Display Name</label>
                    <input class="form-input" id="editDisplayName" name="edit_display_name" required>
                </div>

                <div class="form-group">
                    <label class="form-label">🔒 Change Password <span style="font-size:11px;color:var(--muted);font-weight:normal;">(Leave blank to keep unchanged)</span></label>
                    <div style="position:relative;">
                        <input class="form-input" id="editPassword" name="edit_password" type="password" minlength="8" placeholder="Enter new password (min 8 chars)" style="padding-right:44px; width:100%; box-sizing:border-box;">
                        <button type="button" class="pw-toggle-btn" onclick="toggleEditUserPassword(event)" tabindex="-1" title="Show password" style="right:8px;">👁️</button>
                    </div>
                </div>

                <div class="form-group" id="editRoleGroup">
                    <label class="form-label">🛡️ Role</label>
                    <select class="form-input" id="editRole" name="edit_role">
                        <option value="staff">Staff</option>
                        <option value="converter">Converter</option>
                        <option value="website_team">Website Team</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <div class="btn-row" style="margin-top:18px;">
                    <button type="button" class="form-btn btn-secondary" onclick="closeModal('editUserModal')">Cancel</button>
                    <button type="submit" class="form-btn btn-primary">Save Changes →</button>
                </div>
            </form>
        </div>
    </div>
</div>
<?php endif; ?>
<?php if ($FEATURES_ENABLED): ?>

<!-- ===== FEATURE MODALS ===== -->

<!-- AI Background Remove Modal -->
<div class="modal-overlay" id="aiModal">
    <div class="modal-box" style="max-width:680px;">
        <div class="modal-header">
            <span class="modal-title">✨ AI Background Removal</span>
            <button class="modal-close" onclick="closeModal('aiModal')">✕</button>
        </div>
        <div class="modal-body">
            <div id="aiSelectedInfo" style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:14px;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="form-group">
                    <label class="form-label">Output Type</label>
                    <select class="form-input" id="aiOutputType">
                        <option value="transparent">Transparent PNG</option>
                        <option value="white">White Background</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Output Format</label>
                    <select class="form-input" id="aiOutputFormat">
                        <option value="webp" selected>WebP</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Output Size</label>
                    <select class="form-input" id="aiOutputSize">
                        <option value="">Original Size</option>
                        <option value="1280x1280">1280x1280px</option>
                        <option value="1920x1080">1920x1080px</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Output Folder</label>
                <select class="form-input" id="aiOutputFolder">
                    <option value="">(Current Directory)</option>
                    <?php foreach ($items as $item): if ($item['is_dir']): ?>
                        <option value="<?php echo htmlspecialchars($item['name']); ?>"><?php echo htmlspecialchars($item['name']); ?></option>
                    <?php endif; endforeach; ?>
                </select>
            </div>
            <label style="display:flex; align-items:center; gap:8px; margin-top:12px; cursor:pointer;">
                <input type="checkbox" id="aiKeepOrigName" style="width:16px; height:16px; cursor:pointer;" checked>
                <span style="font-size:14px; font-weight:600; color:var(--text);">Replace original image (delete original)</span>
            </label>
            
            <label style="display:flex; align-items:center; gap:8px; margin-top:12px; cursor:pointer;">
                <input type="checkbox" id="aiReviewCanvas" style="width:16px; height:16px; cursor:pointer;" checked>
                <span style="font-size:14px; font-weight:600; color:var(--text);">Review in Canva Editor after processing</span>
            </label>

            <div id="aiQueue" style="margin-top:14px;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
            <div class="btn-row" style="margin-top:18px;">
                <button class="form-btn btn-primary" id="aiStartBtn" onclick="aiStartProcessing()">🪄 Remove BG</button>
                <button class="form-btn btn-secondary" id="aiCancelBtn" style="display:none;" onclick="aiCancelAll()">✕ Cancel</button>
                <button class="form-btn btn-secondary" id="aiDownloadBtn" style="display:none;" onclick="aiDownloadZip()">⬇ Download ZIP</button>
                <button class="form-btn btn-secondary" onclick="closeModal('aiModal')">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- AI Editor Modal -->
<div class="modal-overlay" id="aiEditorModal">
    <div class="modal-box" style="max-width:800px; width:95%; display:flex; flex-direction:column;">
        <div class="modal-header">
            <span class="modal-title">🎨 AI Canvas Editor <span id="aiEditorTitleInfo" style="font-size:12px;color:var(--muted);font-weight:normal;margin-left:10px;"></span></span>
            <button class="modal-close" onclick="closeModal('aiEditorModal')">✕</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; gap:12px; justify-content:space-between; align-items:center; flex-wrap:wrap; width:100%;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin:0;">Size:</label>
                    <select class="form-input" id="aiEditorCanvasSize" onchange="aiEditorChangeSize()" style="width:140px; padding:6px 10px;">
                        <option value="1280x1280">1280x1280px</option>
                        <option value="1920x1080">1920x1080px</option>
                    </select>
                </div>
                <div>
                    <button class="form-btn" id="aiEditorRemoveBgBtn" onclick="aiEditorRemoveBg()" style="padding:6px 14px; font-size:13px; font-weight:600; display:none; background:#fff; color:#1e293b; border:1px solid #e2e8f0; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05); cursor:pointer;">🪄 Remove BG</button>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin:0;">Background:</label>
                    <select class="form-input" id="aiEditorBgType" onchange="aiEditorDraw()" style="width:140px; padding:6px 10px;">
                        <option value="transparent">Transparent</option>
                        <option value="white">White</option>
                    </select>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin:0;">Zoom:</label>
                    <button class="form-btn btn-secondary" onclick="aiEditorZoomOut()" style="padding:4px 8px; font-size:14px;">-</button>
                    <input type="range" id="aiEditorZoom" min="0.1" max="4" step="0.01" value="1" oninput="aiEditorZoomChange()" style="width:100px;">
                    <button class="form-btn btn-secondary" onclick="aiEditorZoomIn()" style="padding:4px 8px; font-size:14px;">+</button>
                    <span id="aiEditorZoomLabel" style="width:40px; font-size:13px; font-weight:600;">100%</span>
                    <button class="form-btn btn-secondary" onclick="aiEditorReset()" style="padding:6px 12px; font-size:12px;">Reset</button>
                </div>
            </div>
            
            <div style="width:100%; display:flex; justify-content:center; background: #e5e7eb; border-radius: 12px; padding:10px; border: 2px dashed var(--line);">
                <div id="aiEditorCanvasWrapper" style="position:relative; width:100%; max-width:500px; aspect-ratio:1/1; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius:4px; overflow:hidden;">
                    <!-- Checkered background for transparent preview -->
                    <div style="position:absolute; inset:0; background-image: linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; z-index:1;"></div>
                    <canvas id="aiEditorCanvas" width="1280" height="1280" style="position:absolute; inset:0; width:100%; height:100%; z-index:2; cursor:grab;"></canvas>
                </div>
            </div>
            
            <div class="btn-row" style="justify-content:flex-end; margin-top:4px;">
                <button class="form-btn btn-secondary" onclick="aiEditorSkip()">⏭️ Skip</button>
                <button class="form-btn btn-primary" id="aiEditorSaveBtn" onclick="aiEditorSave()">💾 Save & Continue</button>
            </div>
        </div>
    </div>
</div>

<!-- Duplicate Finder Modal -->
<div class="modal-overlay" id="duplicateModal">
    <div class="modal-box" style="max-width:760px;">
        <div class="modal-header">
            <span class="modal-title">🔍 Duplicate Finder</span>

        </div>
        <div class="modal-body">
            <div style="display:flex;gap:16px;flex-wrap:nowrap;margin-bottom:14px;align-items:center;">
                <select class="form-input" id="dupScope" style="min-width:150px;">
                    <option value="all">Entire Library</option>
                    <option value="current">Current Folder</option>
                </select>
                <div style="display:flex;gap:16px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;cursor:pointer;">
                        <input type="checkbox" id="dupByName" checked> Same name
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:700;cursor:pointer;">
                        <input type="checkbox" id="dupBySize"> Same size
                    </label>
                </div>
                <button class="form-btn btn-primary" onclick="runDuplicateScan()">🔍 Scan</button>
            </div>
            <div id="dupStatus" style="font-size:12px;color:var(--muted);font-weight:600;margin-bottom:10px;"></div>
            <div id="dupResults" style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:12px;"></div>
        </div>
    </div>
</div>

<!-- Replace Image Modal -->
<div class="modal-overlay" id="replaceModal">
    <div class="modal-box">
        <div class="modal-header">
            <span class="modal-title">🔄 Replace Image</span>
            <button class="modal-close" onclick="closeModal('replaceModal')">✕</button>
        </div>
        <div class="modal-body">
            <div class="delete-warning-card" style="background:rgba(79,70,229,0.08);border-color:rgba(79,70,229,0.2);">
                <div class="delete-warning-icon" style="background:rgba(79,70,229,0.12);color:var(--accent);">🔄</div>
                <div>
                    <div class="delete-warning-title">Safe Image Replacement</div>
                    <div class="delete-warning-text">The existing image will be saved as a version. The URL stays exactly the same.</div>
                </div>
            </div>
            <div id="replaceTargetInfo" style="font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:14px;"></div>
            <div class="form-group">
                <label class="form-label">New Image File</label>
                <input type="file" class="form-input" id="replaceFileInput" accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/*">
            </div>
            <div class="btn-row">
                <button class="form-btn btn-secondary" onclick="closeModal('replaceModal')">Cancel</button>
                <button class="form-btn btn-primary" onclick="submitReplaceImage()">🔄 Replace →</button>
            </div>
        </div>
    </div>
</div>

<!-- Version History Modal -->
<div class="modal-overlay" id="versionModal">
    <div class="modal-box" style="max-width:680px;">
        <div class="modal-header">
            <span class="modal-title">🕐 Version History</span>
            <button class="modal-close" onclick="closeModal('versionModal')">✕</button>
        </div>
        <div class="modal-body">
            <div id="versionFileName" style="font-size:12.5px;color:var(--muted);font-weight:700;margin-bottom:14px;"></div>
            <div id="versionList" style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;"></div>
            <div class="btn-row" style="margin-top:14px;">
                <button class="form-btn btn-secondary" onclick="closeModal('versionModal')">Close</button>
            </div>
        </div>
    </div>
</div>

<!-- Properties Modal -->
<div class="modal-overlay" id="propertiesModal">
    <div class="modal-box" style="max-width:600px;">
        <div class="modal-header">
            <span class="modal-title">ℹ️ Properties</span>
            <button class="modal-close" onclick="closeModal('propertiesModal')">✕</button>
        </div>
        <div class="modal-body">
            <div id="propertiesContent">
                <div style="text-align:center;padding:30px 0;color:var(--muted);">Loading properties…</div>
            </div>
        </div>
    </div>
</div>

<!-- Context Menu -->
<div id="contextMenu" class="ctx-menu" style="display:none;">
    <div class="ctx-item" id="ctx-rename">✏️ Rename</div>
    <div class="ctx-item" id="ctx-rename-type">🏷️ Rename Type</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-play-video" style="display:none; color:#ec4899; font-weight:700;">▶ Play Video</div>
    <div class="ctx-item" id="ctx-copy-video-url" style="display:none;">🔗 Copy Video URL</div>
    <div class="ctx-item" id="ctx-copy-video-embed" style="display:none;">&lt;/&gt; Copy Video Embed</div>
    <div class="ctx-item" id="ctx-replace" style="display:none;">🔄 Replace</div>
    <div class="ctx-item" id="ctx-canva-edit" style="display:none; color:#4f46e5; font-weight:700;">🎨 Canva Edit</div>
    <div class="ctx-sep ctx-sep-img" style="display:none;"></div>
    <div class="ctx-item" id="ctx-download">⬇ Download</div>
    <div class="ctx-item" id="ctx-copy">📄 Copy</div>
    <div class="ctx-item" id="ctx-move">📦 Move</div>
    <div class="ctx-item" id="ctx-paste">📋 Paste</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-color" style="display:none;">
        🎨 Folder Color
        <div class="ctx-submenu ctx-color-picker">
            <span class="ctx-color-opt" data-color="" title="None" style="background:#cbd5e1;border:2px solid #94a3b8;"></span>
            <span class="ctx-color-opt" data-color="blue"   title="Blue"   style="background:var(--fc-blue);"></span>
            <span class="ctx-color-opt" data-color="green"  title="Green"  style="background:var(--fc-green);"></span>
            <span class="ctx-color-opt" data-color="yellow" title="Yellow" style="background:var(--fc-yellow);"></span>
            <span class="ctx-color-opt" data-color="red"    title="Red"    style="background:var(--fc-red);"></span>
            <span class="ctx-color-opt" data-color="purple" title="Purple" style="background:var(--fc-purple);"></span>
            <span class="ctx-color-opt" data-color="orange" title="Orange" style="background:var(--fc-orange);"></span>
        </div>
    </div>
    <div class="ctx-item" id="ctx-pin" style="display:none;">📌 Pin / Unpin</div>
    <div class="ctx-item" id="ctx-pin-sidebar" style="display:none;">📌 Pin to Sidebar</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" id="ctx-properties">ℹ️ Properties</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item ctx-danger" id="ctx-delete">🗑️ Delete</div>
</div>

<?php endif; ?>

<!-- Edit File Modal -->
<?php if ($editFile): ?>
<?php
    $editExt = strtolower(pathinfo($editFile, PATHINFO_EXTENSION));
    $langLabels = [
        'html' => 'HTML5',
        'htm'  => 'HTML5',
        'css'  => 'CSS3',
        'js'   => 'JavaScript',
        'json' => 'JSON',
        'php'  => 'PHP',
        'sql'  => 'SQL',
        'xml'  => 'XML',
        'svg'  => 'SVG XML',
        'txt'  => 'Plain Text',
        'md'   => 'Markdown'
    ];
    $langName = $langLabels[$editExt] ?? strtoupper($editExt ?: 'CODE');
    $fileIcon = in_array($editExt, ['html', 'htm']) ? '🌐' : (in_array($editExt, ['css']) ? '🎨' : (in_array($editExt, ['js', 'json']) ? '⚡' : (in_array($editExt, ['php']) ? '🐘' : '📝')));
    $contentLength = strlen($editContent);
    $contentLines = substr_count($editContent, "\n") + 1;
?>
<div class="modal-overlay open code-editor-overlay" id="editModal">
    <div class="modal-box code-editor-modal" id="codeEditorModalBox">
        <div class="code-editor-header">
            <div class="code-editor-title-wrap">
                <span class="code-file-icon"><?php echo $fileIcon; ?></span>
                <span class="code-file-name" title="<?php echo htmlspecialchars($editFile); ?>"><?php echo htmlspecialchars($editFile); ?></span>
                <span class="code-badge-lang"><?php echo htmlspecialchars($langName); ?></span>
                <span class="code-badge-size hide-mobile"><?php echo formatSize($contentLength); ?></span>
            </div>
            <div class="code-editor-tools">
                <button type="button" class="code-tool-btn" id="codeWrapToggle" onclick="toggleCodeWrap()" title="Toggle word wrap">
                    <span id="codeWrapIcon">↩</span> <span id="codeWrapText" class="hide-mobile">Wrap: On</span>
                </button>
                <div class="code-font-adjust hide-mobile">
                    <button type="button" class="code-tool-btn" onclick="adjustCodeFontSize(-1)" title="Decrease font size">A−</button>
                    <button type="button" class="code-tool-btn" onclick="adjustCodeFontSize(1)" title="Increase font size">A+</button>
                </div>
                <button type="button" class="code-tool-btn" onclick="copyEditorCode()" title="Copy all code">
                    <span>📋</span> <span class="hide-mobile">Copy</span>
                </button>
                <button type="button" class="code-tool-btn" id="codeFullscreenBtn" onclick="toggleCodeFullscreen()" title="Toggle Fullscreen">
                    <span id="codeFullscreenIcon">⛶</span>
                </button>
                <a class="code-tool-close" href="<?php echo $pageUrl . "?path=" . urlencode($current); ?>" title="Close editor">✕</a>
            </div>
        </div>

        <form method="post" id="codeEditorForm" style="display:flex; flex-direction:column; flex:1; min-height:0;">
            <?php echo csrfField(); ?>
            <input type="hidden" name="action" value="edit_file">
            <input type="hidden" name="edit_file_name" value="<?php echo htmlspecialchars($editFile); ?>">

            <div class="code-workspace" id="codeWorkspace">
                <div class="code-gutter" id="codeGutter" aria-hidden="true"></div>
                <textarea class="code-textarea" id="codeEditorTextarea" name="edit_file_content" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="Write code here..."><?php echo htmlspecialchars($editContent); ?></textarea>
            </div>

            <div class="code-editor-statusbar">
                <div class="code-status-left">
                    <span id="codeCursorPos">Ln 1, Col 1</span>
                    <span class="code-status-sep">·</span>
                    <span id="codeTotalLines"><?php echo $contentLines; ?> lines</span>
                    <span class="code-status-sep hide-mobile">·</span>
                    <span id="codeCharCount" class="hide-mobile"><?php echo number_format($contentLength); ?> chars</span>
                    <span class="code-status-sep hide-mobile">·</span>
                    <span class="hide-mobile">UTF-8</span>
                </div>
                <div class="code-status-right hide-mobile">
                    <span class="code-key-hint"><kbd>⌘S</kbd> / <kbd>Ctrl+S</kbd> to save</span>
                </div>
            </div>

            <div class="code-editor-footer">
                <a class="form-btn btn-secondary" href="<?php echo $pageUrl . "?path=" . urlencode($current); ?>">Cancel</a>
                <button type="submit" class="form-btn btn-primary" id="saveCodeBtn">💾 Save File</button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<!-- Delete selected form -->
<form method="post" id="deleteSelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="delete_selected">
    <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
    <div id="deleteSelectedInputs"></div>
</form>

<form method="post" id="copySelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="copy_selected">
    <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
    <div id="copySelectedInputs"></div>
</form>

<form method="post" id="downloadSelectedForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="download_selected">
    <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
    <div id="downloadSelectedInputs"></div>
</form>

<form method="post" id="pasteClipboardForm">
    <?php echo csrfField(); ?>
    <input type="hidden" name="action" value="paste_clipboard">
    <input type="hidden" name="path" value="<?php echo htmlspecialchars($current); ?>">
</form>

<!-- ===== VIDEO MODAL ===== -->
<div class="modal-overlay" id="videoModal">
    <div class="modal-box video-player-box" style="max-width: 860px; width: 95%; background: #0b1120; color: #f8fafc; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 35px 70px rgba(0,0,0,0.6);">
        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 18px 24px;">
            <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                <span style="font-size:18px;">🎬</span>
                <span class="modal-title" id="videoModalTitle" style="color:#f8fafc; font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Video Player</span>
                <span id="videoModalBadge" style="background:rgba(236,72,153,0.25); color:#f472b6; font-size:11px; font-weight:800; padding:2px 8px; border-radius:6px; text-transform:uppercase;">MP4</span>
            </div>
            <button class="modal-close" type="button" onclick="closeVideoModal()" style="color:#94a3b8; border-color:rgba(255,255,255,0.18);" title="Close">✕</button>
        </div>
        <div class="modal-body" style="padding: 20px 24px 24px; display:flex; flex-direction:column; gap:16px;">
            <div class="video-container" style="position:relative; width:100%; border-radius:16px; overflow:hidden; background:#000; box-shadow:0 12px 32px rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; min-height:260px; max-height:68vh;">
                <video id="videoPlayerElem" controls playsinline preload="metadata" style="width:100%; height:auto; max-height:68vh; outline:none; display:block;">
                    Your browser does not support HTML5 video streaming.
                </video>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="font-size:12px; color:#94a3b8;" id="videoModalMeta">
                    Keep original video size · Direct stream
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="form-btn btn-secondary" id="videoCopyUrlBtn" onclick="copyVideoUrl()" style="font-size:12.5px; padding:8px 14px; background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.15);">
                        📋 Copy URL
                    </button>
                    <button type="button" class="form-btn btn-secondary" id="videoCopyEmbedBtn" onclick="copyVideoEmbed()" style="font-size:12.5px; padding:8px 14px; background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.15);">
                        &lt;/&gt; Copy Embed
                    </button>
                    <a id="videoDownloadBtn" href="#" download class="form-btn btn-primary" style="font-size:12.5px; padding:8px 16px; text-decoration:none;">
                        ⬇ Download
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ===== LIGHTBOX ===== -->
<div class="lightbox" id="lightbox" tabindex="-1" role="dialog" aria-modal="true" onclick="if(event.target===this||event.target.id==='lbImgWrap')closeLightbox()">
    <button type="button" class="lb-close" id="lbCloseBtn" onclick="closeLightbox()" title="Close Preview (Esc)" aria-label="Close Preview">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span class="lb-close-text">Close</span>
    </button>
    <button type="button" class="lb-nav lb-prev" id="lbPrev" onclick="lbNavigate(-1)" title="Previous (←)">‹</button>
    <button type="button" class="lb-nav lb-next" id="lbNext" onclick="lbNavigate(1)" title="Next (→)">›</button>

    <div class="lightbox-img-wrap" id="lbImgWrap">
        <div class="lb-spinner" id="lbSpinner" style="display:none;">
            <div class="lb-spinner-ring"></div>
        </div>
        <img id="lbImg" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" draggable="false" style="opacity:0;">
    </div>

    <!-- Floating Zoom Controls Toolbar -->
    <div class="lb-toolbar" id="lbToolbar" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()">
        <button type="button" class="lb-tool-btn" id="lbZoomOutBtn" onclick="lbZoomOut()" title="Zoom Out (-)">−</button>
        <span class="lb-zoom-badge" id="lbZoomBadge" onclick="lbResetZoom(true)" title="Click to reset zoom (100%)">100%</span>
        <button type="button" class="lb-tool-btn" id="lbZoomInBtn" onclick="lbZoomIn()" title="Zoom In (+)">+</button>
        <button type="button" class="lb-tool-btn" id="lbActualSizeBtn" onclick="lbToggleActualSize()" title="Actual Size (1:1)">1:1</button>
        <button type="button" class="lb-tool-btn" id="lbResetBtn" onclick="lbResetZoom(true)" title="Fit Screen (↺)">↺</button>
    </div>
    <div class="lb-info">
        <div>
            <div class="lb-name" id="lbName"></div>
            <div class="lb-counter" id="lbCounter"></div>
        </div>
        <button class="lb-copy-btn" id="lbCopyBtn" onclick="lbCopyUrl()">📋 Copy URL</button>
    </div>
</div>

