# Test Coverage Analysis

## Current State: 0% Coverage

The project has no test files, no test frameworks installed, and no test configuration.

---

## Priority 1: Server Unit Tests (Pure Functions)

### `parseProducts(rawText)` — Response Parser

This function parses unstructured Claude API output into structured product objects. It's fragile by nature since it depends on AI-generated text formatting.

**Test cases needed:**

| Case | Input | Expected |
|------|-------|----------|
| Standard 5 products | `"1. Zendesk - Great support\n2. Freshdesk - Easy to use\n..."` | 5 product objects |
| Hyphen variants | Lines with `–` (en-dash) or `—` (em-dash) separators | Correct parsing |
| Empty input | `""` | `[]` |
| No matching lines | `"Here are my recommendations..."` | `[]` |
| Extra whitespace | `"  1.  Zendesk  -  Great  "` | Trimmed name and reason |
| Partial results | Only 3 numbered lines | 3 product objects |
| Lines with extra dashes | `"1. Product-X - Has built-in features"` | Name: `Product-X`, Reason: intact |

### `detectBrandRank(products, brand)` — Brand Detection

**Test cases needed:**

| Case | Products | Brand | Expected |
|------|----------|-------|----------|
| Exact match at position 1 | `[{name: "Zendesk"}, ...]` | `"Zendesk"` | `1` |
| Case-insensitive match | `[{name: "ZENDESK"}, ...]` | `"zendesk"` | `1` |
| Partial match | `[{name: "Zendesk Suite"}, ...]` | `"Zendesk"` | `1` |
| No match | `[{name: "Freshdesk"}, ...]` | `"Zendesk"` | `null` |
| Null brand | `[...]` | `null` | `null` |
| Empty brand | `[...]` | `""` | `null` |
| Match at last position | 5 products, match at index 4 | `"Brand"` | `5` |
| Empty products array | `[]` | `"Zendesk"` | `null` |

### `buildPrompt(keyword)` — Prompt Builder

**Test cases needed:**

| Case | Input | Assert |
|------|-------|--------|
| Standard keyword | `"チャットボット"` | Contains keyword in output |
| Output format | Any keyword | Contains numbered list format instructions |
| Keyword with special chars | `"CRM/SFA"` | No errors, keyword embedded |

---

## Priority 2: Server API Integration Tests

### `POST /api/query`

| Case | Setup | Expected |
|------|-------|----------|
| Missing keyword | `body: {}` | 400 with error message |
| Successful query | Mock Claude API | 200 with keyword, products, brandRank |
| API failure | Mock 500 from Claude | 500 with error message |

### `POST /api/run-all` (SSE)

| Case | Setup | Expected |
|------|-------|----------|
| Missing keywords | `body: {}` | 400 error |
| Empty array | `body: { keywords: [] }` | 400 error |
| SSE event format | Mock Claude API | Correct `data:` prefixed JSON events |
| Progress events | 3 keywords | 3 progress events before results |
| Abort handling | Abort mid-stream | Stops processing remaining keywords |

### `GET /api/results`

| Case | Expected |
|------|----------|
| No previous results | 404 |
| After successful run | 200 with results object |

---

## Priority 3: Client Logic Tests

### TSV Export (`handleDownloadTSV`)

Extract this logic into a utility function and test:

| Case | Expected |
|------|----------|
| UTF-8 BOM present | Output starts with `\uFEFF` |
| Header columns | Correct column names with brand column when brand set |
| Product data rows | Tab-delimited, correct column count |
| Missing products | Empty cells for positions without data |
| Brand rank formatting | Number when present, `"-"` when null |

### Statistics Calculations

Extract and test:

| Metric | Test |
|--------|------|
| `completedCount` | Only counts results with non-empty products |
| `brandAppearances` | Counts non-null brandRank values |
| `top3Appearances` | Counts brandRank <= 3 |
| Appearance rate | `brandAppearances / completedCount * 100` |
| Zero completed | Rate shows `"-"` not `NaN` |

### `isBrandMatch(productName)`

| Case | Expected |
|------|----------|
| Case-insensitive match | `true` |
| Partial match | `true` |
| No brand set | `false` |
| No match | `false` |

---

## Priority 4: E2E Tests

| Flow | Description |
|------|-------------|
| Full query cycle | Input keywords -> Start -> See progress -> See results -> Download TSV |
| Stop mid-query | Start -> Stop -> Verify partial results retained |
| Empty state | No results message / disabled download button |

---

## Recommended Setup

### Framework: Vitest + React Testing Library

Vitest aligns with the existing Vite build toolchain and requires minimal configuration.

```bash
# Server
cd ai-recommendation-benchmark/server
npm install -D vitest

# Client
cd ai-recommendation-benchmark/client
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

### File Structure

```
ai-recommendation-benchmark/
  server/
    __tests__/
      parseProducts.test.js
      detectBrandRank.test.js
      buildPrompt.test.js
      api.test.js
  client/
    src/
      __tests__/
        App.test.jsx
      utils/
        tsvExport.js        # extracted from App.jsx
        tsvExport.test.js
        statistics.js        # extracted from App.jsx
        statistics.test.js
```

### Prerequisite Refactoring

1. **Export server functions**: Add `export` to `buildPrompt`, `parseProducts`, `detectBrandRank` in `server/index.js` (or extract to a separate module)
2. **Extract client utilities**: Move TSV generation and statistics calculations from `App.jsx` into separate utility modules for testability
