<?php
$cmsDashboardUrl = function_exists('getCmsBaseUrl') ? getCmsBaseUrl() : '/ourcmskiuq';
$liveSiteUrl = function_exists('getCmsLiveSiteUrl') ? getCmsLiveSiteUrl() : '/';
$dashboardLogoUrl = $APP_ASSETS_URL . '/images/header-logo.webp';
$dashboardLogoFallback = $APP_ASSETS_URL . '/images/logo.png';
?>
<header class="topbar">
    <button class="mobile-menu-btn" type="button" onclick="toggleSidebar(true)" title="Menu">☰</button>
    <button class="sidebar-collapse-btn" id="sidebarCollapseBtn" type="button" onclick="toggleSidebarCollapse()" title="Toggle Sidebar" data-tooltip="Toggle Sidebar" aria-label="Toggle Sidebar">
        <svg class="scb-icon scb-icon-collapse" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="M15 9l-3 3 3 3"></path></svg>
        <svg class="scb-icon scb-icon-expand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><path d="M13 15l3-3-3-3"></path></svg>
    </button>

    <a class="topbar-brand cms-kiuq-brand" href="<?php echo $homeUrl; ?>" title="Happy Machinery Asset & Media Library">
        <img src="<?php echo htmlspecialchars($dashboardLogoUrl); ?>"
             alt="Happy Machinery"
             class="topbar-logo-img"
             onerror="this.onerror=null; this.src='<?php echo htmlspecialchars($dashboardLogoFallback); ?>';">
        <div class="cms-kiuq-brand-info">
            <span class="cms-kiuq-brand-name">Happy Machinery</span>
            <span class="cms-kiuq-brand-tag">Asset &amp; Media Library</span>
        </div>
    </a>

    <div class="topbar-end">
        <a href="<?php echo htmlspecialchars($cmsDashboardUrl); ?>" class="cms-kiuq-cms-btn" title="Return to CMS Dashboard">
            &lt; CMS
        </a>
        <a href="<?php echo htmlspecialchars($liveSiteUrl); ?>" target="_blank" rel="noreferrer" class="cms-kiuq-cms-btn" title="Open live website in new tab">
            Live Site ↗
        </a>
        <button type="button" class="cms-kiuq-cms-btn" onclick="toggleMediaFullscreen()" id="topbarFullscreenBtn" title="Toggle Fullscreen">
            Fullscreen
        </button>

        <div class="theme-switch" id="themeToggleBtn" onclick="toggleTheme()" title="Toggle Dark/Light Mode">
            <div class="ts-thumb"></div>
            <span class="ts-icon sun">☀️</span>
            <span class="ts-icon moon">🌙</span>
        </div>

        <?php if (!$isConverter): ?>
        <div class="profile-dropdown-wrap" id="profileDropdownWrap">
            <button class="profile-chip" id="profileChipBtn" type="button" onclick="toggleProfileDropdown(event)" aria-haspopup="true" aria-expanded="false" title="Account Menu">
                <span class="avatar-small">
                    <?php if (!empty($currentUser["avatar_url"])): ?><img src="<?php echo htmlspecialchars($currentUser["avatar_url"]); ?>" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"><?php else: ?><?php echo htmlspecialchars(userInitials($currentUser)); ?><?php endif; ?>
                </span>
                <span class="profile-chip-name"><?php echo htmlspecialchars($currentUser["display_name"] ?? $currentUser["username"]); ?></span>
                <span class="profile-chevron">▾</span>
            </button>
            <div class="profile-dropdown-menu" id="profileDropdownMenu" onclick="event.stopPropagation()">
                <div class="pdm-header">
                    <span class="avatar-medium">
                        <?php if (!empty($currentUser["avatar_url"])): ?><img src="<?php echo htmlspecialchars($currentUser["avatar_url"]); ?>" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"><?php else: ?><?php echo htmlspecialchars(userInitials($currentUser)); ?><?php endif; ?>
                    </span>
                    <div class="pdm-user-details">
                        <div class="pdm-name"><?php echo htmlspecialchars($currentUser["display_name"] ?? $currentUser["username"]); ?></div>
                        <div class="pdm-sub">@<?php echo htmlspecialchars($currentUser["username"] ?? "user"); ?> · <span class="pdm-role-badge"><?php echo $isAdmin ? 'Admin' : ($isWebsiteTeam ? 'Website Team' : ($isConverter ? 'Converter' : 'Staff')); ?></span></div>
                    </div>
                </div>
                <div class="pdm-divider"></div>
                <a class="pdm-item" href="<?php echo $pageUrl; ?>?profile=1">
                    <span class="pdm-icon">👤</span> Profile Settings
                </a>
                <?php if (!$isWebsiteTeam && (($currentUser["can_view_login_activity"] ?? true) || $isAdmin)): ?>
                <a class="pdm-item" href="<?php echo $pageUrl; ?>?activity=1">
                    <span class="pdm-icon">🧾</span> Login Activity
                </a>
                <?php endif; ?>
                <?php if ($isAdmin): ?>
                <a class="pdm-item" href="<?php echo $pageUrl; ?>?users=1">
                    <span class="pdm-icon">👥</span> Users Management
                </a>
                <a class="pdm-item" href="<?php echo $pageUrl; ?>?settings=1">
                    <span class="pdm-icon">⚙️</span> Admin Settings
                </a>
                <button type="button" class="pdm-item" onclick="closeProfileDropdown(); openModal('securityModal')">
                    <span class="pdm-icon">🛡️</span> Security & Devices
                </button>
                <?php endif; ?>
                <div class="pdm-divider"></div>
                <a class="pdm-item pdm-item-danger" href="?logout=1">
                    <span class="pdm-icon">🚪</span> Log Out (All Sessions)
                </a>
            </div>
        </div>
        <?php endif; ?>
    </div>
</header>
<script>
function toggleMediaFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(){});
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(function(){});
        }
    }
}
</script>
