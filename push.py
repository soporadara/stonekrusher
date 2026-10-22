#!/usr/bin/env python3
"""
Stone Krusher - Dedicated Git Push Script
Quickly stages, commits, and pushes code updates to GitHub (soporadara/stonekrusher).

Usage:
    python3 push.py
    python3 push.py -m "Updated homepage banner and styling"
    python3 push.py --skip-build
"""

import argparse
import os
import subprocess
import sys
import time

# Repository Configuration
GITHUB_REPO_URL = "https://github.com/soporadara/stonekrusher.git"
GITHUB_SSH_URL = "git@github.com:soporadara/stonekrusher.git"
REPO_WEB_URL = "https://github.com/soporadara/stonekrusher"
DEFAULT_BRANCH = "main"

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

def run_cmd(cmd: list, cwd: str = None, capture: bool = False, check: bool = True):
    try:
        if capture:
            res = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
            return res.stdout.strip()
        else:
            subprocess.run(cmd, cwd=cwd, check=check)
            return ""
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.strip() if e.stderr else f"Command failed with exit code {e.returncode}"
        raise RuntimeError(err_msg)

def ensure_remote():
    """Ensure git remote 'origin' points to soporadara/stonekrusher."""
    try:
        remotes = run_cmd(["git", "remote", "-v"], capture=True)
        if "soporadara/stonekrusher" not in remotes:
            print(f"  {Colors.CYAN}ℹ Configuring remote 'origin' to {GITHUB_SSH_URL}...{Colors.RESET}")
            if "origin" in remotes:
                run_cmd(["git", "remote", "set-url", "origin", GITHUB_SSH_URL])
            else:
                run_cmd(["git", "remote", "add", "origin", GITHUB_SSH_URL])
    except Exception as e:
        print(f"  {Colors.YELLOW}⚠ Could not verify remote: {e}{Colors.RESET}")

def main():
    parser = argparse.ArgumentParser(description="Stage, commit, and push updates strictly to GitHub")
    parser.add_argument("-m", "--message", help="Commit message")
    parser.add_argument("--skip-build", action="store_true", help="Skip build validation before push")
    args = parser.parse_args()

    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN} 📦  Stone Krusher — GitHub Code Push Utility       {Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")

    ensure_remote()

    # 1. Check for changes
    status_output = run_cmd(["git", "status", "--porcelain"], capture=True)
    if not status_output:
        # Check if ahead of remote or first push
        try:
            ahead = run_cmd(["git", "log", "@{u}..HEAD", "--oneline"], capture=True)
        except Exception:
            ahead = run_cmd(["git", "log", "-n", "3", "--oneline"], capture=True)

        if ahead:
            print(f"{Colors.CYAN}ℹ Local branch has commits ready to push:{Colors.RESET}")
            for line in ahead.splitlines():
                print(f"  {Colors.DIM}• {line}{Colors.RESET}")
        else:
            print(f"{Colors.YELLOW}No local changes or commits detected to push.{Colors.RESET}")
            print(f"Working tree clean. Use `python3 upload_and_clear.py` to deploy to Hostinger.")
            sys.exit(0)
    else:
        print(f"{Colors.BOLD}Changed files detected:{Colors.RESET}")
        for line in status_output.splitlines()[:20]:
            code = line[:2].strip()
            path = line[3:].strip()
            print(f"  {Colors.YELLOW}{code}{Colors.RESET} {path}")
        if len(status_output.splitlines()) > 20:
            print(f"  {Colors.DIM}... and {len(status_output.splitlines()) - 20} more files.{Colors.RESET}")
        print()

    # 2. Build verification (optional)
    if not args.skip_build:
        print(f"{Colors.BOLD}[1/3] Validating Local Build (Zero-Error Check)...{Colors.RESET}")
        start = time.time()
        try:
            run_cmd(["npm", "run", "build"], capture=True)
            elapsed = time.time() - start
            print(f"  {Colors.GREEN}✔ Build passed with 0 errors in {elapsed:.2f}s!{Colors.RESET}\n")
        except Exception as e:
            print(f"  {Colors.RED}✖ Build failed! Code has errors. Aborting push.{Colors.RESET}")
            print(f"\n{Colors.RED}{e}{Colors.RESET}\n")
            print("Fix the errors above or run with --skip-build to push anyway.")
            sys.exit(1)
    else:
        print(f"{Colors.YELLOW}[1/3] Skipping build check (--skip-build).{Colors.RESET}\n")

    # 3. Commit message
    if status_output:
        commit_msg = args.message
        if not commit_msg:
            try:
                commit_msg = input(f"{Colors.BOLD}Enter commit message: {Colors.RESET}").strip()
            except (KeyboardInterrupt, EOFError):
                print("\nPush cancelled.")
                sys.exit(0)

        if not commit_msg:
            commit_msg = f"Update stonekrusher codebase - {time.strftime('%Y-%m-%d %H:%M:%S')}"
            print(f"  {Colors.DIM}Using default message: '{commit_msg}'{Colors.RESET}")

        print(f"{Colors.BOLD}[2/3] Staging and committing files to Git...{Colors.RESET}")
        run_cmd(["git", "add", "-A"])
        run_cmd(["git", "commit", "-m", commit_msg])
        commit_hash = run_cmd(["git", "rev-parse", "--short", "HEAD"], capture=True)
        print(f"  {Colors.GREEN}✔ Commit created [{commit_hash}]: {commit_msg}{Colors.RESET}\n")
    else:
        print(f"{Colors.BOLD}[2/3] No new files to commit. Ready to push commits...{Colors.RESET}\n")

    # 4. Ensure branch is main
    current_branch = run_cmd(["git", "branch", "--show-current"], capture=True)
    if not current_branch or current_branch == "HEAD":
        run_cmd(["git", "branch", "-M", DEFAULT_BRANCH])
        current_branch = DEFAULT_BRANCH
    elif current_branch != DEFAULT_BRANCH:
        run_cmd(["git", "branch", "-M", DEFAULT_BRANCH])
        current_branch = DEFAULT_BRANCH

    # 5. Push to GitHub
    print(f"{Colors.BOLD}[3/3] Pushing to GitHub ({GITHUB_SSH_URL} -> {current_branch})...{Colors.RESET}")
    try:
        run_cmd(["git", "push", "-u", "origin", current_branch])
        print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.GREEN} ✔ SUCCESSFULLY PUSHED CODE TO GITHUB!              {Colors.RESET}")
        print(f"{Colors.CYAN} Branch:     {current_branch}{Colors.RESET}")
        print(f"{Colors.CYAN} Repository: {REPO_WEB_URL}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.RESET}\n")
    except Exception as e:
        print(f"\n{Colors.RED}✖ Push failed: {e}{Colors.RESET}\n")
        print(f"Check your SSH connection to GitHub with: ssh -T git@github.com")
        sys.exit(1)

if __name__ == "__main__":
    main()
