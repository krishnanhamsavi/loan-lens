// app/api/chat/route.js
import { NextResponse } from "next/server";
import { CHAT_SYSTEM } from "../../../lib/prompts";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const { facts, messages } = await req.json();
    if (!facts || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Bad request." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing ANTHROPIC_API_KEY." },
        { status: 500 }
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
        max_tokens: 800,
        system: CHAT_SYSTEM(facts),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Model error." },
        { status: 200 }
      );
    }
    const reply = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: "Chat failed." }, { status: 500 });
  }
}
