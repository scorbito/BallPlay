import { NextResponse, type NextRequest } from "next/server";
import { answerAiChat, type AiChatHistoryMessage } from "@/lib/server/aiChat";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { message?: unknown; history?: unknown } | null;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history = normalizeHistory(body?.history);

    if (!message) {
      return NextResponse.json({ ok: false, error: "질문을 입력해 주세요." }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ ok: false, error: "질문은 500자 이하로 입력해 주세요." }, { status: 400 });
    }

    const result = await answerAiChat(message, history);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[ai-chat] request failed:", err);
    return NextResponse.json(
      { ok: false, error: "답변을 준비하는 중 문제가 발생했습니다." },
      { status: 500 }
    );
  }
}

function normalizeHistory(raw: unknown): AiChatHistoryMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .slice(-6)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const text = (item as { text?: unknown }).text;
      if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
      return {
        role,
        text: text.trim().slice(0, 800)
      };
    })
    .filter((item): item is AiChatHistoryMessage => Boolean(item?.text));
}
