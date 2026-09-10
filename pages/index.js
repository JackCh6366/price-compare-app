import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Send,
  Tags,
  Scale,
  MessageCircle,
  RotateCcw,
  AlertTriangle,
  Bot,
  User,
  Link2,
  Sparkles,
} from "lucide-react";

const FALLBACK_REPLY = "目前提供的網站中沒有找到相關資訊，請補充更詳細內容或新增網站。";

function isValidUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const pattern = /^(https?:\/\/)?([\w-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/i;
  return pattern.test(trimmed);
}

function splitPasted(text) {
  return text
    .split(/[\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeProductName(name) {
  return (name || "").replace(/\s+/g, "").trim();
}

export default function Home() {
  const [view, setView] = useState("input"); // input | analyzing | result
  const [urls, setUrls] = useState(Array(10).fill(""));
  const [visibleCount, setVisibleCount] = useState(5);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("offers");

  const handleUrlChange = (index, value) => {
    setUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  useEffect(() => {
    if (visibleCount < 10 && urls[visibleCount - 1]?.trim()) {
      setVisibleCount((v) => Math.min(10, v + 1));
    }
  }, [urls, visibleCount]);

  const handlePaste = (index, e) => {
    const text = e.clipboardData.getData("text");
    const lines = splitPasted(text);
    if (lines.length <= 1) return;
    e.preventDefault();
    setUrls((prev) => {
      const next = [...prev];
      let cursor = index;
      for (const line of lines) {
        if (cursor >= 10) break;
        next[cursor] = line;
        cursor += 1;
      }
      return next;
    });
    setVisibleCount((v) => Math.min(10, Math.max(v, Math.min(10, index + lines.length + 1))));
  };

  const validUrls = urls.slice(0, visibleCount).filter((u) => isValidUrl(u));
  const canAnalyze = validUrls.length >= 1;

  const startAnalysis = async () => {
    const targets = urls.filter((u) => isValidUrl(u));
    setProgress({ done: 0, total: targets.length });
    setResults(targets.map((u) => ({ url: u, status: "pending" })));
    setView("analyzing");

    await Promise.allSettled(
      targets.map(async (u, i) => {
        try {
          const resp = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: u }),
          });
          const data = await resp.json();
          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], ...data };
            return next;
          });
        } catch {
          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: "failed", reason: "呼叫分析服務失敗，請確認網路連線" };
            return next;
          });
        } finally {
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      })
    );

    setActiveTab("offers");
    setView("result");
  };

  const resetAll = () => {
    setUrls(Array(10).fill(""));
    setVisibleCount(5);
    setResults([]);
    setProgress({ done: 0, total: 0 });
    setView("input");
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {view === "input" && (
        <InputView
          urls={urls}
          visibleCount={visibleCount}
          onChange={handleUrlChange}
          onPaste={handlePaste}
          onAnalyze={startAnalysis}
          canAnalyze={canAnalyze}
          validCount={validUrls.length}
        />
      )}
      {view === "analyzing" && <AnalyzingView progress={progress} results={results} />}
      {view === "result" && (
        <ResultView results={results} activeTab={activeTab} setActiveTab={setActiveTab} onReset={resetAll} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function InputView({ urls, visibleCount, onChange, onPaste, onAnalyze, canAnalyze, validCount }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "#14532D",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Tags size={18} color="#F5F5EF" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, color: "#14532D" }}>
          比價收據 PriceReceipt
        </span>
      </div>

      <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.4, margin: "8px 0" }}>
        貼上網址，讓 AI
        <br />
        幫你讀出真的優惠
      </h1>
      <p style={{ color: "#5B5E56", fontSize: 15, lineHeight: 1.8, marginBottom: 12 }}>
        貼上最多 10 個購物網站的網址，系統會實際讀取網頁內容，交給 AI 整理成優惠清單與比價表，
        並且可以直接開口問。找不到的資訊會誠實告知，不會編造價格。
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          background: "#FAEEDA",
          border: "1px solid #F0D9A6",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 24,
        }}
      >
        <AlertTriangle size={15} color="#854F0B" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 12.5, color: "#854F0B", margin: 0, lineHeight: 1.6 }}>
          部分網站有反爬蟲保護或內容由 JavaScript 動態載入，讀取可能會失敗；請確認你有權限存取所貼上的網址內容。
        </p>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4E1D5",
          borderRadius: 16,
          padding: "24px 20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#5B5E56" }}>
            網站網址（可一次貼上多行，自動分配）
          </span>
          <span className="mono" style={{ fontSize: 12, color: "#9A9688" }}>
            {visibleCount}/10 欄
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {urls.slice(0, visibleCount).map((val, i) => {
            const filled = val.trim().length > 0;
            const ok = filled && isValidUrl(val);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono" style={{ width: 22, fontSize: 12, color: "#9A9688", textAlign: "right", flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ position: "relative", flex: 1 }}>
                  <Link2
                    size={15}
                    color={ok ? "#14532D" : "#B4B0A2"}
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    value={val}
                    onChange={(e) => onChange(i, e.target.value)}
                    onPaste={(e) => onPaste(i, e)}
                    placeholder={i === 0 ? "https://example-shop.com/promo" : "https://..."}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 36px",
                      borderRadius: 10,
                      border: `1px solid ${filled && !ok ? "#D85A30" : "#E4E1D5"}`,
                      fontSize: 14,
                      background: "#FBFAF6",
                    }}
                  />
                </div>
                {filled &&
                  (ok ? (
                    <CheckCircle2 size={16} color="#14532D" style={{ flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle size={16} color="#D85A30" style={{ flexShrink: 0 }} />
                  ))}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: "#9A9688", marginTop: 14, lineHeight: 1.6 }}>
          填滿目前最後一欄會自動多開一欄，最多可展開到 10 個網址。
        </p>
      </div>

      <button
        onClick={onAnalyze}
        disabled={!canAnalyze}
        style={{
          marginTop: 24,
          width: "100%",
          padding: "16px 0",
          borderRadius: 12,
          border: "none",
          background: canAnalyze ? "#14532D" : "#D8D5C9",
          color: canAnalyze ? "#F5F5EF" : "#9A9688",
          fontSize: 16,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: canAnalyze ? "pointer" : "not-allowed",
        }}
      >
        <Search size={18} />
        開始分析{canAnalyze ? `（${validCount} 個網址）` : ""}
      </button>
      {!canAnalyze && (
        <p style={{ textAlign: "center", fontSize: 12, color: "#9A9688", marginTop: 8 }}>
          請至少輸入 1 個有效網址
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AnalyzingView({ progress, results }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "72px 20px", textAlign: "center" }}>
      <Loader2 size={34} color="#14532D" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 20 }}>正在讀取並整理各站內容</h2>
      <p style={{ color: "#5B5E56", fontSize: 14, marginTop: 6 }}>
        已完成 <span className="mono" style={{ fontWeight: 700 }}>{progress.done}</span> /{" "}
        <span className="mono" style={{ fontWeight: 700 }}>{progress.total}</span> 個網站
      </p>

      <div style={{ background: "#E4E1D5", borderRadius: 999, height: 8, marginTop: 20, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#14532D", transition: "width .4s ease" }} />
      </div>

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "#FFFFFF",
              border: "1px solid #E4E1D5",
              borderRadius: 10,
            }}
          >
            {(!r.status || r.status === "pending") && (
              <Loader2 size={15} color="#9A9688" style={{ animation: "spin 1s linear infinite" }} />
            )}
            {r.status === "success" && <CheckCircle2 size={15} color="#14532D" />}
            {r.status === "failed" && <XCircle size={15} color="#D85A30" />}
            <span
              className="mono"
              style={{ fontSize: 13, color: "#5B5E56", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {r.domain || r.url}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#9A9688" }}>
              {!r.status || r.status === "pending" ? "讀取中…" : r.status === "success" ? "已完成" : "讀取失敗"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ResultView({ results, activeTab, setActiveTab, onReset }) {
  const successResults = results.filter((r) => r.status === "success");

  const tabs = [
    { key: "offers", label: "優惠內容列表", icon: Tags },
    { key: "compare", label: "同規格商品比價", icon: Scale },
    { key: "chat", label: "AI 對話", icon: MessageCircle },
  ];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>分析結果</h2>
          <p style={{ color: "#5B5E56", fontSize: 13, marginTop: 4 }}>
            共 {results.length} 個網站，成功讀取 {successResults.length} 個
          </p>
        </div>
        <button
          onClick={onReset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #E4E1D5",
            background: "#FFFFFF",
            fontSize: 13,
            color: "#5B5E56",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <RotateCcw size={14} />
          重新輸入
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              background: r.status === "success" ? "#EAF3DE" : "#FAECE7",
              color: r.status === "success" ? "#27500A" : "#993C1D",
            }}
            title={r.status === "failed" ? r.reason : undefined}
          >
            {r.status === "success" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            <span className="mono">{r.domain || r.url}</span>
            {r.status === "success" && <span style={{ opacity: 0.7 }}>· {r.siteName}</span>}
            {r.status === "failed" && <span style={{ opacity: 0.7 }}>· {r.reason}</span>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #E4E1D5", marginBottom: 24 }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                borderBottom: active ? "2px solid #14532D" : "2px solid transparent",
                color: active ? "#14532D" : "#9A9688",
                fontWeight: active ? 700 : 500,
                fontSize: 14,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "offers" && <OffersTab successResults={successResults} />}
      {activeTab === "compare" && <CompareTab successResults={successResults} />}
      {activeTab === "chat" && <ChatTab results={results} successResults={successResults} />}
    </div>
  );
}

/* ---- 優惠內容列表 ---- */

function OffersTab({ successResults }) {
  if (successResults.length === 0) {
    return <EmptyState text="目前沒有成功讀取的網站，請返回重新輸入或更換網址。" />;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
      {successResults.map((r, i) => (
        <div key={i}>
          <div
            style={{
              background: "#FFFFFF",
              border: "1px dashed #C9C6B8",
              borderRadius: "10px",
              padding: "18px 18px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{r.siteName}</span>
              <span className="mono" style={{ fontSize: 11, color: "#9A9688" }}>
                {r.domain}
              </span>
            </div>
            <div style={{ borderTop: "1px dashed #D8D5C9", margin: "10px 0" }} />
            {r.offers && r.offers.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {r.offers.map((o, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{o.title}</p>
                      {o.desc && <p style={{ fontSize: 12, color: "#8A8A80", margin: "2px 0 0" }}>{o.desc}</p>}
                    </div>
                    {o.price && (
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {o.price}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "#9A9688" }}>
                {r.note || "AI 沒有在這個網站上讀到明確的優惠資訊。"}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- 同規格商品比價 ---- */

function CompareTab({ successResults }) {
  const groups = {};
  successResults.forEach((r) => {
    (r.products || []).forEach((p) => {
      const key = normalizeProductName(p.name);
      if (!key) return;
      if (!groups[key]) groups[key] = { name: p.name, entries: [] };
      groups[key].entries.push({ site: r, price: p.price });
    });
  });
  const groupList = Object.values(groups);
  const comparable = groupList.filter((g) => g.entries.length > 1);
  const soloList = groupList.filter((g) => g.entries.length === 1);

  if (successResults.length === 0) {
    return <EmptyState text="目前沒有成功讀取的網站，請返回重新輸入或更換網址。" />;
  }
  if (groupList.length === 0) {
    return <EmptyState text="AI 沒有從目前的網站中讀到可比對的商品價格資料。" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {comparable.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: 12.5, color: "#9A9688", marginBottom: 10 }}>
            以下商品在 2 個以上網站中出現名稱相符的資料，自動列出比價：
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr>
                <th style={cellStyle(true)}>商品</th>
                <th style={cellStyle(true)}>各站價格</th>
              </tr>
            </thead>
            <tbody>
              {comparable.map((g, i) => {
                const min = Math.min(...g.entries.map((e) => e.price));
                return (
                  <tr key={i}>
                    <td style={cellStyle(false)}>{g.name}</td>
                    <td style={cellStyle(false)}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {g.entries.map((e, j) => (
                          <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                            <span style={{ fontSize: 11, color: "#9A9688" }}>{e.site.siteName}</span>
                            <span className="mono" style={{ fontWeight: 700 }}>
                              ${e.price}
                              {e.price === min && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#994919",
                                    background: "#FAEEDA",
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                  }}
                                >
                                  最優惠
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: "#9A9688" }}>
          各站商品命名不同，目前還沒有自動比對到相同商品，以下列出各站個別價格：
        </p>
      )}

      {soloList.length > 0 && (
        <div>
          <p style={{ fontSize: 12.5, color: "#9A9688", marginBottom: 10 }}>其他只在單一網站出現的商品：</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {soloList.map((g, i) => (
              <div key={i} style={{ border: "1px solid #E4E1D5", borderRadius: 10, padding: "10px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{g.name}</p>
                <p style={{ fontSize: 11, color: "#9A9688", margin: "2px 0 6px" }}>{g.entries[0].site.siteName}</p>
                <span className="mono" style={{ fontWeight: 700 }}>${g.entries[0].price}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function cellStyle(isHeader) {
  return {
    textAlign: "left",
    padding: "12px 14px",
    borderBottom: "1px solid #E4E1D5",
    background: isHeader ? "#FBFAF6" : "#FFFFFF",
    fontWeight: isHeader ? 700 : 400,
    fontSize: 13,
    verticalAlign: "top",
  };
}

/* ---- AI 對話 ---- */

function ChatTab({ results = [], successResults = [] }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "您好，我是比價小幫手！我具備即時 Google 搜尋聯網能力，您可以問我目前網站中的促銷細節、或貼上特定網址／活動詢問（例如萊爾富咖啡優惠）喔！",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setThinking(true);
    try {
      const allSites = results && results.length > 0 ? results : successResults;
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          sites: allSites.map((r) => ({
            url: r.url,
            domain: r.domain,
            siteName: r.siteName,
            offers: r.offers,
            products: r.products,
            note: r.note,
            status: r.status,
            reason: r.reason,
          })),
        }),
      });
      const data = await resp.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply || FALLBACK_REPLY,
          sources: data.sources || [],
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "呼叫 AI 對話服務失敗，請稍後再試。" }]);
    } finally {
      setThinking(false);
    }
  }, [input, results, successResults]);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4E1D5",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        height: 520,
        maxHeight: "75vh",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} text={m.text} sources={m.sources} />
        ))}
        {thinking && <ChatBubble role="assistant" text="正在檢索分析與聯網搜尋中…" thinking />}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop: "1px solid #E4E1D5", padding: 12, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="例如：大杯拿鐵有什麼優惠？或貼入促銷網址查詢"
          style={{ flex: 1, border: "1px solid #E4E1D5", borderRadius: 10, padding: "10px 14px", fontSize: 14, background: "#FBFAF6" }}
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          style={{
            width: 42,
            borderRadius: 10,
            border: "none",
            background: input.trim() ? "#14532D" : "#D8D5C9",
            color: "#F5F5EF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: input.trim() ? "pointer" : "not-allowed",
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ role, text, thinking, sources = [] }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", gap: 8, flexDirection: isUser ? "row-reverse" : "row" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          background: isUser ? "#E4E1D5" : "#14532D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isUser ? <User size={14} color="#5B5E56" /> : <Bot size={14} color="#F5F5EF" />}
      </div>
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: 12,
          fontSize: 13.5,
          lineHeight: 1.6,
          background: isUser ? "#14532D" : "#F5F5EF",
          color: isUser ? "#F5F5EF" : "#1C1E1B",
          opacity: thinking ? 0.6 : 1,
        }}
      >
        <div style={{ whiteSpace: "pre-line" }}>{text}</div>
        {!isUser && sources && sources.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #D8D5C9", fontSize: 12 }}>
            <span style={{ color: "#777468", fontWeight: 600 }}>🌐 即時參考來源：</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {sources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "#FFFFFF",
                    border: "1px solid #D8D5C9",
                    color: "#14532D",
                    textDecoration: "none",
                    fontSize: 11.5,
                  }}
                >
                  <Link2 size={11} />
                  <span>{s.title || s.uri}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: "#9A9688", border: "1px dashed #D8D5C9", borderRadius: 14, fontSize: 14 }}>
      <Sparkles size={22} style={{ marginBottom: 10 }} />
      <p>{text}</p>
    </div>
  );
}
