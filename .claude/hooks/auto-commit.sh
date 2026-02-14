#!/bin/bash
cd /workspaces/ClaudeCodeTestHata
git add -A
CHANGES=$(git status --porcelain)
if [ -n "$CHANGES" ]; then
  git commit -m "auto: $(date '+%Y-%m-%d %H:%M') の変更を自動コミット"
  git push origin main
fi
