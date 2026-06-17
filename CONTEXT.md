# Loan Lens — project context and handoff

This document is the full context for the project, written so an AI coding assistant (or a new developer) can understand not just what the code does but why it was built this way. Read this before making changes.

## What this is

Loan Lens is a small web app that helps an everyday person understand a car or home loan offer they are considering. The user enters the offer (price, down payment, APR, term, and optionally any extra terms they were quoted). The app returns a plain-English brief: what the loan really costs over its life, the trade-off the monthly payment hides, what to watch out for, what to ask before signing, and an honest statement of what the tool cannot know. There is also a chat for follow-up questions about that specific offer.

It is a Next.js app (App Router). The Anthropic API is called from server-side API routes so the API key is never exposed to the browser.

## Why it exists (the goal behind it)

This is the builder's first product. The goal is twofold: learn end-to-end product building (including shipping it live, not just prototyping), and produce a portfolio piece for an associate product manager job search. The product is intentionally simple in its math so the learning can focus on product decisions and the build/deploy loop rather than on hard algorithms.

The reference inspiration was a portfolio of small LLM-wrapped tools, each following one shape: take a dreaded document or dataset, run it through a model, return a plain-English brief plus a chat, with one crisp judgment call the product makes (or refuses to make). Loan Lens is the debt-instrument version of that shape.

## The single most important design principle

The numbers come from code. The words come from the model.

Every dollar figure shown to the user is computed by a plain amortization formula in `lib/loan.js`. The model never does arithmetic. It is handed the already-computed figures as facts and asked only to explain them in prose and answer follow-up questions grounded in them. This means the model cannot put a wrong number on the screen. If asked in an interview "how do you stop it hallucinating figures," this separation is the answer. Do not move any calculation into the model. Do not let the client send pre-computed numbers to be repeated — numbers are computed server-side from raw inputs.

## The product's point of view (deliberate decisions, do not remove)

These are product decisions, not missing features. Preserve them.

1. It decodes; it does not advise. The tool never tells the user whether to take the loan or which option is "best." That is financial advice the builder is not licensed to give, and it depends on the user's full situation. The brief always ends with a "what this can't tell you" section. This refusal is the core product stance.

2. It reframes monthly payment to total cost. The hero of the output is total interest and total amount paid back, plus a bar showing how much of every dollar goes to interest — not the monthly payment, which is the number the lending industry uses to make a loan look cheaper than it is.

3. It makes the term trade-off unavoidable. A "same loan, different terms" table shows that a lower monthly payment almost always means more total interest. This is computed deterministically for several alternate terms.

4. It flags, it does not forecast. For variable-rate loans, it shows "if the rate rises 1 or 2 points" scenarios, explicitly labelled as scenarios, never predictions of where rates will go.

## Architecture and file map

```
app/
  page.jsx              renders the LoanLens component
  layout.jsx            html shell; loads fonts (Fraunces, Inter, IBM Plex Mono) via <link>
  globals.css           base styles + font-family CSS variables
  api/brief/route.js    POST: takes raw inputs, computes facts server-side, asks the model for the 5-section brief, returns { facts, brief }
  api/chat/route.js     POST: takes facts + message history, returns a grounded { reply }
components/
  LoanLens.jsx          the entire UI; a client component ("use client"); calls /api/brief and /api/chat via fetch
lib/
  loan.js               deterministic math: amortize(), termScenarios(), rateScenarios(), buildFacts(). Single source of truth for every number.
  prompts.js            BRIEF_SYSTEM and CHAT_SYSTEM(facts). The product's point of view lives here.
```

Data flow for a brief:
1. User fills the form in `LoanLens.jsx` and clicks "Read this offer."
2. Client POSTs raw inputs (amount, downPayment, apr, years, type, variable, extra text) to `/api/brief`.
3. The route calls `buildFacts()` to compute all numbers server-side, then sends those facts to the Anthropic API with `BRIEF_SYSTEM`.
4. The route returns both the computed `facts` (so the UI renders numbers even if the model call fails) and the model's `brief` text.
5. The UI renders the stat cards, cost bar, and term table from `facts` (always correct), and renders the brief prose separately.

Data flow for chat: client sends the same `facts` plus the running message array to `/api/chat`, which calls the model with `CHAT_SYSTEM(facts)` and returns a reply.

Model used: `claude-sonnet-4-6`. Auth header is `x-api-key` with `anthropic-version: 2023-06-01`.

## The math (so you can verify it)

Standard fixed-payment amortization. Monthly payment M = P * r * (1+r)^n / ((1+r)^n - 1), where P is principal (amount minus down payment), r is the monthly rate (APR/100/12), n is months (years*12). The r = 0 case is handled separately as P / n. Total paid = M * n; total interest = total paid - P.

Verification checks that have passed: a $200,000 loan at 6% over 30 years gives a monthly payment of $1,199.10. A 0% loan gives zero interest and even monthly payments. Keep these as sanity checks if you refactor the math.

## Environment and secrets

The app needs an Anthropic API key in the environment variable `ANTHROPIC_API_KEY`. Locally this goes in `.env.local` (which is gitignored and must never be committed). On the host (Vercel) it is set as an environment variable in the project settings. The routes read `process.env.ANTHROPIC_API_KEY`. If the key is missing, the brief route still returns the computed facts with an error message, so the numbers always work even without the model.

## How to run locally

1. `cp .env.local.example .env.local` and paste a real key from https://console.anthropic.com
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000

## How to deploy (Vercel)

1. Push to a new GitHub repo (git init, add, commit, set remote, push).
2. On vercel.com, import the repo.
3. Add the environment variable `ANTHROPIC_API_KEY` with the real key.
4. Deploy. Every push to main redeploys automatically.

## Known limits and the planned next version

Current v1 limits:
- Assumes a standard fixed-payment loan.
- The user types the offer in by hand; no PDF upload.
- One offer at a time; no side-by-side comparison.
- Clause flagging is passive: the model reads whatever the user pastes into the "extra terms" box. It does not proactively probe.
- The API is called on every brief and chat message with no rate limiting. A public URL means anyone can spend the owner's tokens. A rate limit is a sensible early addition.

Planned v2 — proactive clause flagging:
Turn flagging from passive to active. Instead of relying on pasted free text, present a short set of targeted yes/no questions tailored by loan type, then flag based on the answers. No new math; this is UI plus richer prompt input. Scope decided with care:
- Prepayment penalty — include. Most common everyday gotcha, affects ability to refinance.
- Refinance / transfer terms — include. "Can I refinance without penalty," "is the loan assumable."
- Co-signer liability — include but as a fact flag only ("a co-signer is fully liable and it affects their credit"), never as advice about whether someone should co-sign.
- Death liability — deliberately left out (or reduced to a single "ask your lender what happens to this loan if the borrower dies" question). Accurate answers are jurisdiction-dependent and a confident wrong answer could cause real harm. This is a legal question, not a flag.

Throughout, keep the writing rule the owner uses: do not use dashes (em dash, en dash, or hyphen) as sentence-level breaks or connectors in any user-facing copy or model output. Use full stops or commas instead.

## A note on how to help on this project

This is a learning project. The owner wants to do the deploy steps (git, Vercel, environment setup) themselves to build the skill, and wants help primarily with debugging errors and, later, building v2. When something breaks, explain the cause, not just the fix. Do not silently take over the parts the owner is trying to learn.
