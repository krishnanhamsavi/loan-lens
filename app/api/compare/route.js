// app/api/compare/route.js
import { NextResponse } from "next/server";
import { compareOffers } from "../../../lib/loan";
import { COMPARE_SYSTEM } from "../../../lib/prompts";
import { rateLimit } from "../../../lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const limited = await rateLimit(req);
    if (limited) return limited;

    const { offers } = await req.json();

    if (!Array.isArray(offers) || offers.length < 2 || offers.length > 3) {
      return NextResponse.json(
        { error: "Enter 2 or 3 offers to compare." },
        { status: 400 }
      );
    }
    for (const o of offers) {
      if (!o?.inputs || !(o.inputs.amount > 0) || !(o.inputs.years > 0)) {
        return NextResponse.json(
          { error: "Each offer needs a positive amount and term." },
          { status: 400 }
        );
      }
    }

    // The numbers AND the ranking are computed on the server from raw inputs.
    // The model never decides which offer is cheapest; the code already has.
    const comparison = compareOffers(offers);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          comparison,
          summary: "",
          error: "Server is missing ANTHROPIC_API_KEY.",
        },
        { status: 200 }
      );
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: COMPARE_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Compare these offers for the user.\n\nCOMPARISON (already computed, including which offer is cheapest, treat as truth):\n${JSON.stringify(
              comparison,
              null,
              2
            )}`,
          },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { comparison, summary: "", error: data?.error?.message || "Model error." },
        { status: 200 }
      );
    }
    const summary = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({ comparison, summary });
  } catch (e) {
    return NextResponse.json(
      { error: "Something went wrong comparing the offers." },
      { status: 500 }
    );
  }
}
