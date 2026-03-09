---
name: google-slides
description: ZendeskのGoogle Slidesテンプレートからプレゼンテーションを自動生成する。「スライド作成」「プレゼン作成」「Zendesk スライド」などのリクエスト時に使用。
---

# Google Slides 自動生成スキル

Zendesk の Google Slides テンプレートを複製し、プレースホルダーを実データに置換してプレゼンテーションを自動生成する。

## 前提条件

- Google Slides MCP サーバーが設定済みであること
- 環境変数（GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN）が設定済みであること
- Zendesk テンプレートの Presentation ID が判明していること

## ワークフロー

### Step 1: 要件ヒアリング

ユーザーに以下を確認する:
- プレゼンテーションの目的・テーマ
- 対象読者
- スライド枚数の目安
- 含めたいデータ・KPI
- 使用するテンプレート ID（未指定の場合は .env の ZENDESK_TEMPLATE_ID を使用）

### Step 2: コンテンツ設計

以下の構成表をユーザーに提示して承認を得る:

```
| スライド# | タイプ | タイトル | 内容概要 |
|-----------|--------|----------|----------|
| 1 | 表紙 | ... | タイトル、日付、作成者 |
| 2 | セクション | ... | セクション見出し |
| 3 | コンテンツ | ... | 本文、KPI |
| ... | ... | ... | ... |
```

### Step 3: テンプレート複製＆データ流し込み

MCP ツールを使って以下を実行:

1. **テンプレート構造の確認**
   - `get_presentation` でテンプレートの構造を取得
   - 各スライドのレイアウトとプレースホルダーを確認

2. **テンプレートの複製**
   - Google Drive API（MCP経由）でテンプレートをコピー
   - 新しいプレゼンテーション ID を取得

3. **プレースホルダーの一括置換**
   - `batch_update_presentation` で `replaceAllText` リクエストを送信
   - テキスト: `{{placeholder}}` → 実データ
   - 画像: `replaceAllShapesWithImage` で画像URLに差し替え

### Step 4: 品質確認

- `get_presentation` で生成結果を確認
- `summarize_presentation` でテキスト内容を要約・検証
- ユーザーにプレビュー URL を提示

## プレースホルダー規約

テンプレート内のプレースホルダーは `{{name}}` 形式を使用:

| プレースホルダー | 用途 |
|---|---|
| `{{title}}` | メインタイトル |
| `{{subtitle}}` | サブタイトル |
| `{{date}}` | 日付 |
| `{{author}}` | 作成者名 |
| `{{section_title}}` | セクション見出し |
| `{{body_text}}` | 本文 |
| `{{metric_value}}` | KPI数値 |
| `{{metric_label}}` | KPIラベル |
| `{{image_*}}` | 画像（image_ プレフィックスで画像差し替え） |

## batchUpdate リクエストの例

```json
{
  "requests": [
    {
      "replaceAllText": {
        "containsText": { "text": "{{title}}", "matchCase": false },
        "replaceText": "Q1 2026 ビジネスレビュー"
      }
    },
    {
      "replaceAllText": {
        "containsText": { "text": "{{date}}", "matchCase": false },
        "replaceText": "2026年3月9日"
      }
    },
    {
      "replaceAllShapesWithImage": {
        "imageUrl": "https://example.com/chart.png",
        "imageReplaceMethod": "CENTER_INSIDE",
        "containsText": { "text": "{{image_chart}}", "matchCase": false }
      }
    }
  ]
}
```

## 出力フォーマット

生成完了後、以下を出力する:

```markdown
## スライド生成完了

- **タイトル:** [プレゼンテーションタイトル]
- **Presentation ID:** [ID]
- **URL:** https://docs.google.com/presentation/d/[ID]/edit
- **スライド数:** [N]枚
- **置換したプレースホルダー:** [N]件

### 生成されたスライド構成
| # | タイトル | 置換内容 |
|---|---------|---------|
| 1 | ... | title, date, author |
| 2 | ... | section_title |
| ... | ... | ... |
```

## エラーハンドリング

- **認証エラー**: リフレッシュトークンの再取得を案内
- **テンプレート未発見**: Presentation ID の確認を促す
- **権限エラー**: テンプレートの共有設定を確認するよう案内
- **プレースホルダー不一致**: テンプレート内の実際のテキストと定義の差分を報告
