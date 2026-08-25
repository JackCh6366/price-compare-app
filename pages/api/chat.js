import { getAnthropicClient, EXTRACTION_MODEL } from "../../lib/anthropicClient";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30,
};

const FALLBACK_REPLY =
  "目前提供的網站中沒有找到相關資訊，請補充更詳細內容或新增網站。";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: FALLBACK_REPLY });
  }

  const { question, sites } = req.body || {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ reply: FALLBACK_REPLY });
  }

  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return res.status(200).json({
      reply: "尚未設定 ANTHROPIC_API_KEY 環境變數，AI 對話功能無法使用。",
    });
  }

  const usableSites = (Array.isArray(sites) ? sites : []).filter(
    (s) => (s.offers && s.offers.length) || (s.products && s.products.length)
  );

  if (usableSites.length === 0) {
    return res.status(200).json({ reply: FALLBACK_REPLY });
  }

  const dataDump = usableSites
    .map((s) => {
      const offerLines = (s.offers || [])
        .map((o) => `  - ${o.title}${o.price ? `（${o.price}）` : ""}${o.desc ? `：${o.desc}` : ""}`)
        .join("\n");
      const productLines = (s.products || [])
        .map((p) => `  - ${p.name}：$${p.price}`)
        .join("\n");
      return `【${s.siteName || s.domain}】(${s.domain})\n優惠：\n${offerLines || "  （無）"}\n商品價格：\n${productLines || "  （無）"}`;
    })
    .join("\n\n");

  try {
    const message = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 500,
      system: `你是一個誠實的比價助手。只能根據使用者提供的「已分析網站資料」回答問題，絕對不能編造任何價格或優惠內容。
規則：
1. 如果資料中找不到使用者問題相關的資訊，必須明確回覆：「${FALLBACK_REPLY}」，不要嘗試用常識猜測答案。
2. 回答時請指出資料來源是哪個網站。
3. 回答使用繁體中文，語氣簡潔直接，不要加不必要的開場白。`,
      messages: [
        {
          role: "user",
          content: `已分析網站資料：\n\n${dataDump}\n\n使用者問題：${question}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const reply = textBlock?.text?.trim() || FALLBACK_REPLY;
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(200).json({ reply: "AI 回覆時發生錯誤，請稍後再試。" });
  }
}
