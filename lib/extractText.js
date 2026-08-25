import * as cheerio from "cheerio";

// 從原始 HTML 中移除不相關的標籤（script/style/nav 等），
// 只保留看得到的文字內容，並限制長度避免送給模型的內容過長。
export function htmlToReadableText(html, maxLength = 14000) {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg, iframe, nav, footer, header").remove();

  const text = $("body")
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

export function extractTitle(html) {
  const $ = cheerio.load(html);
  return $("title").first().text().trim() || null;
}
