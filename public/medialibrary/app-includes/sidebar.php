<div class="layout">

    <!-- SIDEBAR -->
    <aside class="sidebar" id="mainSidebar">
        <div class="sidebar-section">Actions</div>

        <?php
        $isHomeActive = ($current === '' && !$trashMode && !$profileMode && !$activityMode && !$usersMode && !$settingsMode);
        ?>
        <a class="sidebar-btn <?php echo $isHomeActive ? 'active' : ''; ?>" href="<?php echo $homeUrl; ?>" data-tooltip="Home" data-nav-key="home">
            <span class="sb-icon sb-icon-home">🏠</span>
            <span class="sb-label">Home</span>
        </a>
        <button class="sidebar-btn" type="button" onclick="openConvertModal()" id="sidebarConvertBtn" data-tooltip="Convert File Type" title="Convert Sony ARW RAW, AVIF & ZIP to JPG or PNG" data-nav-key="convert">
            <span class="sb-icon sb-icon-convert">🔄</span>
            <span class="sb-label">Convert File Type</span>
        </button>
        <?php if (!$isConverter): ?>
        <a class="sidebar-btn sb-delete <?php echo $trashMode ? 'active' : ''; ?>" href="<?php echo $pageUrl; ?>?trash=1" data-tooltip="Trash Bin" data-nav-key="trash">
            <span class="sb-icon sb-icon-trash sb-icon-img"><img src="https://cdn-icons-png.flaticon.com/512/9790/9790368.png" alt="Trash icon"></span>
            <span class="sb-label">Trash Bin</span>
        </a>
        <?php endif; ?>

        <?php if ($FEATURES_ENABLED && !$isConverter): ?>
            <div class="sidebar-divider"></div>
            <div class="sidebar-section">Pin Folder</div>
            <?php if (empty($sidebarPins)): ?>
                <div class="sidebar-no-pins" style="font-size:11px;color:var(--muted);padding:6px 12px;font-style:italic;">No pinned items yet</div>
            <?php else: ?>
                <?php
                $pinColorVarsMap = [
                    'blue'   => ['#2563eb','rgba(37,99,235,0.12)'],
                    'green'  => ['#059669','rgba(5,150,105,0.12)'],
                    'yellow' => ['#d97706','rgba(217,119,6,0.12)'],
                    'red'    => ['#dc2626','rgba(220,38,38,0.12)'],
                    'purple' => ['#7c3aed','rgba(124,58,237,0.12)'],
                    'orange' => ['#ea580c','rgba(234,88,12,0.12)'],
                ];
                foreach ($sidebarPins as $pin):
                    $pinPath = $pin['path'];
                    $pinIsDir = (bool)($pin['is_dir'] ?? false);
                    $pinName = basename($pinPath);
                    $pinColor = $pinIsDir ? ($sidebarFolderColors[$pinPath] ?? '') : '';
                    $parent = dirname($pinPath);
                    if ($parent === '.') $parent = '';
                    $pinExt = strtolower(pathinfo($pinName, PATHINFO_EXTENSION));
                    $pinIsImg = in_array($pinExt, ['jpg','jpeg','png','webp','gif','svg','avif'], true);
                    $isThisPinActive = ($current !== '' && $current === $pinPath);
                    if ($pinIsDir) {
                        $pinHref = $pageUrl . '?path=' . urlencode($pinPath);
                        $pinColorClass = 'sb-folder';
                    } else {
                        $pinHref = publicUrl($BASE_URL, $pinPath);
                        $pinColorClass = 'sb-file';
                    }
                    $iconStyle = '';
                    if ($pinColor && isset($pinColorVarsMap[$pinColor])) {
                        $iconStyle = 'color:' . $pinColorVarsMap[$pinColor][0] . ';background:' . $pinColorVarsMap[$pinColor][1] . ';';
                    }
                ?>
                <div class="sidebar-btn <?php echo $pinColorClass; ?> <?php echo $isThisPinActive ? 'active' : ''; ?>" role="link" tabindex="0"
                    style="cursor:pointer;"
                    data-tooltip="<?php echo htmlspecialchars($pinName); ?>"
                    data-href="<?php echo htmlspecialchars($pinHref); ?>"
                    data-target="<?php echo !$pinIsDir ? '_blank' : ''; ?>"
                    data-name="<?php echo htmlspecialchars($pinName); ?>"
                    data-url="<?php echo htmlspecialchars(publicUrl($BASE_URL, $pinPath)); ?>"
                    data-open-url="<?php echo htmlspecialchars($pinHref); ?>"
                    data-rel="<?php echo htmlspecialchars($pinPath); ?>"
                    data-is-img="<?php echo $pinIsImg ? '1' : '0'; ?>"
                    data-is-dir="<?php echo $pinIsDir ? '1' : '0'; ?>"
                    data-folder-rel="<?php echo $pinIsDir ? htmlspecialchars($pinPath) : ''; ?>"
                    data-folder-color="<?php echo htmlspecialchars($pinColor); ?>"
                    data-parent-path="<?php echo htmlspecialchars($parent); ?>"
                    data-nav-path="<?php echo htmlspecialchars($pinPath); ?>"
                    id="sb_pin_<?php echo md5($pinPath); ?>"
                    onclick="(function(el){var href=el.dataset.href;var tgt=el.dataset.target;if(tgt==='_blank')window.open(href,'_blank');else if(typeof navigateToFolder==='function'&&el.dataset.isDir==='1')navigateToFolder(href);else location.href=href;})(this)"
                    oncontextmenu="showContextMenu(event,this);return false;">
                    <span class="sb-icon <?php echo $pinIsDir ? 'sb-icon-folder' : 'sb-icon-file'; ?>"
                        <?php echo $pinColor ? 'data-folder-color="' . htmlspecialchars($pinColor) . '"' : ''; ?>
                        <?php echo $iconStyle ? 'style="' . $iconStyle . '"' : ''; ?>>
                        <?php echo getFileIcon($pinName, $pinIsDir); ?>
                    </span>
                    <span class="sb-label"><?php echo htmlspecialchars($pinName); ?></span>
                </div>
                <?php endforeach; ?>
            <?php endif; ?>
        <?php endif; ?>

        <?php if (!$isConverter): ?>
            <div class="sidebar-divider"></div>
            <div class="sidebar-section">Account</div>
            <a class="sidebar-btn <?php echo $profileMode ? 'active' : ''; ?>" href="<?php echo $pageUrl; ?>?profile=1" data-tooltip="Profile" data-nav-key="profile">
                <span class="sb-icon sb-icon-profile">👤</span>
                <span class="sb-label">Profile</span>
            </a>
            <?php if (!$isWebsiteTeam && (($currentUser["can_view_login_activity"] ?? true) || $isAdmin)): ?>
            <a class="sidebar-btn <?php echo $activityMode ? 'active' : ''; ?>" href="<?php echo $pageUrl; ?>?activity=1" data-tooltip="Login Activity" data-nav-key="activity">
                <span class="sb-icon sb-icon-activity">🧾</span>
                <span class="sb-label">Login Activity</span>
            </a>
            <?php endif; ?>
            <?php if ($isAdmin): ?>
            <a class="sidebar-btn <?php echo $usersMode ? 'active' : ''; ?>" href="<?php echo $pageUrl; ?>?users=1" data-tooltip="Users" data-nav-key="users">
                <span class="sb-icon sb-icon-users">👥</span>
                <span class="sb-label">Users</span>
            </a>
            <a class="sidebar-btn <?php echo $settingsMode ? 'active' : ''; ?>" href="<?php echo $pageUrl; ?>?settings=1" data-tooltip="Admin Settings" data-nav-key="settings">
                <span class="sb-icon sb-icon-settings">⚙️</span>
                <span class="sb-label">Admin Settings</span>
            </a>
            <button class="sidebar-btn" onclick="openModal('securityModal')" data-tooltip="Security" data-nav-key="security">
                <span class="sb-icon sb-icon-security">🛡️</span>
                <span class="sb-label">Security</span>
            </button>
            <?php endif; ?>

            <div class="sidebar-divider"></div>
            <div class="sidebar-baseurl-expanded">
                <div class="sidebar-section" style="padding-top:4px;">Base URL</div>
                <div style="padding:0 10px 8px;">
                    <input class="url-input sidebar-baseurl-input" value="<?php echo htmlspecialchars($visibleBaseUrl); ?>" readonly onclick="this.select(); navigator.clipboard.writeText(this.value); toast('Base URL copied!');" title="Click to copy Base URL">
                </div>
            </div>
            <button type="button" class="sidebar-btn sidebar-baseurl-collapsed-btn" data-tooltip="Copy Base URL" onclick="navigator.clipboard.writeText(<?php echo json_encode($visibleBaseUrl); ?>); toast('Base URL copied!');" title="Copy Base URL">
                <span class="sb-icon">📋</span>
                <span class="sb-label">Copy Base URL</span>
            </button>
        <?php endif; ?>

        <div class="sidebar-logout-wrap">
            <a class="sidebar-btn sidebar-btn-logout" href="?logout=1" data-tooltip="Logout">
                <span class="sb-icon sb-icon-img"><img src="https://cdn-icons-png.flaticon.com/512/4400/4400828.png" alt="Logout icon"></span>
                <span class="sb-label">Logout</span>
            </a>
        </div>
    </aside>
