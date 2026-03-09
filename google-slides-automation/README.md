# Google Slides 自動生成ツール

Zendesk の Google Slides テンプレートを活用し、Claude Code + Google Slides MCP でスライド資料を自動生成するためのツールキットです。

## アーキテクチャ

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Claude Code  │────▶│ Google Slides MCP│────▶│ Google Slides API│
│ (SKILL.md)   │     │   Server         │     │                  │
└─────────────┘     └──────────────────┘     └──────────────────┘
                                                       │
                                               ┌───────┴────────┐
                                               │ Zendesk Template│
                                               │ (Google Slides) │
                                               └────────────────┘
```

## セットアップ

### 1. Google Cloud Project の設定

```bash
# セットアップスクリプトを実行（対話的に案内します）
./scripts/setup-google-cloud.sh
```

手動で行う場合:

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Slides API と Google Drive API を有効化
3. OAuth 2.0 認証情報を作成（アプリケーション種類: デスクトップアプリ）
4. リフレッシュトークンを取得

### 2. Google Slides MCP サーバーのインストール

```bash
# MCP サーバーをクローン＆ビルド
git clone https://github.com/matteoantoci/google-slides-mcp.git /opt/google-slides-mcp
cd /opt/google-slides-mcp
npm install
npm run build
```

### 3. Claude Code MCP 設定

`~/.claude/settings.json` に以下を追加:

```json
{
  "mcpServers": {
    "google-slides": {
      "transportType": "stdio",
      "command": "node",
      "args": ["/opt/google-slides-mcp/build/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "<your-client-id>",
        "GOOGLE_CLIENT_SECRET": "<your-client-secret>",
        "GOOGLE_REFRESH_TOKEN": "<your-refresh-token>"
      }
    }
  }
}
```

### 4. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して認証情報を入力
```

## 使い方

### Claude Code から直接使う

```
# テンプレートからスライドを生成
「Zendeskテンプレートを使って、Q1レビューのスライドを作成して」

# 既存プレゼンテーションを更新
「プレゼンテーション ID: xxx のスライド3のタイトルを変更して」
```

### スクリプトから使う

```bash
# テンプレートを複製してプレースホルダーを置換
node scripts/generate-from-template.js \
  --template-id "TEMPLATE_PRESENTATION_ID" \
  --title "Q1 Review 2026" \
  --data templates/q1-review-data.json
```

## ディレクトリ構成

```
google-slides-automation/
├── README.md                          # このファイル
├── .env.example                       # 環境変数テンプレート
├── scripts/
│   ├── setup-google-cloud.sh          # GCP セットアップガイド
│   └── generate-from-template.js      # テンプレートからスライド生成
└── templates/
    └── placeholder-mapping.json       # プレースホルダー定義
```

## Zendesk テンプレートの活用方法

### プレースホルダー規約

テンプレート内に以下の形式でプレースホルダーを配置します:

| プレースホルダー | 用途 |
|---|---|
| `{{title}}` | スライドタイトル |
| `{{subtitle}}` | サブタイトル |
| `{{date}}` | 日付 |
| `{{author}}` | 作成者名 |
| `{{section_title}}` | セクション見出し |
| `{{body_text}}` | 本文テキスト |
| `{{metric_value}}` | KPI数値 |
| `{{metric_label}}` | KPIラベル |
| `{{image_url}}` | 画像URL |

### テンプレートの準備手順

1. Zendesk の Google Slides テンプレートを Google Drive にコピー
2. 差し替えたい箇所に `{{placeholder_name}}` 形式のテキストを配置
3. テンプレートの Presentation ID をメモ（URLの `/d/` と `/edit` の間の文字列）
4. `templates/placeholder-mapping.json` にマッピングを定義

## MCP ツール一覧

| ツール | 機能 | 主な引数 |
|---|---|---|
| `create_presentation` | 新規プレゼンテーション作成 | `title` |
| `get_presentation` | プレゼンテーション情報取得 | `presentationId` |
| `get_page` | スライド詳細取得 | `presentationId`, `pageObjectId` |
| `batch_update_presentation` | テキスト/画像の一括更新 | `presentationId`, `requests[]` |
| `summarize_presentation` | コンテンツ要約 | `presentationId` |

## トラブルシューティング

### 認証エラー
- OAuth 同意画面で正しいスコープが設定されているか確認
- リフレッシュトークンが期限切れの場合は再取得

### テンプレートにアクセスできない
- テンプレートの共有設定でサービスアカウントまたは OAuth ユーザーに閲覧権限があるか確認

### batchUpdate が失敗する
- `objectId` が正しいか `get_presentation` で確認
- リクエストの順序に依存関係がある場合は順番に注意
