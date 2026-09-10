import { getGeminiClient, EXTRACTION_MODEL } from "../../lib/geminiClient";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30,
};

const FALLBACK_REPLY =
  "目前提供的網站與搜尋結果中沒有找到相關資訊，請補充更詳細的活動名稱、商品品項或網址。";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: FALLBACK_REPLY });
  }

  const { question, sites } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ reply: FALLBACK_REPLY });
  }

  const genAI = getGeminiClient();
  if (!genAI) {
    return res.status(200).json({
      reply: "尚未設定 GEMINI_API_KEY 環境變數，AI 對話功能無法使用。",
    });
  }

  // 整理已分析網站（包含成功、SPA 空白、或失敗的網站網址）
  const allSites = Array.isArray(sites) ? sites : [];
  const siteDump =
    allSites.length > 0
      ? allSites
          .map((s, idx) => {
            const offerLines = (s.offers || [])
              .map((o) => `  - ${o.title}${o.price ? `（${o.price}）` : ""}${o.desc ? `：${o.desc}` : ""}`)
              .join("\n");
            const productLines = (s.products || [])
              .map((p) => `  - ${p.name}：$${p.price}`)
              .join("\n");
            const noteText = s.note ? `\n  - 爬蟲狀況：${s.note}` : "";
            const statusText = s.status === "failed" ? `\n  - 抓取狀態：失敗（${s.reason || "無法讀取"}）` : "";

            return `【網站 ${idx + 1}：${s.siteName || s.domain || "未命名"}】
- 原始網址：${s.url || s.domain || "無"}
- 網域：${s.domain || "無"}${noteText}${statusText}
- 靜態抓取到的優惠：
${offerLines || "  （無或因 SPA/海報圖片未能直接取得）"}
- 靜態抓取到的商品價格：
${productLines || "  （無或因 SPA/海報圖片未能直接取得）"}`;
          })
          .join("\n\n")
      : "（目前尚未在首頁分析網站，使用者可能在問題中直接提供網址）";

  // 偵測使用者問題中是否包含特定網址
  const urlsInQuestion = question.match(/https?:\/\/[^\s]+/g) || [];
  const urlPrompt =
    urlsInQuestion.length > 0
      ? `\n\n【使用者於問題中附帶指定網址】：\n${urlsInQuestion.join("\n")}\n請特別使用 Google 搜尋工具檢索這些網址的最新活動與優惠資訊。`
      : "";

  try {
    const model = genAI.getGenerativeModel({
      model: EXTRACTION_MODEL,
      tools: [
        {
          googleSearch: {}, // 啟用 Gemini Google Search Grounding 聯網檢索
        },
      ],
      systemInstruction: `你是一個專業、誠實且貼心的商品優惠與比價助理。你具備即時 Google 搜尋聯網工具（googleSearch）。

【任務原則】
1. 結合「使用者提供的網站清單」與使用者當前的「問題」進行回答。
2. 【即時聯網查閱】：
   - 許多購物或超商網站（如萊爾富、7-11、全家、momo 等）會將優惠寫在宣傳海報圖片中，或使用 SPA 動態渲染，靜態爬蟲無法直接抓到純文字。
   - 當靜態抓取資料為空、不齊全，或使用者詢問特定網址/促銷活動（例如代碼 c000330、咖啡買幾送幾、特價折數）時，請**主動使用 Google 搜尋聯網**，查閱該網址或該品牌的最新官方活動公告與優惠細節。
   - 盡可能查出：活動名稱、特惠商品、買幾送幾、原價/特價/平均單杯或單件金額、活動起訖日期與兌換規則。
3. 【嚴禁胡亂編造】：
   - 所有價格與優惠內容必須來自「已分析網站資料」或「Google 搜尋到的真實資訊」，絕對不要憑空捏造金額。
4. 【回答格式】：
   - 請使用繁體中文，重點清晰（可用條列與粗體）。
   - 請註明資料來源（例如：萊爾富官網活動資訊）。
   - 若經過聯網搜尋後仍完全查無任何相關活動，請禮貌回覆「${FALLBACK_REPLY}」。`,
    });

    const prompt = `已分析網站資料：\n\n${siteDump}${urlPrompt}\n\n使用者問題：${question}`;
    const result = await model.generateContent(prompt);

    const reply = result.response.text()?.trim() || FALLBACK_REPLY;

    // 擷取 Google 搜尋的參考來源連結（Grounding Metadata）
    const candidate = result.response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = [];
    const seenUris = new Set();

    for (const chunk of groundingChunks) {
      if (chunk.web?.uri && !seenUris.has(chunk.web.uri)) {
        seenUris.add(chunk.web.uri);
        sources.push({
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }

    return res.status(200).json({ reply, sources });
  } catch (err) {
    console.error("Gemini chat error:", err?.status, err?.message || err);
    return res.status(200).json({
      reply: `AI 回覆時發生錯誤：${err?.message || "請稍後再試"}`,
    });
  }
}

