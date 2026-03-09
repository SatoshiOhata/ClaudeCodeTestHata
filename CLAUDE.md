# CLAUDE.md

## プロジェクト概要

Claude Code の動作テスト用リポジトリ。HTML コンテンツの作成・最適化、および Google Slides 自動生成ツールを含む。

## Google Slides 自動生成

### セットアップ

Google Slides MCP サーバーを使用して、Zendesk テンプレートからスライドを自動生成する。
詳細は `google-slides-automation/README.md` を参照。

### 使い方

1. MCP サーバーが設定済みであれば、Claude Code に「Zendeskテンプレートでスライドを作成して」と指示
2. スクリプトで実行する場合: `node google-slides-automation/scripts/generate-from-template.js --template-id <ID> --title <タイトル> --data <データファイル>`

### プレースホルダー規約

テンプレート内のプレースホルダーは `{{name}}` 形式を使用する。
マッピング定義は `google-slides-automation/templates/placeholder-mapping.json` を参照。

### 注意事項

- `.env` ファイルには認証情報が含まれるため、絶対にコミットしない
- テンプレート ID は Presentation URL の `/d/` と `/edit` の間の文字列
