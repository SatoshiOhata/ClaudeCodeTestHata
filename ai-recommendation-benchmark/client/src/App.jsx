import { useState, useRef, useCallback } from "react";

const DEFAULT_KEYWORDS = `AIエージェントツール
チャットボット
AIコールセンターシステム
IVR
通話録音システム
コールセンターシステム
コンタクトセンターシステム
コールセンターCRM
CTIシステム
VOC分析ツール
CRM
カスタマーサクセスツール
カスタマーサポートツール
顧客対応ツール
カスタマーサービスツール
社内向けチャットボット
社内ヘルプデスクツール
FAQシステム
問い合わせフォーム作成ツール
ヘルプデスクツール
ITSMツール
ITサービスマネジメントツール
IT資産管理ツール
インシデント管理ツール
マニュアル作成ツール
ナレッジ共有ツール
ナレッジマネジメントツール
Webチャットツール
Web接客ツール
チャットシステム
コンタクトセンター品質管理ツール
メール共有システム
問い合わせ管理システム
チケット管理システム
コンタクトセンター人員管理ツール`;

export default function App() {
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [brand, setBrand] = useState("");
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [done, setDone] = useState(false);
  const abortRef = useRef(null);

  const keywordList = keywords
    .split("\n")
    .map((k) => k.trim())
    .filter(Boolean);
  const keywordCount = keywordList.length;

  const brandAppearances = brand
    ? results.filter((r) => r.brandRank !== null && r.brandRank !== undefined)
        .length
    : 0;
  const top3Appearances = brand
    ? results.filter(
        (r) =>
          r.brandRank !== null &&
          r.brandRank !== undefined &&
          r.brandRank <= 3
      ).length
    : 0;
  const completedCount = results.filter(
    (r) => r.products && r.products.length > 0
  ).length;

  const handleStart = useCallback(async () => {
    if (keywordList.length === 0) return;

    setRunning(true);
    setDone(false);
    setResults([]);
    setProgress({ current: 0, total: keywordList.length });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: keywordList, brand }),
        signal: controller.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "progress") {
              setProgress({ current: event.index, total: event.total });
            } else if (event.type === "result") {
              setResults((prev) => {
                const next = [...prev];
                next[event.index] = {
                  keyword: event.keyword,
                  raw: event.raw,
                  products: event.products,
                  brandRank: event.brandRank,
                };
                return next;
              });
              setProgress((p) => ({ ...p, current: event.index + 1 }));
            } else if (event.type === "error") {
              setResults((prev) => {
                const next = [...prev];
                next[event.index] = {
                  keyword: event.keyword,
                  raw: "",
                  products: [],
                  brandRank: null,
                  error: event.error,
                };
                return next;
              });
              setProgress((p) => ({ ...p, current: event.index + 1 }));
            } else if (event.type === "done") {
              setDone(true);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("SSE error:", error);
      }
    } finally {
      setRunning(false);
      setDone(true);
      abortRef.current = null;
    }
  }, [keywordList, brand]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const handleDownloadTSV = useCallback(() => {
    const headerCols = [
      "#",
      "キーワード",
      "1位",
      "理由",
      "2位",
      "理由",
      "3位",
      "理由",
      "4位",
      "理由",
      "5位",
      "理由",
    ];
    if (brand) headerCols.push(`${brand}順位`);

    const rows = [headerCols.join("\t")];

    results.forEach((r, i) => {
      if (!r) return;
      const cols = [String(i + 1), r.keyword];
      for (let j = 0; j < 5; j++) {
        if (r.products && r.products[j]) {
          cols.push(r.products[j].name, r.products[j].reason);
        } else {
          cols.push("", "");
        }
      }
      if (brand) {
        cols.push(r.brandRank != null ? String(r.brandRank) : "-");
      }
      rows.push(cols.join("\t"));
    });

    const bom = "\uFEFF";
    const tsv = bom + rows.join("\n");
    const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AI_Recommendation_Benchmark.tsv";
    a.click();
    URL.revokeObjectURL(url);
  }, [results, brand]);

  const isBrandMatch = (productName) => {
    if (!brand) return false;
    const lower = productName.toLowerCase();
    return lower.includes(brand.toLowerCase()) || productName.includes(brand);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>AI Recommendation Benchmark</h1>
        <p>Claude API を使用したソフトウェアカテゴリ別おすすめ製品ベンチマーク</p>
      </header>

      <main className="main">
        {/* Settings Area */}
        <section className={`settings ${running ? "disabled" : ""}`}>
          <div className="settings-row">
            <div className="settings-keywords">
              <label htmlFor="keywords">キーワード</label>
              <textarea
                id="keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={
                  "1行に1キーワードを入力\n例：\nチャットボット\nFAQシステム\nヘルプデスクツール"
                }
                disabled={running}
                rows={12}
              />
              <span className="keyword-count">{keywordCount} キーワード</span>
            </div>
            <div className="settings-brand">
              <label htmlFor="brand">トラッキングブランド</label>
              <input
                id="brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="例：Zendesk"
                disabled={running}
              />
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="controls">
          {!running ? (
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={keywordCount === 0}
            >
              実行開始
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleStop}>
              停止
            </button>
          )}
          {done && results.length > 0 && (
            <button className="btn btn-secondary" onClick={handleDownloadTSV}>
              TSVダウンロード
            </button>
          )}
        </section>

        {/* Progress */}
        {running && (
          <section className="progress-section">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="progress-text">
              {progress.current} / {progress.total}
            </span>
          </section>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <section className="summary">
            <div className="summary-card">
              <div className="summary-value">{completedCount}</div>
              <div className="summary-label">
                完了 / {keywordCount}
              </div>
            </div>
            {brand && (
              <>
                <div className="summary-card">
                  <div className="summary-value">{brandAppearances}</div>
                  <div className="summary-label">{brand} 出現数</div>
                </div>
                <div className="summary-card">
                  <div className="summary-value">{top3Appearances}</div>
                  <div className="summary-label">Top3 出現数</div>
                </div>
                <div className="summary-card">
                  <div className="summary-value">
                    {completedCount > 0
                      ? `${((brandAppearances / completedCount) * 100).toFixed(1)}%`
                      : "-"}
                  </div>
                  <div className="summary-label">出現率</div>
                </div>
              </>
            )}
          </section>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <section className="results-section">
            <div className="table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>キーワード</th>
                    <th>1位</th>
                    <th>2位</th>
                    <th>3位</th>
                    <th>4位</th>
                    <th>5位</th>
                    {brand && <th>{brand}順位</th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map(
                    (r, i) =>
                      r && (
                        <tr key={i}>
                          <td className="cell-num">{i + 1}</td>
                          <td className="cell-keyword">{r.keyword}</td>
                          {[0, 1, 2, 3, 4].map((j) => {
                            const p = r.products?.[j];
                            if (!p)
                              return (
                                <td key={j} className="cell-product">
                                  -
                                </td>
                              );
                            const highlight = isBrandMatch(p.name);
                            return (
                              <td
                                key={j}
                                className={`cell-product ${highlight ? "brand-highlight" : ""}`}
                              >
                                <div className="product-name">{p.name}</div>
                                <div className="product-reason">{p.reason}</div>
                              </td>
                            );
                          })}
                          {brand && (
                            <td className="cell-rank">
                              {r.brandRank != null ? r.brandRank : "-"}
                            </td>
                          )}
                        </tr>
                      )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
