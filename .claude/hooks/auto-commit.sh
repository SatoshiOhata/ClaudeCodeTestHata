#!/bin/bash
cd /workspaces/ClaudeCodeTestHata

# .gitignoreが機能していることを確認してからコミット
git add -A
CHANGES=$(git status --porcelain)
if [ -n "$CHANGES" ]; then
  # 認証ファイルがステージングされていないか安全チェック
  SECRETS=$(git diff --cached --name-only | grep -E '\.(json|key|pem)' | grep -v 'package')
  if [ -n "$SECRETS" ]; then
    echo "WARNING: 認証ファイルの可能性があるためコミットを中止: $SECRETS"
    git reset HEAD
    exit 1
  fi
  git commit -m "auto: $(date '+%Y-%m-%d %H:%M') の変更を自動コミット"
  git push origin main
fi
