#!/usr/bin/env bash
set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR/frontend"
npm run build
cd "$PROJECT_DIR/frontend/dist"
git init -q
git checkout -b gh-pages -q
git add -A
git commit -m "deploy: update GitHub Pages build $(date '+%Y-%m-%d %H:%M:%S')" -q
git remote add origin https://github.com/PehlivanMert/clementine-remote.git
git push -u origin gh-pages -f -q
rm -rf .git
echo "GitHub Pages deployed: https://pehlivanmert.github.io/clementine-remote/"
