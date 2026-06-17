"use client";
import React, { useState, useEffect, useRef } from "react";

const C = {
  ink: "#1c2321",
  inkSoft: "#46514d",
  bone: "#f3efe6",
  paper: "#fbf9f3",
  line: "#ddd6c7",
  gold: "#b07d2b",
  goldSoft: "#f0e4c9",
  rust: "#a8472b",
  rustSoft: "#f2dcd1",
  green: "#3d6b4f",
};

const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
const fmtUSDc = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
const num = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
};

export default function LoanLens() {
  const [type, setType] = useState("car");
  const [amount, setAmount] = useState("32000");
  const [down, setDown] = useState("3000");
  const [apr, setApr] = useState("8.9");
  const [years, setYears] = useState("6");
  const [variable, setVariable] = useState(false);
  const [extra, setExtra] = useState("");

  const [facts, setFacts] = useState(null);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, chatLoading]);

  const valid = num(amount) > 0 && num(years) > 0 && num(apr) >= 0;

  async function analyze() {
    setError("");
    setLoading(true);
    setBrief("");
    setChat([]);
    setFacts(null);
    const inputs = {
      amount: num(amount),
      downPayment: num(down),
      apr: num(apr),
      years: num(years),
    };
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, inputs, variable, extra }),
      });
      const data = await res.json();
      if (data.facts) setFacts(data.facts);
      if (data.brief) setBrief(data.brief);
      if (data.error)
        setError(
          data.error +
            (data.facts ? " The figures below are still correct." : "")
        );
    } catch (e) {
      setError("Couldn't reach the server. Try again?");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const q = input.trim();
    if (!q || !facts) return;
    setInput("");
    const next = [...chat, { role: "user", content: q }];
    setChat(next);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts, messages: next }),
      });
      const data = await res.json();
      setChat([
        ...next,
        {
          role: "assistant",
          content: data.reply || data.error || "Something went wrong.",
        },
      ]);
    } catch (e) {
      setChat([
        ...next,
        { role: "assistant", content: "Couldn't reach the server. Try again?" },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  const renderBrief = (text) => {
    const blocks = text.split(/\n(?=## )/);
    return blocks.map((b, i) => {
      const m = b.match(/^##\s+(.*)/);
      const title = m ? m[1].trim() : null;
      const body = b.replace(/^##\s+.*\n?/, "").trim();
      const isRefusal = /can't tell you/i.test(title || "");
      const isWatch = /what to watch/i.test(title || "");
      return (
        <div
          key={i}
          style={{
            marginBottom: 18,
            paddingLeft: 16,
            borderLeft: `2px solid ${
              isRefusal ? C.line : isWatch ? C.rust : C.gold
            }`,
          }}
        >
          {title && (
            <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: isWatch ? C.rust : C.inkSoft, marginBottom: 6 }}>
              {title}
            </div>
          )}
          <div style={{ fontSize: 15, lineHeight: 1.6, color: C.ink }}>
            {body.split("\n").map((line, j) => {
              const isBullet = /^[-*]\s+/.test(line);
              const text2 = line.replace(/^[-*]\s+/, "");
              return (
                <div key={j} style={{ display: "flex", gap: 8, marginBottom: isBullet ? 4 : 8 }}>
                  {isBullet && <span style={{ color: C.rust }}>—</span>}
                  <span>{text2}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  const L = ({ children }) => (
    <label className="mono" style={{ display: "block", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginBottom: 6 }}>
      {children}
    </label>
  );
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.line}`,
    borderRadius: 6,
    background: C.paper,
    fontSize: 15,
    color: C.ink,
    boxSizing: "border-box",
    fontFamily: "'IBM Plex Mono', monospace",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bone, color: C.ink, paddingBottom: 80 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
        <header style={{ borderBottom: `2px solid ${C.ink}`, padding: "40px 0 20px", marginBottom: 32 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: 2, color: C.gold, marginBottom: 8 }}>
            LOAN LENS
          </div>
          <h1 className="display" style={{ fontWeight: 600, fontSize: 40, lineHeight: 1.05, margin: "0 0 10px", letterSpacing: -0.5 }}>
            See what the loan really costs.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: C.inkSoft, maxWidth: 520, margin: 0 }}>
            Enter a car or home loan offer. Get the total cost, the catches, and
            the questions to ask, so you can decide. It won't decide for you.
          </p>
        </header>

        <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["car", "home"].map((t) => (
              <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${type === t ? C.ink : C.line}`, background: type === t ? C.ink : "transparent", color: type === t ? C.paper : C.inkSoft, fontSize: 14, fontWeight: 500, cursor: "pointer", textTransform: "capitalize" }}>
                {t} loan
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div><L>{type === "home" ? "Home price" : "Vehicle price"}</L><input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></div>
            <div><L>Down payment</L><input style={inputStyle} value={down} onChange={(e) => setDown(e.target.value)} inputMode="decimal" /></div>
            <div><L>Interest rate (APR %)</L><input style={inputStyle} value={apr} onChange={(e) => setApr(e.target.value)} inputMode="decimal" /></div>
            <div><L>Term (years)</L><input style={inputStyle} value={years} onChange={(e) => setYears(e.target.value)} inputMode="decimal" /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.inkSoft, marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} />
            This is a variable / adjustable rate
          </label>
          <div style={{ marginBottom: 20 }}>
            <L>Anything else you were quoted? (paste it, optional)</L>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="e.g. 2% prepayment penalty, $1,200 dealer fees, balloon payment at month 60…" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          <button onClick={analyze} disabled={!valid || loading} style={{ width: "100%", padding: "14px 0", borderRadius: 6, border: "none", background: valid ? C.ink : C.line, color: C.paper, fontSize: 15, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed" }}>
            {loading ? "Reading the offer…" : "Read this offer"}
          </button>
        </section>

        {error && (
          <div style={{ background: C.rustSoft, color: C.rust, padding: "12px 16px", borderRadius: 6, fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {facts && (
          <>
            <section style={{ marginBottom: 28 }}>
              <CostBar facts={facts} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: C.line, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", marginTop: 16 }}>
                <Stat label="Monthly payment" value={fmtUSD(facts.monthly_payment)} sub="what the lender shows you" />
                <Stat label="Total interest" value={fmtUSD(facts.total_interest)} sub={`${facts.interest_as_share_of_total} of everything you pay`} accent={C.gold} />
                <Stat label="Total paid back" value={fmtUSD(facts.total_paid_back)} sub={`to borrow ${fmtUSD(facts.amount_financed)}`} />
              </div>
            </section>

            <section style={{ marginBottom: 28 }}>
              {loading && !brief && <div style={{ color: C.inkSoft, fontSize: 15 }}>Writing your brief…</div>}
              {brief && renderBrief(brief)}
            </section>

            <TermTable facts={facts} />

            <section style={{ marginTop: 32, borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
              <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginBottom: 14 }}>
                Ask about this offer
              </div>
              {chat.length === 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {["What if I put more down?", "Is the prepayment penalty a big deal?", "Why is a longer term more expensive?"].map((s) => (
                    <button key={s} onClick={() => setInput(s)} style={{ padding: "7px 12px", borderRadius: 16, border: `1px solid ${C.line}`, background: C.paper, color: C.inkSoft, fontSize: 13, cursor: "pointer" }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                {chat.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div style={{ maxWidth: "82%", padding: "11px 14px", borderRadius: 10, fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", background: m.role === "user" ? C.ink : C.paper, color: m.role === "user" ? C.paper : C.ink, border: m.role === "user" ? "none" : `1px solid ${C.line}` }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && <div style={{ color: C.inkSoft, fontSize: 14 }}>Thinking…</div>}
                <div ref={chatEnd} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, fontFamily: "inherit" }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask anything about this loan…" />
                <button onClick={send} disabled={chatLoading || !input.trim()} style={{ padding: "0 20px", borderRadius: 6, border: "none", background: C.ink, color: C.paper, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  Ask
                </button>
              </div>
            </section>
          </>
        )}

        <footer style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
          Loan Lens decodes a loan offer so you can understand it. It does not
          give financial advice and won't tell you whether to take a loan. That
          depends on your full situation. Figures are computed from the numbers
          you enter and assume a standard fixed-payment loan.
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ background: C.paper, padding: "16px 18px" }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: C.inkSoft, marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: accent || C.ink, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.3 }}>{sub}</div>
    </div>
  );
}

function CostBar({ facts }) {
  const principal = facts.amount_financed;
  const total = facts.total_paid_back;
  const principalPct = total > 0 ? (principal / total) * 100 : 100;
  return (
    <div>
      <div style={{ display: "flex", height: 44, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.line}` }}>
        <div className="mono" style={{ width: `${principalPct}%`, background: C.ink, display: "flex", alignItems: "center", paddingLeft: 12, color: C.paper, fontSize: 12 }}>
          {principalPct > 22 ? "what you borrow" : ""}
        </div>
        <div className="mono" style={{ width: `${100 - principalPct}%`, background: C.gold, display: "flex", alignItems: "center", paddingLeft: 10, color: "#3a2906", fontSize: 12 }}>
          {100 - principalPct > 14 ? "interest" : ""}
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8 }}>
        For every dollar borrowed, you pay back{" "}
        <strong style={{ color: C.gold }}>${facts.payback_per_dollar_borrowed}</strong>.
      </div>
    </div>
  );
}

function TermTable({ facts }) {
  const rows = [
    { years: facts.term_years, monthly: facts.monthly_payment, totalInterest: facts.total_interest, dInterest: 0, isBase: true },
    ...facts.term_alternatives.map((t) => ({ years: t.years, monthly: t.monthly, totalInterest: t.total_interest, dInterest: t.interest_change_vs_chosen })),
  ].sort((a, b) => a.years - b.years);
  return (
    <section style={{ marginBottom: 28 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginBottom: 12 }}>
        Same loan, different terms
      </div>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
        <Row header cells={["Term", "Monthly", "Total interest", "vs. your term"]} />
        {rows.map((t, i) => (
          <Row key={i} base={t.isBase} danger={t.dInterest > 0} good={t.dInterest < 0}
            cells={[`${t.years} yr${t.isBase ? "  ← yours" : ""}`, fmtUSD(t.monthly), fmtUSD(t.totalInterest), t.isBase ? "—" : `${t.dInterest > 0 ? "+" : "−"}${fmtUSD(Math.abs(t.dInterest))}`]} />
        ))}
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>
        A lower monthly payment almost always means more total interest. That
        gap is the trade-off the monthly number hides.
      </div>
    </section>
  );
}

function Row({ cells, header, base, danger, good }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", background: header ? C.bone : base ? C.goldSoft : C.paper, borderTop: header ? "none" : `1px solid ${C.line}` }}>
      {cells.map((c, i) => (
        <div key={i} className={i === 0 && !header ? "" : "mono"} style={{ padding: "11px 14px", fontSize: header ? 10 : 14, letterSpacing: header ? 0.5 : 0, textTransform: header ? "uppercase" : "none", color: header ? C.inkSoft : i === 3 && danger ? C.rust : i === 3 && good ? C.green : C.ink, fontWeight: base && i === 0 ? 600 : 400 }}>
          {c}
        </div>
      ))}
    </div>
  );
}
