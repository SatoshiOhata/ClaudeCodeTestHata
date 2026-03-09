#!/usr/bin/env node
/**
 * Google Slides テンプレートからプレゼンテーションを自動生成するスクリプト
 *
 * 使い方:
 *   node generate-from-template.js \
 *     --template-id "TEMPLATE_ID" \
 *     --title "プレゼンタイトル" \
 *     --data data.json
 *
 * 処理フロー:
 *   1. Google Drive API でテンプレートを複製
 *   2. Google Slides API でプレースホルダーを実データに置換
 *   3. 画像プレースホルダーがあれば画像に差し替え
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// .env ファイルの読み込み
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error(
      "エラー: .env ファイルが見つかりません。setup-google-cloud.sh を実行してください。"
    );
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
}

// コマンドライン引数のパース
function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

// OAuth2 クライアントの作成
function createAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

// テンプレートを複製
async function copyTemplate(drive, templateId, title, folderId) {
  const copyRequest = { name: title };
  if (folderId) {
    copyRequest.parents = [folderId];
  }
  const response = await drive.files.copy({
    fileId: templateId,
    requestBody: copyRequest,
  });
  console.log(`テンプレートを複製しました: ${response.data.id}`);
  return response.data.id;
}

// テキストプレースホルダーの置換リクエストを生成
function buildTextReplaceRequests(data) {
  const requests = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && !key.startsWith("image_")) {
      requests.push({
        replaceAllText: {
          containsText: {
            text: `{{${key}}}`,
            matchCase: false,
          },
          replaceText: value,
        },
      });
    }
  }
  return requests;
}

// 画像プレースホルダーの置換リクエストを生成
function buildImageReplaceRequests(data) {
  const requests = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("image_") && typeof value === "string") {
      requests.push({
        replaceAllShapesWithImage: {
          imageUrl: value,
          imageReplaceMethod: "CENTER_INSIDE",
          containsText: {
            text: `{{${key}}}`,
            matchCase: false,
          },
        },
      });
    }
  }
  return requests;
}

// メイン処理
async function main() {
  loadEnv();
  const args = parseArgs();

  const templateId =
    args["template-id"] || process.env.ZENDESK_TEMPLATE_ID;
  const title = args["title"] || `Generated Slides - ${new Date().toISOString().split("T")[0]}`;
  const dataFile = args["data"];

  if (!templateId) {
    console.error(
      "エラー: テンプレート ID が指定されていません。--template-id または .env の ZENDESK_TEMPLATE_ID を設定してください。"
    );
    process.exit(1);
  }

  // データファイルの読み込み
  let data = {};
  if (dataFile) {
    const dataPath = path.resolve(dataFile);
    if (!fs.existsSync(dataPath)) {
      console.error(`エラー: データファイルが見つかりません: ${dataPath}`);
      process.exit(1);
    }
    data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  }

  // 認証
  const auth = createAuthClient();
  const drive = google.drive({ version: "v3", auth });
  const slides = google.slides({ version: "v1", auth });

  console.log("Google Slides テンプレートからプレゼンテーションを生成します...");
  console.log(`  テンプレート ID: ${templateId}`);
  console.log(`  タイトル: ${title}`);

  // Step 1: テンプレートを複製
  const presentationId = await copyTemplate(
    drive,
    templateId,
    title,
    process.env.OUTPUT_FOLDER_ID
  );

  // Step 2: プレースホルダーを置換
  const textRequests = buildTextReplaceRequests(data);
  const imageRequests = buildImageReplaceRequests(data);
  const allRequests = [...textRequests, ...imageRequests];

  if (allRequests.length > 0) {
    console.log(`  ${allRequests.length} 件のプレースホルダーを置換中...`);
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: allRequests },
    });
    console.log("  プレースホルダーの置換が完了しました。");
  } else {
    console.log("  置換するプレースホルダーはありませんでした。");
  }

  // 結果の表示
  const url = `https://docs.google.com/presentation/d/${presentationId}/edit`;
  console.log("");
  console.log("✅ プレゼンテーションの生成が完了しました！");
  console.log(`  URL: ${url}`);
  console.log(`  Presentation ID: ${presentationId}`);

  return { presentationId, url };
}

main().catch((err) => {
  console.error("エラーが発生しました:", err.message);
  process.exit(1);
});
