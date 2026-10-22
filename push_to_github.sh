#!/bin/bash

# Exit on error
set -e

echo "=== Initializing Git Repository ==="
# If it's just the empty .git folder we created earlier during troubleshooting, recreate it
if [ ! -f .git/config ]; then
  echo "Re-initializing fresh git repo..."
  rm -rf .git
  git init
else
  echo "Git repository already exists."
fi

echo "=== Configuring Remote ==="
if git remote | grep -q 'origin'; then
  git remote set-url origin https://github.com/KiuQ-Technologies-II/stonekrusher.com.git
else
  git remote add origin https://github.com/KiuQ-Technologies-II/stonekrusher.com.git
fi
echo "Remote configured: https://github.com/KiuQ-Technologies-II/stonekrusher.com.git"

echo "=== Staging and Committing Files ==="
git add .
git commit -m "Initialize repo - Rebrand to KONSTRUCTZ, header spacing fixes, and circular logo emblem" || echo "Nothing to commit"

echo "=== Pushing to GitHub ==="
# Check if branch name is set
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
if [ -z "$CURRENT_BRANCH" ]; then
  CURRENT_BRANCH="main"
fi

# Set branch name explicitly to main
git branch -M main || true

echo "Pushing to branch: main..."
git push -u origin main

echo "=== Push Completed Successfully! ==="
