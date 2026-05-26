// Telegram Bot으로 에러 알림. env 없으면 no-op (개발 환경 안전).
//
// 셋업:
//   1. @BotFather에게 /newbot → 봇 이름 입력 → BOT_TOKEN 발급
//   2. 봇과 1:1 대화 시작 (메시지 1번 보내기) → 또는 그룹에 봇 추가
//   3. https://api.telegram.org/bot<BOT_TOKEN>/getUpdates 호출 → chat.id 추출
//   4. env에 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID 설정
//
// 보안:
//   - BOT_TOKEN은 server-only (NEXT_PUBLIC_ 접두사 X)
//   - 클라이언트 에러는 /api/notify-error route를 통해 간접 전송

const API_BASE = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4000; // Telegram 한도 4096, 여유 96자 확보

export type NotifyPayload = {
  /** 에러 메시지 (필수) */
  message: string;
  /** 발생 위치/맥락 (선택). 예: "POST /api/predictions" 또는 "WinnerPredictScreen.handlePick" */
  source?: string;
  /** 스택 트레이스 (선택). 너무 길면 잘림 */
  stack?: string;
  /** 추가 메타데이터 (선택). URL, user agent 등 */
  meta?: Record<string, string | number | undefined>;
  /** 심각도 (기본 error). info/warn은 시각 차이만 */
  level?: "info" | "warn" | "error";
};

const LEVEL_ICON: Record<NonNullable<NotifyPayload["level"]>, string> = {
  info: "ℹ️",
  warn: "⚠️",
  error: "🚨"
};

function truncate(s: string | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…(truncated)" : s;
}

function formatMessage(p: NotifyPayload): string {
  const level = p.level ?? "error";
  const icon = LEVEL_ICON[level];
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local";
  const lines = [
    `${icon} *BallPlay ${level.toUpperCase()}* \`${env}\``,
    "",
    `*Message:* ${truncate(p.message, 500)}`
  ];
  if (p.source) lines.push(`*Source:* \`${p.source}\``);
  if (p.meta) {
    const metaStr = Object.entries(p.meta)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `  • ${k}: ${v}`)
      .join("\n");
    if (metaStr) lines.push(`*Meta:*\n${metaStr}`);
  }
  if (p.stack) {
    lines.push("");
    lines.push("```");
    lines.push(truncate(p.stack, 2500));
    lines.push("```");
  }
  return truncate(lines.join("\n"), MAX_MESSAGE_LENGTH);
}

/** Telegram에 에러 알림 전송. env 없으면 console.error만 찍고 silent. 절대 throw 안 함. */
export async function notifyTelegram(payload: NotifyPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // env 없을 땐 그냥 콘솔에만 — 개발 환경에서 무해
    console.error("[notify-skip]", payload.message, payload.source ?? "");
    return;
  }

  try {
    // 짧은 타임아웃 — 알림 실패가 메인 요청을 끌고 가지 않도록
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatMessage(payload),
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error("[notify-fail]", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    // 알림 실패는 절대 throw하지 않음 — 알림이 메인 요청을 망가뜨리면 안 됨
    console.error("[notify-error]", err);
  }
}
