# Loan Lens

Decode a car or home loan offer. It shows the total cost, the catches, and the questions to ask, so you can decide. It does not tell you whether to take the loan.

This is a Next.js app. The Anthropic API is called from the server, so your API key never reaches the browser.

## The one idea worth remembering

The numbers come from code. The words come from the model.

Every dollar figure (`lib/loan.js`) is computed with a plain amortization formula. The model is handed those figures as facts and asked to explain them. It never does arithmetic, so it cannot put a wrong number on the screen. When someone asks how the tool avoids hallucinated figures, that separation is the answer.

## What's in here

```
app/
  page.jsx            the page
  layout.jsx          html shell + fonts
  globals.css
  api/brief/route.js  server route: computes facts, asks the model for the brief
  api/chat/route.js   server route: grounded follow-up chat
components/
  LoanLens.jsx        the whole UI (client component)
lib/
  loan.js             deterministic math — the single source of truth for numbers
  prompts.js          the product's point of view (decode, never advise)
```

## Run it on your laptop

You need Node 18+ installed.

1. Get an Anthropic API key at https://console.anthropic.com (Settings, then API Keys).
2. In this folder, make your env file:
   ```
   cp .env.local.example .env.local
   ```
   Open `.env.local` and paste your real key after `ANTHROPIC_API_KEY=`.
3. Install and run:
   ```
   npm install
   npm run dev
   ```
4. Open http://localhost:3000

`.env.local` is gitignored on purpose. Never commit it.

## Put it live on Vercel (free)

1. Push this folder to a new GitHub repo:
   ```
   git init
   git add .
   git commit -m "Loan Lens v1"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/loan-lens.git
   git push -u origin main
   ```
2. Go to https://vercel.com, sign in with GitHub, click "Add New Project", and import the `loan-lens` repo.
3. Before deploying, open "Environment Variables" and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your real key
4. Click Deploy. In about a minute you get a live URL like `loan-lens.vercel.app`.

That URL is the thing for your portfolio. Every push to `main` redeploys automatically.

## What it deliberately will not do

It will not recommend a loan or tell you which option is best. That is advice, and it depends on your full situation. The brief always ends with what the tool cannot know. This refusal is a product decision, not a missing feature.

## Known limits (v1)

- Assumes a standard fixed-payment loan. The variable-rate option shows "if the rate rises" scenarios, not forecasts.
- You type the offer in by hand. PDF upload is a later version.
- One offer at a time. Side-by-side comparison is a later version.
- Clause flagging is passive: the model reads what you paste. Proactive prompting for prepayment penalties, refinance/transfer terms, and co-signer liability is the planned v2.
