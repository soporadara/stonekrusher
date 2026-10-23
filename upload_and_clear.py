#!/usr/bin/env python3
"""
Stone Krusher (stonekrusher.com) - Production Deployment & Cache Clear Engine
Deploys built assets and source code to Hostinger, creates pre-deploy backups,
flushes OPcache and LiteSpeed web server cache, and verifies live site health.

Usage:
    python3 upload_and_clear.py
    python3 upload_and_clear.py --yes
    python3 upload_and_clear.py --dry-run
    python3 upload_and_clear.py --skip-build
    python3 upload_and_clear.py --db-dump
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
import uuid
import ssl
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# Configuration
SSH_ALIAS = "stonekrusher-prod"
SSH_HOST = "194.164.64.89"
SSH_PORT = "65002"
SSH_USER = "u534600013"
SSH_KEY = os.path.expanduser("~/.ssh/id_ed25519_stonekrusher")
SSH_PASS_FALLBACK = "Machine$@US@TYPHON%2027$"

REMOTE_BASE = "/home/u534600013/domains/stonekrusher.com"
REMOTE_PUBLIC = f"{REMOTE_BASE}/public_html"
REMOTE_SOURCE = f"{REMOTE_BASE}/hbuilds/last-source"
REMOTE_BACKUP_DIR = "/home/u534600013/stonekrusher-backups"

LIVE_SITE_URL = "https://stonekrusher.com"
DB_NAME = "u534600013_konstructz"
DB_USER = "u534600013_Konstructz08"
DB_PASS = "12345liN@"

# Terminal Colors
class Colors:
    GREEN = "\033[92m"
    BLUE = "\033[94m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"

def log_banner(title: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN} 🚜  {title}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")

def log_step(step: int, total: int, message: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}[{step}/{total}]{Colors.RESET} {Colors.BOLD}{message}{Colors.RESET}")

def log_success(message: str):
    print(f"  {Colors.GREEN}✔{Colors.RESET} {message}")

def log_info(message: str):
    print(f"  {Colors.CYAN}ℹ{Colors.RESET} {message}")

def log_warning(message: str):
    print(f"  {Colors.YELLOW}⚠{Colors.RESET} {message}")

def log_error(message: str):
    print(f"  {Colors.RED}✖ Error:{Colors.RESET} {message}")

def find_sshpass():
    for p in ['/opt/homebrew/bin/sshpass', '/usr/local/bin/sshpass', '/usr/bin/sshpass']:
        if os.path.exists(p) and os.access(p, os.X_OK):
            return p
    return shutil.which('sshpass')

COMMON_SSH_OPTS = [
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=4",
    "-o", "ConnectTimeout=30",
    "-o", "ControlMaster=auto",
    "-o", "ControlPath=/tmp/ssh-stonekrusher-%C",
    "-o", "ControlPersist=15m"
]

def get_ssh_cmd_prefix():
    """Determine the best SSH command shape (key-based alias or explicit params)."""
    # Test SSH_ALIAS first (Host stonekrusher-prod in ~/.ssh/config)
    try:
        res = subprocess.run(
            ["ssh"] + COMMON_SSH_OPTS + ["-o", "BatchMode=yes", SSH_ALIAS, "echo OK"],
            capture_output=True, text=True, timeout=20
        )
        if res.returncode == 0 and "OK" in res.stdout:
            return ["ssh"] + COMMON_SSH_OPTS + [SSH_ALIAS], SSH_ALIAS
    except Exception:
        pass

    # Test key directly
    if os.path.exists(SSH_KEY):
        try:
            res = subprocess.run(
                ["ssh", "-i", SSH_KEY, "-p", SSH_PORT] + COMMON_SSH_OPTS + ["-o", "BatchMode=yes", f"{SSH_USER}@{SSH_HOST}", "echo OK"],
                capture_output=True, text=True, timeout=20
            )
            if res.returncode == 0 and "OK" in res.stdout:
                return ["ssh", "-i", SSH_KEY, "-p", SSH_PORT] + COMMON_SSH_OPTS + [f"{SSH_USER}@{SSH_HOST}"], f"{SSH_USER}@{SSH_HOST}"
        except Exception:
            pass

    # Fallback to sshpass with password
    sshpass = find_sshpass()
    if sshpass:
        return [sshpass, "-p", SSH_PASS_FALLBACK, "ssh", "-p", SSH_PORT] + COMMON_SSH_OPTS + [f"{SSH_USER}@{SSH_HOST}"], f"{SSH_USER}@{SSH_HOST}"

    # Default to direct ssh
    return ["ssh", "-p", SSH_PORT] + COMMON_SSH_OPTS + [f"{SSH_USER}@{SSH_HOST}"], f"{SSH_USER}@{SSH_HOST}"

def get_rsync_e_flag():
    """Return the -e flag for rsync."""
    ssh_opts = "-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ConnectTimeout=30 -o ControlMaster=auto -o ControlPath=/tmp/ssh-stonekrusher-%C -o ControlPersist=15m"
    if os.path.exists(SSH_KEY):
        return f"ssh -i {SSH_KEY} -p {SSH_PORT} {ssh_opts}"
    return f"ssh -p {SSH_PORT} {ssh_opts}"

def run_cmd(cmd: list, cwd: str = None, capture: bool = False, check: bool = True, retries: int = 3):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            if capture:
                res = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
                return res.stdout.strip()
            else:
                subprocess.run(cmd, cwd=cwd, check=check)
                return ""
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.strip() if e.stderr else f"Command failed with exit code {e.returncode}"
            last_err = RuntimeError(err_msg)
            if attempt < retries:
                time.sleep(2)
            else:
                raise last_err

def purge_server_cache(ssh_cmd_base):
    """Purge PHP OPcache, LiteSpeed web cache, and touch key timestamp files."""
    token = uuid.uuid4().hex
    remote_purge_file = f"{REMOTE_PUBLIC}/.purge_cache_{token}.php"

    php_code = f"""<?php
