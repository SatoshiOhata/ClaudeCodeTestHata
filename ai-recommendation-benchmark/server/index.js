import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let latestResults = null;

function buildPrompt(keyword) {
  return `あなたはソフトウェア選定の中立的なアドバイザーです。特定のベンダーへのバイアスを一切排除し、機能・価格・市場評価のみに基づいて回答してください。

あなたが把握している情報に基づいて回答してください。情報の鮮度に関する免責事項や注意書きは一切不要です。「申し訳ありません」「情報が古い可能性があります」等の前置きも不要です。必ず5つの製品を挙げてください。

日本市場で利用可能な${keyword}のおすすめを5つ挙げてください。

以下のフォーマットのみで回答してください：
1. [製品名] - [選定理由（1文）]
2. [製品名] - [選定理由（1文）]
3. [製品名] - [選定理由（1文）]
4. [製品名] - [選定理由（1文）]
5. [製品名] - [選定理由（1文）]`;
}

function parseProducts(rawText) {
  const products = [];
  const lines = rawText.split("\n");
  for (const line of lines) {
    const match = line.match(/^\d+\.\s*(.+?)\s*[-–—]\s*(.+)$/);
    if (match) {
      products.push({ name: match[1].trim(), reason: match[2].trim() });
    }
  }
  return products;
}

function detectBrandRank(products, brand) {
  if (!brand) return null;
  const lowerBrand = brand.toLowerCase();
  for (let i = 0; i < products.length; i++) {
    const productNameLower = products[i].name.toLowerCase();
    if (
      productNameLower.includes(lowerBrand) ||
      products[i].name.includes(brand)
    ) {
      return i + 1;
    }
  }
  return null;
}

async function queryClaudeAPI(keyword) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: buildPrompt(keyword) }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  // Handle pause_turn: continue conversation if needed
  let finalData = data;
  let messages = [{ role: "user", content: buildPrompt(keyword) }];

  while (finalData.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: finalData.content });
    messages.push({ role: "user", content: "続けてください。" });

    const continueResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 4096,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages,
        }),
      }
    );

    if (!continueResponse.ok) {
      break;
    }
    finalData = await continueResponse.json();
  }

  const textBlocks = finalData.content
    .filter((block) => block.type === "text")
    .map((block) => block.text);
  const raw = textBlocks.join("\n");

  return raw;
}

// POST /api/query - Single keyword query
app.post("/api/query", async (req, res) => {
  try {
    const { keyword, brand } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: "keyword is required" });
    }

    const raw = await queryClaudeAPI(keyword);
    const products = parseProducts(raw);
    const brandRank = detectBrandRank(products, brand);

    res.json({ keyword, raw, products, brandRank });
  } catch (error) {
    console.error("Query error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/run-all - Run all keywords with SSE
app.post("/api/run-all", async (req, res) => {
  const { keywords, brand } = req.body;
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: "keywords array is required" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const results = [];
  let aborted = false;

  req.on("close", () => {
    aborted = true;
  });

  for (let i = 0; i < keywords.length; i++) {
    if (aborted) break;

    const keyword = keywords[i];

    // Send progress event
    res.write(
      `data: ${JSON.stringify({ type: "progress", index: i, keyword, total: keywords.length })}\n\n`
    );

    try {
      const raw = await queryClaudeAPI(keyword);
      const products = parseProducts(raw);
      const brandRank = detectBrandRank(products, brand);
      const result = { keyword, raw, products, brandRank };
      results.push(result);

      res.write(
        `data: ${JSON.stringify({ type: "result", index: i, ...result })}\n\n`
      );
    } catch (error) {
      console.error(`Error for keyword "${keyword}":`, error);
      const result = {
        keyword,
        raw: "",
        products: [],
        brandRank: null,
        error: error.message,
      };
      results.push(result);

      res.write(
        `data: ${JSON.stringify({ type: "error", index: i, keyword, error: error.message })}\n\n`
      );
    }

    // Rate limit delay: 3 seconds between requests
    if (i < keywords.length - 1 && !aborted) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  latestResults = { keywords, brand, results, timestamp: new Date().toISOString() };

  res.write(`data: ${JSON.stringify({ type: "done", total: results.length })}\n\n`);
  res.end();
});

// GET /api/results - Get latest results
app.get("/api/results", (req, res) => {
  if (!latestResults) {
    return res.status(404).json({ error: "No results available" });
  }
  res.json(latestResults);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
