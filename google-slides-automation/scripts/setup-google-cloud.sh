#!/bin/bash
# Google Cloud セットアップガイドスクリプト
# Google Slides API と OAuth 2.0 認証情報の設定を対話的に案内します

set -e

echo "============================================"
echo " Google Slides MCP セットアップガイド"
echo "============================================"
echo ""

# Step 1: 前提条件の確認
echo "📋 Step 1: 前提条件の確認"
echo "-------------------------------------------"
echo "以下がインストールされていることを確認してください:"
echo "  - Node.js v18 以降"
echo "  - npm"
echo "  - gcloud CLI (推奨)"
echo ""

command -v node >/dev/null 2>&1 && echo "  ✓ Node.js $(node --version) が見つかりました" || echo "  ✗ Node.js が見つかりません。https://nodejs.org/ からインストールしてください"
command -v npm >/dev/null 2>&1 && echo "  ✓ npm $(npm --version) が見つかりました" || echo "  ✗ npm が見つかりません"
echo ""

# Step 2: Google Cloud Project の設定
echo "📋 Step 2: Google Cloud Project の設定"
echo "-------------------------------------------"
echo "1. Google Cloud Console を開いてください:"
echo "   https://console.cloud.google.com/"
echo ""
echo "2. 新しいプロジェクトを作成、または既存のプロジェクトを選択"
echo ""
echo "3. 以下の API を有効化してください:"
echo "   - Google Slides API"
echo "     https://console.cloud.google.com/apis/library/slides.googleapis.com"
echo "   - Google Drive API"
echo "     https://console.cloud.google.com/apis/library/drive.googleapis.com"
echo ""
read -p "API を有効化しましたか？ (y/n): " api_enabled

if [ "$api_enabled" != "y" ]; then
  echo "API を有効化してから再実行してください。"
  exit 1
fi

# Step 3: OAuth 2.0 認証情報の作成
echo ""
echo "📋 Step 3: OAuth 2.0 認証情報の作成"
echo "-------------------------------------------"
echo "1. 認証情報ページを開いてください:"
echo "   https://console.cloud.google.com/apis/credentials"
echo ""
echo "2. 「認証情報を作成」→「OAuth クライアント ID」を選択"
echo "3. アプリケーションの種類:「デスクトップアプリ」を選択"
echo "4. 名前: 「Google Slides MCP」(任意)"
echo "5. 作成後、Client ID と Client Secret をメモ"
echo ""
echo "※ OAuth 同意画面の設定が必要な場合:"
echo "   - ユーザーの種類:「外部」"
echo "   - スコープに以下を追加:"
echo "     https://www.googleapis.com/auth/presentations"
echo "     https://www.googleapis.com/auth/drive"
echo ""

read -p "Client ID を入力してください: " client_id
read -p "Client Secret を入力してください: " client_secret

if [ -z "$client_id" ] || [ -z "$client_secret" ]; then
  echo "Client ID と Client Secret は必須です。"
  exit 1
fi

# Step 4: リフレッシュトークンの取得
echo ""
echo "📋 Step 4: リフレッシュトークンの取得"
echo "-------------------------------------------"
echo "OAuth 2.0 Playground を使ってリフレッシュトークンを取得します:"
echo ""
echo "1. https://developers.google.com/oauthplayground/ を開く"
echo "2. 右上の歯車アイコンをクリック"
echo "3. 「Use your own OAuth credentials」にチェック"
echo "4. Client ID と Client Secret を入力"
echo "5. 左側で以下のスコープを選択:"
echo "   - Google Slides API v1: https://www.googleapis.com/auth/presentations"
echo "   - Google Drive API v3: https://www.googleapis.com/auth/drive"
echo "6. 「Authorize APIs」→ Googleアカウントでログイン → 許可"
echo "7. 「Exchange authorization code for tokens」をクリック"
echo "8. 表示された Refresh Token をコピー"
echo ""

read -p "Refresh Token を入力してください: " refresh_token

if [ -z "$refresh_token" ]; then
  echo "Refresh Token は必須です。"
  exit 1
fi

# Step 5: MCP サーバーのインストール
echo ""
echo "📋 Step 5: Google Slides MCP サーバーのインストール"
echo "-------------------------------------------"

MCP_DIR="/opt/google-slides-mcp"
read -p "MCP サーバーのインストール先 (デフォルト: $MCP_DIR): " custom_dir
MCP_DIR="${custom_dir:-$MCP_DIR}"

if [ -d "$MCP_DIR" ]; then
  echo "既存のインストールが見つかりました: $MCP_DIR"
  read -p "上書きしますか？ (y/n): " overwrite
  if [ "$overwrite" != "y" ]; then
    echo "既存のインストールを使用します。"
  else
    rm -rf "$MCP_DIR"
    git clone https://github.com/matteoantoci/google-slides-mcp.git "$MCP_DIR"
    cd "$MCP_DIR" && npm install && npm run build
    cd -
  fi
else
  git clone https://github.com/matteoantoci/google-slides-mcp.git "$MCP_DIR"
  cd "$MCP_DIR" && npm install && npm run build
  cd -
fi

# Step 6: .env ファイルの生成
echo ""
echo "📋 Step 6: 環境変数ファイルの生成"
echo "-------------------------------------------"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

cat > "$ENV_FILE" << EOF
GOOGLE_CLIENT_ID=$client_id
GOOGLE_CLIENT_SECRET=$client_secret
GOOGLE_REFRESH_TOKEN=$refresh_token
ZENDESK_TEMPLATE_ID=
OUTPUT_FOLDER_ID=
EOF

echo ".env ファイルを生成しました: $ENV_FILE"
echo "※ ZENDESK_TEMPLATE_ID と OUTPUT_FOLDER_ID は後で設定してください"

# Step 7: Claude Code MCP 設定の出力
echo ""
echo "📋 Step 7: Claude Code MCP 設定"
echo "-------------------------------------------"
echo "以下の設定を ~/.claude/settings.json に追加してください:"
echo ""
cat << EOF
{
  "mcpServers": {
    "google-slides": {
      "transportType": "stdio",
      "command": "node",
      "args": ["$MCP_DIR/build/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "$client_id",
        "GOOGLE_CLIENT_SECRET": "$client_secret",
        "GOOGLE_REFRESH_TOKEN": "$refresh_token"
      }
    }
  }
}
EOF

echo ""
echo "============================================"
echo " セットアップ完了"
echo "============================================"
echo ""
echo "次のステップ:"
echo "1. 上記の MCP 設定を ~/.claude/settings.json に追加"
echo "2. Zendesk テンプレートの Presentation ID を .env に設定"
echo "3. Claude Code を再起動"
echo "4. 「Zendeskテンプレートでスライドを作成して」と指示"
echo ""