declare(strict_types=1);
if (($_GET['token'] ?? '') !== '{token}') {{ http_response_code(403); exit; }}
if (function_exists('opcache_reset')) {{ opcache_reset(); }}
clearstatcache(true);
header('X-LiteSpeed-Purge: *');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Content-Type: application/json');
echo json_encode(['purged' => true, 'time' => time(), 'server' => 'stonekrusher']);
"""
    # 1. Upload temporary purge script via SSH
    upload_cmd = f"cat << 'EOF' > '{remote_purge_file}'\n{php_code}\nEOF"
    subprocess.run(ssh_cmd_base + [upload_cmd], check=True, capture_output=True)

    try:
        # 2. Trigger web request to execute inside web server's PHP-FPM environment
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        purge_url = f"{LIVE_SITE_URL}/.purge_cache_{token}.php?token={token}"
        req = Request(purge_url, headers={"User-Agent": "StoneKrusher-CachePurge"})
        with urlopen(req, context=ctx, timeout=12) as resp:
            data = resp.read().decode('utf-8', errors='ignore')
            if "purged" in data:
                log_success("PHP OPcache & LiteSpeed Web Cache successfully flushed!")
            else:
                log_warning(f"Cache purge endpoint executed: {data[:100]}")
    except Exception as e:
        log_warning(f"Web cache flush trigger encountered: {e}")
    finally:
        # 3. Clean up the temporary purge script
        subprocess.run(ssh_cmd_base + [f"rm -f '{remote_purge_file}'"], capture_output=True)

    # 4. Touch index.html and .htaccess to reload web server inode stats
    touch_cmd = f"touch '{REMOTE_PUBLIC}/.htaccess' '{REMOTE_PUBLIC}/index.html' 2>/dev/null || true"
    subprocess.run(ssh_cmd_base + [touch_cmd], capture_output=True)
    log_success("Web server timestamp signals touched (.htaccess, index.html).")

def dump_remote_database(ssh_cmd_base, project_root):
    """Dump remote MySQL database to local file."""
    db_dir = os.path.join(project_root, "database")
    os.makedirs(db_dir, exist_ok=True)
    dest_file = os.path.join(db_dir, "stonekrusher_db.sql")

    log_info(f"Dumping remote database '{DB_NAME}' to {dest_file}...")
    dump_cmd = f"mysqldump -u '{DB_USER}' -p'{DB_PASS}' '{DB_NAME}'"
    res = subprocess.run(ssh_cmd_base + [dump_cmd], capture_output=True, text=True)
    if res.returncode == 0 and len(res.stdout) > 500:
        with open(dest_file, "w") as f:
            f.write(res.stdout)
        root_db_file = os.path.join(project_root, "stonekrusher_db.sql")
        with open(root_db_file, "w") as f:
            f.write(res.stdout)
        log_success(f"Database successfully dumped! ({len(res.stdout):,} bytes)")
    else:
        log_error(f"Failed to dump database: {res.stderr}")

def main():
    parser = argparse.ArgumentParser(description="Stone Krusher Production Deployer & Cache Purge Engine")
    parser.add_argument("-y", "--yes", action="store_true", help="Skip confirmation prompts")
    parser.add_argument("--dry-run", action="store_true", help="Show files to be updated without uploading")
    parser.add_argument("--skip-build", action="store_true", help="Skip local npm run build step")
    parser.add_argument("--skip-cache", action="store_true", help="Skip remote OPcache & web cache purge")
    parser.add_argument("--source-only", action="store_true", help="Only sync source repository to hbuilds/last-source")
    parser.add_argument("--db-dump", action="store_true", help="Download a fresh MySQL database dump to database/stonekrusher_db.sql")
    args = parser.parse_args()

    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    log_banner("Stone Krusher — Deploy, Sync & Live Cache Purge")
    print(f"  Target:     {LIVE_SITE_URL}")
    print(f"  Remote:     {SSH_USER}@{SSH_HOST}:{SSH_PORT} ({REMOTE_PUBLIC})")
    print(f"  Database:   {DB_NAME}")

    ssh_cmd_base, ssh_target_host = get_ssh_cmd_prefix()
    rsync_e = get_rsync_e_flag()

    # If --db-dump only was requested
    if args.db_dump:
        dump_remote_database(ssh_cmd_base, project_root)
        if not args.yes:
            return

    total_steps = 6
    current_step = 1

    # Step 1: Build Local Application
    log_step(current_step, total_steps, "Validating & Building Local Application (Vite + SEO)")
    current_step += 1

    if args.skip_build or args.source_only:
        log_info("Skipping local npm run build as requested.")
    else:
        print("  Running: npm run build...")
        build_start = time.time()
        try:
            run_cmd(["npm", "run", "build"], cwd=project_root, check=True)
            build_time = time.time() - build_start
            log_success(f"Build compiled successfully with 0 errors in {build_time:.2f}s!")
        except Exception as e:
            log_error(f"Build failed! Aborting deployment. Error: {e}")
            sys.exit(1)

    dist_dir = os.path.join(project_root, "dist")
    if not args.source_only and (not os.path.isdir(dist_dir) or not os.path.isfile(os.path.join(dist_dir, "index.html"))):
        log_error("dist/ directory is missing or corrupt. Run npm run build first.")
        sys.exit(1)

    # Step 2: Test SSH Connectivity
    log_step(current_step, total_steps, "Verifying Hostinger SSH Connectivity")
    current_step += 1

    try:
        check_res = subprocess.run(ssh_cmd_base + ["echo SSH_OK"], capture_output=True, text=True, timeout=25)
        if check_res.returncode != 0 or "SSH_OK" not in check_res.stdout:
            raise RuntimeError(f"SSH test returned code {check_res.returncode}: {check_res.stderr}")
        log_success(f"SSH connection authenticated ({ssh_target_host}).")
    except Exception as e:
        log_error(f"Cannot connect to Hostinger server via SSH ({ssh_target_host}): {e}")
        sys.exit(1)

    # Step 3: Automatic Remote Pre-Deployment Backup
    log_step(current_step, total_steps, "Creating Instant Production Backup Snapshot")
    current_step += 1

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_file = f"{REMOTE_BACKUP_DIR}/pre_deploy_backup_{timestamp}.tar.gz"
    backup_cmd = (
        f"mkdir -p -m 700 '{REMOTE_BACKUP_DIR}' && "
        f"tar -czf '{backup_file}' -C '{REMOTE_BASE}' public_html && "
        f"echo SNAPSHOT_CREATED"
    )

    log_info(f"Creating snapshot: {backup_file}...")
    try:
        snap_res = subprocess.run(ssh_cmd_base + [backup_cmd], capture_output=True, text=True, timeout=45)
        if "SNAPSHOT_CREATED" in snap_res.stdout:
            log_success(f"Snapshot created successfully on Hostinger outside web root.")
        else:
            log_warning("Snapshot command finished with warning; continuing.")
    except Exception as e:
        log_warning(f"Could not create pre-deployment backup: {e}")
        if not args.yes:
            proceed = input("  Continue without snapshot? (yes/no): ").strip().lower()
            if proceed != "yes":
                sys.exit(1)

    # Step 4: Synchronizing Frontend and Backend Assets
    log_step(current_step, total_steps, "Synchronizing Built Application to Production public_html")
    current_step += 1

    rsync_excludes = [
        "--exclude=blog-posts-data.json",
        "--exclude=blog-posts-default.json",
        "--exclude=/api/config.php",
        "--exclude=*.log",
        "--exclude=.user.ini",
        "--exclude=.htaccess.old*",
        "--exclude=*.sql",
        "--exclude=uploads/",
        "--exclude=medialibrary/blog/",
        "--exclude=medialibrary/.trash/",
        "--exclude=medialibrary/.feature_db.sqlite",
    ]

    target_destination = f"{SSH_USER}@{SSH_HOST}:{REMOTE_PUBLIC}/"

    # Normalize permissions locally (dirs 755, files 644). macOS openrsync does not
    # support the D/F --chmod syntax, and files copied in with mode 700 would otherwise
    # be served as 403 Forbidden (e.g. robots.txt, sitemap.xml).
    dist_root = os.path.join(project_root, "dist")
    for current_root, dir_names, file_names in os.walk(dist_root):
        os.chmod(current_root, 0o755)
        for file_name in file_names:
            try:
                os.chmod(os.path.join(current_root, file_name), 0o644)
            except OSError:
                pass

    # Dry-run analysis
    log_info("Analyzing file differences between local dist and production...")
    dry_run_cmd = ["rsync", "-avzn", "--delete", "--chmod=ugo=rX,u+w", "-e", rsync_e] + rsync_excludes + ["dist/", target_destination]
    try:
        diff_output = run_cmd(dry_run_cmd, capture=True)
        changed_files = [line for line in diff_output.splitlines() if line and not line.startswith("sending") and not line.startswith("total") and line != "./"]
        if changed_files:
            print(f"  {Colors.BOLD}Files to be updated on production:{Colors.RESET}")
            for f in changed_files[:15]:
                print(f"    {Colors.DIM}• {f}{Colors.RESET}")
            if len(changed_files) > 15:
                print(f"    {Colors.DIM}... and {len(changed_files) - 15} more files.{Colors.RESET}")
        else:
            log_info("Production files are already up-to-date with dist.")
    except Exception as e:
        log_warning(f"Dry-run analysis warning: {e}")
        changed_files = ["dist/"]

    if args.dry_run:
        print(f"\n{Colors.YELLOW}Dry-run mode completed. No files were transferred.{Colors.RESET}")
        return

    if not args.yes and changed_files:
        confirm = input(f"\n  {Colors.BOLD}Deploy updates to production stonekrusher.com now? (yes/no): {Colors.RESET}").strip().lower()
        if confirm != "yes":
            log_warning("Deployment cancelled by user. Production was not modified.")
            sys.exit(0)

    if not args.source_only:
        log_info("Uploading compiled frontend and static pages...")
        live_sync_cmd = ["rsync", "-avz", "--delete", "--chmod=ugo=rX,u+w", "-e", rsync_e] + rsync_excludes + ["dist/", target_destination]
        run_cmd(live_sync_cmd, capture=True)

        log_info("Ensuring PHP endpoints, API, and .htaccess are in sync...")
        backend_files = [
            ("public/api/blog-posts.php", f"{REMOTE_PUBLIC}/api/blog-posts.php"),
            ("public/api/config.php", f"{REMOTE_PUBLIC}/api/config.php"),
            ("public/api/verify-comment-email.php", f"{REMOTE_PUBLIC}/api/verify-comment-email.php"),
            ("public/medialibrary/index.php", f"{REMOTE_PUBLIC}/medialibrary/index.php"),
            ("public/medialibrary/.users.json", f"{REMOTE_PUBLIC}/medialibrary/.users.json"),
            ("public/medialibrary/features/config.php", f"{REMOTE_PUBLIC}/medialibrary/features/config.php"),
            ("public/contact-submit.php", f"{REMOTE_PUBLIC}/contact-submit.php"),
            ("public/.htaccess", f"{REMOTE_PUBLIC}/.htaccess"),
        ]
        for src, dest in backend_files:
            if os.path.exists(os.path.join(project_root, src)):
                run_cmd(["rsync", "-avz", "--chmod=ugo=rX,u+w", "-e", rsync_e, src, f"{SSH_USER}@{SSH_HOST}:{dest}"], capture=True)
                time.sleep(0.5)

        log_success("All public web files successfully transferred to Hostinger public_html!")

    # Step 4b: Synchronize Source Code to remote hbuilds/last-source
    log_info("Synchronizing latest source code changes to hbuilds/last-source...")
    source_excludes = [
        "--exclude=.git",
        "--exclude=node_modules",
        "--exclude=dist",
        "--exclude=production_public_html",
        "--exclude=database/*.sql",
        "--exclude=*.sql",
        "--exclude=__pycache__",
        "--exclude=*.pyc",
        "--exclude=.DS_Store",
    ]
    source_sync_cmd = ["rsync", "-avz", "-e", rsync_e] + source_excludes + ["./", f"{SSH_USER}@{SSH_HOST}:{REMOTE_SOURCE}/"]
    try:
        run_cmd(source_sync_cmd, capture=True)
        log_success("Remote last-source repository updated.")
    except Exception as e:
        log_warning(f"Source sync warning: {e}")

    # Step 5: Flush Server OPcache & LiteSpeed Cache
    if not args.skip_cache and not args.source_only:
        log_step(current_step, total_steps, "Flushing Server OPcache & LiteSpeed Web Cache")
        current_step += 1
        purge_server_cache(ssh_cmd_base)
    else:
        current_step += 1

    # Step 6: Post-Deployment Smoke Tests & Health Check
    log_step(current_step, total_steps, "Post-Deployment Live Health Verification")

    time.sleep(1.5)  # Pause for cache propagation

    def check_endpoint(url: str, desc: str) -> bool:
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = Request(url, headers={"User-Agent": "Mozilla/5.0 (StoneKrusher-HealthGuard)"})
            with urlopen(req, context=ctx, timeout=12) as resp:
                code = resp.getcode()
                if code == 200:
                    log_success(f"{desc}: HTTP 200 OK")
                    return True
                else:
                    log_warning(f"{desc}: HTTP {code}")
                    return False
        except Exception as e:
            log_error(f"{desc} failed: {e}")
            return False

    homepage_ok = check_endpoint(LIVE_SITE_URL, "Live Homepage (https://stonekrusher.com/)")
    api_ok = check_endpoint(f"{LIVE_SITE_URL}/api/blog-posts.php", "Blog Posts API Endpoint")
    equipment_ok = check_endpoint(f"{LIVE_SITE_URL}/equipment/", "Equipment Catalog Page")

    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    if homepage_ok and api_ok:
        print(f"{Colors.BOLD}{Colors.GREEN} ✔ DEPLOYMENT SUCCESSFUL — ALL SYSTEMS LIVE & HEALTHY! {Colors.RESET}")
        print(f"{Colors.DIM} Live URL:          {LIVE_SITE_URL}{Colors.RESET}")
        print(f"{Colors.DIM} Rollback Snapshot: {backup_file}{Colors.RESET}")
    else:
        print(f"{Colors.BOLD}{Colors.YELLOW} ⚠ DEPLOYMENT FINISHED WITH HEALTH CHECK WARNINGS! {Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")

if __name__ == "__main__":
    main()
