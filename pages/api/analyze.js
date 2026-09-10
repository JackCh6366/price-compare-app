import { htmlToReadableText, extractTitle } from "../../lib/extractText";
import { getGeminiClient, EXTRACTION_MODEL } from "../../lib/geminiClient";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30, // Vercel Pro 以上才吃得到 30 秒；Hobby 方案上限是 10 秒
};

const FETCH_TIMEOUT_MS = 12000;

// Gemini function declaration（等同 Anthropic tool schema）
const EXTRACT_FUNCTION = {
  name: "record_site_offers",
  description:
    "記錄從網頁內容中找到的優惠與商品價格資訊。只能填入網頁內容中實際出現的資料，找不到就回傳空陣列，絕對不能編造或推測價格。",
  parameters: {
    type: "object",
    properties: {
      site_name: {
        type: "string",
        description: "這個網站/商家看起來的名稱，找不到就用空字串",
      },
      offers: {
        type: "array",
        description: "網頁中找到的優惠活動或促銷內容，最多 8 筆",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "優惠名稱" },
            desc: { type: "string", description: "優惠說明，找不到細節可留空字串" },
            price: { type: "string", description: "相關價格文字，例如 $39，找不到就用空字串" },
          },
          required: ["title"],
        },
      },
      products: {
        type: "array",
        description:
          "網頁中找到的具體商品與價格（用於跨網站比價），商品名稱盡量精簡標準化，例如「衛生紙10包裝」「美式咖啡大杯」，最多 12 筆",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: {
              type: "number",
              description: "純數字價格，找不到明確數字就不要加入這筆",
            },
          },
          required: ["name", "price"],
        },
      },
    },
    required: ["offers", "products"],
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "failed", reason: "不支援的方法" });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ status: "failed", reason: "缺少網址" });
  }

  const genAI = getGeminiClient();
  if (!genAI) {
    return res.status(200).json({
      status: "failed",
      url,
      reason: "尚未設定 GEMINI_API_KEY 環境變數，無法進行內容解析",
    });
  }

  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;

  let domain = normalizedUrl;
  try {
    domain = new URL(normalizedUrl).hostname.replace(/^www\./, "");
  } catch {
    return res.status(200).json({ status: "failed", url, reason: "網址格式不正確" });
  }

  // 第一步：抓取原始網頁內容
  let html;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-TW,zh;q=0.9",
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return res.status(200).json({
        status: "failed",
        url,
        domain,
        reason: `網站回應錯誤（HTTP ${resp.status}），可能有反爬蟲保護或網址已失效`,
      });
    }
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return res.status(200).json({
        status: "failed",
        url,
        domain,
        reason: "此網址回傳的不是網頁內容（非 text/html），無法解析",
      });
    }
    html = await resp.text();
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    return res.status(200).json({
      status: "failed",
      url,
      domain,
      reason: timedOut
        ? "讀取逾時，網站回應太慢或無法連線"
        : "無法連線到此網址，可能被防火牆／反爬蟲機制阻擋",
    });
  }

  // 第二步：把可讀文字丟給模型做結構化擷取
  const pageText = htmlToReadableText(html);
  const pageTitle = extractTitle(html);

  if (!pageText || pageText.length < 20) {
    return res.status(200).json({
      status: "success",
      url,
      domain,
      siteName: pageTitle || domain,
      offers: [],
      products: [],
      note: "已成功讀取網頁，但頁面幾乎沒有可辨識的文字內容（可能是純圖片或需要登入才能看到的頁面）",
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: EXTRACTION_MODEL,
      tools: [{ functionDeclarations: [EXTRACT_FUNCTION] }],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["record_site_offers"],
        },
      },
      systemInstruction:
        "你是一個嚴謹的網頁優惠資訊擷取助手。只能根據使用者提供的網頁文字內容填寫工具參數，絕對不能自行編造、推測或補全任何價格與優惠。如果網頁內容中沒有明確的商品、價格或優惠資訊，offers 與 products 就回傳空陣列。",
    });

    const result = await model.generateContent(
      `以下是網站「${domain}」的網頁文字內容（節錄），請擷取其中的優惠活動與商品價格資訊：\n\n${pageText}`
    );

    const response = result.response;
    const candidate = response.candidates?.[0];
    const functionCall = candidate?.content?.parts?.find((p) => p.functionCall)?.functionCall;
    const parsed = functionCall?.args || { offers: [], products: [] };

    return res.status(200).json({
      status: "success",
      url,
      domain,
      siteName: parsed.site_name || pageTitle || domain,
      offers: Array.isArray(parsed.offers) ? parsed.offers.slice(0, 8) : [],
      products: Array.isArray(parsed.products) ? parsed.products.slice(0, 12) : [],
    });
  } catch (err) {
    console.error("Gemini extraction error for", domain, ":", err?.status, err?.message || err);
    return res.status(200).json({
      status: "failed",
      url,
      domain,
      reason: `模型解析網頁內容時發生錯誤：${err?.status ? `HTTP ${err.status} ` : ""}${err?.message || "未知錯誤"}`,
    });
  }
}