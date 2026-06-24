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
  greenSoft: "#dfe9e1",
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

// Inline markdown: turn **bold** into actual bold text instead of leaking the
// literal asterisks onto the screen. The model writes proper markdown; this is
// the small translation step that was missing.
function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

// Shared label + input styling, used by every form field.
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

// Renders a brief / comparison that uses the ## section headers. Shared by the
// single-offer brief and the comparison summary, so bold and section styling
// stay consistent. renderInline handles **bold** inside each line.
function renderBrief(text) {
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
          {body.split("\n").filter((line) => !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())).map((line, j) => {
            const isBullet = /^[-*]\s+/.test(line);
            const text2 = line.replace(/^[-*]\s+/, "");
            return (
              <div key={j} style={{ display: "flex", gap: 8, marginBottom: isBullet ? 4 : 8 }}>
                {isBullet && <span style={{ color: C.rust }}>•</span>}
                <span>{renderInline(text2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  });
}

// One offer's input fields. Used by both the single-offer form and each card in
// the compare view, so there is one source of truth for what an offer looks
// like. `offer` is the object; `onChange` receives the whole updated object.
function OfferFields({ offer, onChange, showName, showTypeToggle = true, loanType }) {
  const set = (patch) => onChange({ ...offer, ...patch });
  // In compare mode the loan type is shared and passed in; otherwise it lives
  // on the offer and the per-offer toggle controls it.
  const type = loanType || offer.type;
  return (
    <>
      {showName && (
        <div style={{ marginBottom: 16 }}>
          <L>Name this offer (optional)</L>
          <input style={inputStyle} value={offer.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Credit union" />
        </div>
      )}
      {showTypeToggle && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["car", "home"].map((t) => (
            <button key={t} onClick={() => set({ type: t })} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${offer.type === t ? C.ink : C.line}`, background: offer.type === t ? C.ink : "transparent", color: offer.type === t ? C.paper : C.inkSoft, fontSize: 14, fontWeight: 500, cursor: "pointer", textTransform: "capitalize" }}>
              {t} loan
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div><L>{type === "home" ? "Home price" : "Vehicle price"}</L><input style={inputStyle} value={offer.amount} onChange={(e) => set({ amount: e.target.value })} inputMode="decimal" /></div>
        <div><L>Down payment</L><input style={inputStyle} value={offer.down} onChange={(e) => set({ down: e.target.value })} inputMode="decimal" /></div>
        <div><L>Interest rate (APR %)</L><input style={inputStyle} value={offer.apr} onChange={(e) => set({ apr: e.target.value })} inputMode="decimal" /></div>
        <div><L>Term (years)</L><input style={inputStyle} value={offer.years} onChange={(e) => set({ years: e.target.value })} inputMode="decimal" /></div>
      </div>
      {type === "home" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div><L>Annual property tax (optional)</L><input style={inputStyle} value={offer.propertyTax} onChange={(e) => set({ propertyTax: e.target.value })} inputMode="decimal" placeholder="blank = est. 1.1% of price" /></div>
          <div><L>Annual home insurance (optional)</L><input style={inputStyle} value={offer.homeInsurance} onChange={(e) => set({ homeInsurance: e.target.value })} inputMode="decimal" placeholder="blank = est. $1,500" /></div>
        </div>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.inkSoft, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={offer.variable} onChange={(e) => set({ variable: e.target.checked })} />
        This is a variable / adjustable rate
      </label>
      <div>
        <L>Anything else you were quoted? (paste it, optional)</L>
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} placeholder="e.g. 2% prepayment penalty, $1,200 dealer fees, balloon payment at month 60…" value={offer.extra} onChange={(e) => set({ extra: e.target.value })} />
      </div>
    </>
  );
}

const blankOffer = () => ({ type: "car", amount: "", down: "", apr: "", years: "", variable: false, extra: "", label: "", propertyTax: "", homeInsurance: "" });
const offerValid = (o) => num(o.amount) > 0 && num(o.years) > 0 && num(o.apr) >= 0;
// typeOverride lets compare mode force a shared loan type across all offers.
const toPayload = (o, typeOverride) => ({
  type: typeOverride || o.type,
  variable: o.variable,
  extra: o.extra,
  label: o.label,
  inputs: {
    amount: num(o.amount),
    downPayment: num(o.down),
    apr: num(o.apr),
    years: num(o.years),
    propertyTax: num(o.propertyTax),
    homeInsurance: num(o.homeInsurance),
  },
});

export default function LoanLens() {
  const [mode, setMode] = useState("single"); // "single" | "compare"

  // Single-offer state. One offer object, fed to the shared OfferFields.
  const [single, setSingle] = useState({ type: "car", amount: "32000", down: "3000", apr: "8.9", years: "6", variable: false, extra: "", label: "", propertyTax: "", homeInsurance: "" });
  const [facts, setFacts] = useState(null);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEnd = useRef(null);

  // Compare state. All offers share one loan type (compare like with like).
  // 2 to 3 offers, prefilled so the idea is obvious.
  const [compareType, setCompareType] = useState("car");
  const [offers, setOffers] = useState([
    { ...blankOffer(), amount: "32000", down: "3000", apr: "8.9", years: "6", label: "Dealer" },
    { ...blankOffer(), amount: "32000", down: "3000", apr: "6.4", years: "5", label: "Credit union" },
  ]);
  const [comparison, setComparison] = useState(null);
  const [summary, setSummary] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, chatLoading]);

  const valid = offerValid(single);
  const canCompare = offers.length >= 2 && offers.every(offerValid);

  async function analyze() {
    setError("");
    setLoading(true);
    setBrief("");
    setChat([]);
    setFacts(null);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(single)),
      });
      const data = await res.json();
      if (data.facts) setFacts(data.facts);
      if (data.brief) setBrief(data.brief);
      if (data.error)
        setError(data.error + (data.facts ? " The figures below are still correct." : ""));
    } catch (e) {
      setError("Couldn't reach the server. Try again?");
    } finally {
      setLoading(false);
    }
  }

  async function runCompare() {
    setCompareError("");
    setCompareLoading(true);
    setComparison(null);
    setSummary("");
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offers: offers.map((o) => toPayload(o, compareType)) }),
      });
      const data = await res.json();
      if (data.comparison) setComparison(data.comparison);
      if (data.summary) setSummary(data.summary);
      if (data.error)
        setCompareError(data.error + (data.comparison ? " The figures below are still correct." : ""));
    } catch (e) {
      setCompareError("Couldn't reach the server. Try again?");
    } finally {
      setCompareLoading(false);
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
        { role: "assistant", content: data.reply || data.error || "Something went wrong." },
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

  function updateOffer(i, next) {
    setOffers((prev) => prev.map((o, j) => (j === i ? next : o)));
  }
  function addOffer() {
    setOffers((prev) => (prev.length >= 3 ? prev : [...prev, blankOffer()]));
  }
  function removeOffer(i) {
    setOffers((prev) => (prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)));
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bone, color: C.ink, paddingBottom: 80 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>
        <header style={{ borderBottom: `2px solid ${C.ink}`, padding: "40px 0 20px", marginBottom: 28 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: 2, color: C.gold, marginBottom: 8 }}>
            LOAN LENS
          </div>
          <h1 className="display" style={{ fontWeight: 600, fontSize: 40, lineHeight: 1.05, margin: "0 0 10px", letterSpacing: -0.5 }}>
            See what a loan really costs.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, color: C.inkSoft, maxWidth: 520, margin: 0 }}>
            Enter a car or home loan offer. See the total cost over its life,
            where your rate sits, and the terms worth questioning before you sign.
          </p>
        </header>

        {/* Mode switch: one offer, or compare a few side by side. */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            ["single", "Analyze one offer"],
            ["compare", "Compare offers"],
          ].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "11px 0", borderRadius: 6, border: `1px solid ${mode === m ? C.ink : C.line}`, background: mode === m ? C.ink : "transparent", color: mode === m ? C.paper : C.inkSoft, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {mode === "single" && (
          <>
            <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: 24, marginBottom: 28 }}>
              <OfferFields offer={single} onChange={setSingle} />
              <button onClick={analyze} disabled={!valid || loading} style={{ width: "100%", marginTop: 20, padding: "14px 0", borderRadius: 6, border: "none", background: valid ? C.ink : C.line, color: C.paper, fontSize: 15, fontWeight: 600, cursor: valid ? "pointer" : "not-allowed" }}>
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

                {facts.home_costs && <HomeCostBreakdown hc={facts.home_costs} />}
                {facts.rate_comparison && <RateCompare rc={facts.rate_comparison} type={facts.loan_type} />}
                {facts.underwater && (
                  <NegativeEquityPanel uw={facts.underwater} price={facts.price} down={facts.down_payment} years={facts.term_years} />
                )}

                <TermTable facts={facts} />

                <section style={{ marginBottom: 28 }}>
                  {loading && !brief && <div style={{ color: C.inkSoft, fontSize: 15 }}>Writing your brief…</div>}
                  {brief && renderBrief(brief)}
                  {facts.extra_terms_user_pasted === "(none provided)" && (
                    <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 12 }}>
                      You did not paste any fees or add-ons. If your offer includes them, paste them above for a sharper read.
                    </div>
                  )}
                </section>

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
          </>
        )}

        {mode === "compare" && (
          <>
            {/* One loan type for the whole comparison: always compare like with like. */}
            <div style={{ marginBottom: 20 }}>
              <L>Loan type for all offers</L>
              <div style={{ display: "flex", gap: 8 }}>
                {["car", "home"].map((t) => (
                  <button key={t} onClick={() => setCompareType(t)} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: `1px solid ${compareType === t ? C.ink : C.line}`, background: compareType === t ? C.ink : "transparent", color: compareType === t ? C.paper : C.inkSoft, fontSize: 14, fontWeight: 500, cursor: "pointer", textTransform: "capitalize" }}>
                    {t} loan
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
              {offers.map((o, i) => (
                <section key={i} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: 24, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.gold }}>
                      Offer {String.fromCharCode(65 + i)}
                    </div>
                    {offers.length > 2 && (
                      <button onClick={() => removeOffer(i)} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 13, cursor: "pointer" }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <OfferFields offer={o} onChange={(next) => updateOffer(i, next)} showName showTypeToggle={false} loanType={compareType} />
                </section>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {offers.length < 3 && (
                <button onClick={addOffer} style={{ flex: "0 0 auto", padding: "12px 18px", borderRadius: 6, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                  + Add another offer
                </button>
              )}
              <button onClick={runCompare} disabled={!canCompare || compareLoading} style={{ flex: 1, padding: "14px 0", borderRadius: 6, border: "none", background: canCompare ? C.ink : C.line, color: C.paper, fontSize: 15, fontWeight: 600, cursor: canCompare ? "pointer" : "not-allowed" }}>
                {compareLoading ? "Comparing…" : "Compare these offers"}
              </button>
            </div>

            {compareError && (
              <div style={{ background: C.rustSoft, color: C.rust, padding: "12px 16px", borderRadius: 6, fontSize: 14, marginBottom: 20 }}>
                {compareError}
              </div>
            )}

            {comparison && (
              <>
                <CompareHeadline comparison={comparison} />
                <CompareTable comparison={comparison} />
                <section style={{ marginBottom: 28 }}>
                  {compareLoading && !summary && <div style={{ color: C.inkSoft, fontSize: 15 }}>Writing the comparison…</div>}
                  {summary && renderBrief(summary)}
                </section>
              </>
            )}
          </>
        )}

        <footer style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
          Loan Lens decodes a loan offer so you can understand it. It does not
          give financial advice and won't tell you whether to take a loan or
          which offer to choose. That depends on your full situation. Figures are
          computed from the numbers you enter and assume a standard fixed-payment
          loan. Car and home loans only, in US dollars.
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

// The objective "which costs least" statement. The ranking comes from the
// server (code), not the model. It is a cost fact, not a recommendation.
function CompareHeadline({ comparison }) {
  const cheap = comparison.cheapest_by_total_cost;
  const gap = comparison.total_cost_gap;
  return (
    <section style={{ background: C.greenSoft, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: C.ink }}>
        <strong>{cheap.label}</strong> costs the least over its life, at{" "}
        <strong>{fmtUSD(cheap.total_paid_back)}</strong> paid back in total
        {gap > 0 ? <>, {fmtUSD(gap)} less than the most expensive option.</> : "."}
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
        This is the total dollars paid, an objective fact. It is not advice on
        which offer to take. That depends on your situation.
      </div>
    </section>
  );
}

// Side-by-side table: one column per offer, the cheapest total highlighted.
function CompareTable({ comparison }) {
  const offers = comparison.offers;
  const cheapTotalIdx = comparison.cheapest_by_total_cost.index;
  const cheapMonthlyIdx = comparison.cheapest_by_monthly_payment.index;
  const isHome = offers.every((o) => o.loan_type === "home");
  const hasRateRef = offers.some((o) => o.rate_position);
  const rows = [
    { label: "Monthly (principal + interest)", get: (o) => fmtUSD(o.monthly_payment), highlight: cheapMonthlyIdx, note: "lowest monthly" },
    // Home only: the true monthly cost including taxes, insurance, and PMI.
    ...(isHome
      ? [{ label: "True monthly (tax, ins, PMI)", get: (o) => (o.true_monthly_piti != null ? fmtUSD(o.true_monthly_piti) : "—") }]
      : []),
    { label: "Total cost (life of loan)", get: (o) => fmtUSD(o.total_paid_back), highlight: cheapTotalIdx, note: "costs least" },
    { label: "Total interest", get: (o) => fmtUSD(o.total_interest) },
    { label: "Amount financed", get: (o) => fmtUSD(o.amount_financed) },
    { label: "APR", get: (o) => `${o.apr_percent}%` },
    // Where each rate sits versus the dated typical range (code-decided).
    ...(hasRateRef
      ? [{ label: "Rate vs typical", get: (o) => (o.rate_position ? o.rate_position.position : "—") }]
      : []),
    { label: "Term", get: (o) => `${o.term_years} yr` },
    { label: "Type", get: (o) => (o.loan_type === "home" ? "Home" : "Car") + (o.is_variable_rate ? ", variable" : "") },
  ];
  const cols = `1.2fr ${offers.map(() => "1fr").join(" ")}`;
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
        {/* Header row with offer names. */}
        <div style={{ display: "grid", gridTemplateColumns: cols, background: C.bone }}>
          <div className="mono" style={{ padding: "11px 14px", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: C.inkSoft }}>
            Offer
          </div>
          {offers.map((o, i) => (
            <div key={i} style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: C.ink, background: i === cheapTotalIdx ? C.greenSoft : "transparent" }}>
              {o.label}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={ri} style={{ display: "grid", gridTemplateColumns: cols, borderTop: `1px solid ${C.line}` }}>
            <div style={{ padding: "11px 14px", fontSize: 13, color: C.inkSoft }}>
              {r.label}
            </div>
            {offers.map((o, i) => {
              const isHi = r.highlight === i;
              return (
                <div key={i} className="mono" style={{ padding: "11px 14px", fontSize: 14, color: isHi ? C.green : C.ink, fontWeight: isHi ? 600 : 400, background: r.highlight !== undefined && i === r.highlight ? C.greenSoft : i === cheapTotalIdx ? "rgba(223,233,225,0.35)" : "transparent" }}>
                  {r.get(o)}
                  {isHi && <span style={{ display: "block", fontSize: 10, color: C.green, fontWeight: 500 }}>{r.note}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {comparison.lowest_monthly_costs_more_overall && (
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>
          The offer with the lowest monthly payment is not the one that costs
          least overall. That gap is the trade-off the monthly number hides.
        </div>
      )}
      {hasRateRef && offers[0].rate_position && (
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>
          Rate position is versus a typical range of {offers[0].rate_position.typical_low}% to{" "}
          {offers[0].rate_position.typical_high}%, depending on credit, as of {offers[0].rate_position.as_of}.
        </div>
      )}
    </section>
  );
}

// Home only: shows principal + interest next to the true monthly cost (PITI).
// Every number here is computed in lib/loan.js. Defaults are labelled as
// estimates the user should replace with real quotes.
function HomeCostBreakdown({ hc }) {
  const estimated = hc.property_tax_is_estimate || hc.home_insurance_is_estimate;
  return (
    <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginBottom: 12 }}>
        Your true monthly cost
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>Principal + interest</div>
          <div className="mono" style={{ fontSize: 20, color: C.ink }}>{fmtUSD(hc.principal_interest_monthly)}/mo</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>True monthly with taxes, insurance{hc.has_pmi ? ", and PMI" : ""}</div>
          <div className="mono" style={{ fontSize: 20, color: C.gold, fontWeight: 600 }}>{fmtUSD(hc.true_monthly_piti)}/mo</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
        Property tax {fmtUSD(hc.property_tax_monthly)}/mo, insurance {fmtUSD(hc.home_insurance_monthly)}/mo
        {hc.has_pmi && (
          <>, PMI {fmtUSD(hc.pmi_monthly)}/mo{hc.pmi_ends_about_year ? ` until about year ${hc.pmi_ends_about_year}` : ""}</>
        )}.
      </div>
      {estimated && (
        <div style={{ fontSize: 12, color: C.rust, marginTop: 8 }}>
          Tax and insurance shown are rough estimates. Replace them with your real quoted numbers for an accurate figure.
        </div>
      )}
    </section>
  );
}

// "How your rate compares." The position is decided in code from a static,
// dated reference. It states where the number falls and what to ask, never
// whether the loan is good or bad.
function RateCompare({ rc, type }) {
  const kind = type === "home" ? "home" : "car";
  return (
    <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: C.inkSoft, marginBottom: 8 }}>
        How your rate compares
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: C.ink }}>
        Your <strong>{rc.your_apr}%</strong> is <strong>{rc.position}</strong> for a {kind} loan right now.
        Typical range is roughly {rc.typical_low}% to {rc.typical_high}%, depending on credit.
        {rc.worth_shopping && " Worth asking the lender if you qualify for a better rate, or checking a credit union."}
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
        Typical ranges as of {rc.as_of}, estimates only.
      </div>
    </section>
  );
}

// Car only: loan-to-value at signing plus the negative equity window, computed
// in code from a named depreciation curve. States the actual crossover month or
// flags full-term negative equity. An estimate with stated assumptions, never a
// prediction and never advice on whether to take the loan.
function NegativeEquityPanel({ uw, price, down, years }) {
  const underwater = uw.ever_underwater;
  return (
    <section style={{ background: underwater ? C.rustSoft : C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: underwater ? C.rust : C.inkSoft, marginBottom: 8 }}>
        Negative equity
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: C.ink }}>
        You put {fmtUSD(down)} down on a {fmtUSD(price)} car, so you are financing{" "}
        <strong>{uw.financed_percent}%</strong> of its value.{" "}
        {uw.full_term_underwater ? (
          <>On a typical depreciation curve the balance stays above the car's resale value for the whole term, so you would be underwater the entire loan. That is a real risk, and it is exactly when GAP insurance matters.</>
        ) : underwater ? (
          <>On a typical depreciation curve you are underwater until about <strong>month {uw.crossover_month}</strong>, when the balance falls below the car's resale value. If you sell or total the car before then, you would owe more than it is worth, which is why GAP insurance matters here.</>
        ) : (
          <>On a typical depreciation curve the car's resale value stays above your balance throughout, so negative equity is not a concern on this offer.</>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
        Assumes the car loses about 10% the moment you drive off, about 20% in the first year, then about 15% each year after. A rough estimate, not a prediction.
      </div>
    </section>
  );
}
