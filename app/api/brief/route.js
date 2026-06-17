// app/api/brief/route.js
import { NextResponse } from "next/server";
import { buildFacts } from "../../../lib/loan";
import { BRIEF_SYSTEM } from "../../../lib/prompts";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { type, inputs, variable, extra } = await req.json();

    if (!inputs || !(inputs.amount > 0) || !(inputs.years > 0)) {
      return NextResponse.json(
        { error: "Need at least a positive amount and term." },
        { status: 400 }
      );
    }

    // Numbers are computed on the server from the raw inputs — the client
    // cannot hand us figures to repeat. Single source of truth.
    const facts = buildFacts({ type, inputs, variable, extra });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { facts, brief: "", error: "Server is missing ANTHROPIC_API_KEY." },
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
        system: BRIEF_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Write the brief for this offer.\n\nFACTS (already computed, treat as truth):\n${JSON.stringify(
              facts,
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
        { facts, brief: "", error: data?.error?.message || "Model error." },
        { status: 200 }
      );
    }
    const brief = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({ facts, brief });
  } catch (e) {
    return NextResponse.json(
      { error: "Something went wrong reading the offer." },
      { status: 500 }
    );
  }
}
