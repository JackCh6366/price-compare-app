# 商品優惠比較分析網站

貼上任意購物網站網址，實際讀取網頁內容，交給 Google Gemini API 解析成優惠清單、跨站比價，並支援 AI 對話查詢。

## 這個專案怎麼運作

1. 前端把你貼上的每個網址，各自送到 `/api/analyze`
2. 後端用 `fetch` 抓取該網址的原始 HTML，清理成純文字後，呼叫 Gemini API 做「結構化擷取（Function Calling）」——只允許擷取網頁中真的出現的資料，找不到就回傳空陣列，不會編造
3. 「同規格商品比價」用商品名稱字串比對做自動分組（任意網站商品命名不同，這是務實但誠實的做法，不保證 100% 精準）
4. 「AI 對話」也是呼叫 Gemini API，但嚴格限制只能根據已分析到的網站資料回答，找不到就照你原本規則回覆「目前提供的網站中沒有找到相關資訊，請補充更詳細內容或新增網站」

## 本機執行

```bash
npm install
cp .env.example .env.local
# 編輯 .env.local，填入你自己的 Gemini API 金鑰
npm run dev
```

打開 http://localhost:3000

金鑰申請位置：https://aistudio.google.com/app/apikey

## 部署到 Vercel

```bash
npm install -g vercel   # 若尚未安裝 Vercel CLI
vercel
```

部署過程會詢問專案設定，直接用預設值即可。部署完成後，到 Vercel 專案的 **Settings → Environment Variables**，新增：

- `GEMINI_API_KEY`：你的 Google Gemini API 金鑰

新增後重新部署一次（`vercel --prod`）讓環境變數生效。

## 已知限制（誠實告知，不打高空）

- **不是所有網站都抓得到**：有防爬蟲機制、需要登入、或內容完全由前端 JavaScript 動態渲染的網站，`fetch` 只能拿到伺服器回傳的原始 HTML，抓不到最終渲染後的內容，會顯示讀取失敗並附上原因。
- **Vercel 免費方案（Hobby）的 Serverless Function 執行時間上限是 10 秒**，本專案設定的逾時時間（12 秒的抓取 timeout）已經超過這個上限；若要跑得比較穩，建議升級到 Pro 方案，或把 `pages/api/analyze.js` 裡的 `FETCH_TIMEOUT_MS` 調低。
- **同規格比價是「名稱字串比對」**，不是真正理解商品語意，如果兩個網站把同個商品寫成不同名稱，就不會自動歸在同一列。
- **請留意各網站的服務條款與 robots.txt**，避免違反使用規範；本專案只做基本的網頁抓取，沒有繞過任何登入或反爬蟲機制。
- 使用的模型是 `gemini-3.6-flash`（速度快、成本低、結構化提取與聯網能力強），如果需要換模型，可以在 `lib/geminiClient.js` 修改 `EXTRACTION_MODEL`。

## 專案結構

```
pages/
  index.js          前端主畫面（輸入 → 分析中 → 結果頁）
  api/analyze.js     抓取單一網址並用 Gemini Function Calling 擷取優惠資訊
  api/chat.js         AI 對話問答，只根據已分析資料回答
lib/
  extractText.js      HTML 轉純文字工具
  geminiClient.js     Google Gemini API client 共用模組
```
