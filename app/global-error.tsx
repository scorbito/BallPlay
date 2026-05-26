"use client";

import { useEffect } from "react";

/** Next.js global error boundary — 루트 레이아웃 포함 어디에서 에러가 나도 catch.
 *  사용자에겐 친근한 안내 + 재시도 옵션만 노출. 자세한 에러 정보는 콘솔에만 남김. */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 콘솔에 비-minified 에러 정보 덤프 (개발자 도구에서 확인 가능)
    console.error("[GlobalError]", {
      message: error.message,
      digest: error.digest,
      name: error.name,
      stack: error.stack
    });
    // 텔레그램 알림 — 실패해도 사용자에겐 영향 X
    if (typeof window !== "undefined") {
      void fetch("/api/notify-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message || String(error),
          source: "GlobalError",
          stack: error.stack,
          meta: {
            url: window.location.href,
            digest: error.digest,
            name: error.name
          },
          level: "error"
        })
      }).catch(() => {});
    }
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#06101e",
          color: "#f7f9fc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }}
      >
        <div style={{ maxWidth: 360, width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: 17, fontWeight: 850, margin: "0 0 8px" }}>오류가 발생했어요</p>
          <p style={{ fontSize: 13, color: "rgba(247,249,252,0.65)", margin: "0 0 24px", lineHeight: 1.55 }}>
            화면을 그리는 도중 문제가 생겼어요.<br />다시 시도해 주세요.
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "12px 28px",
                borderRadius: 12,
                border: 0,
                background: "#ff6a2b",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(255,106,43,0.32)"
              }}
            >
              다시 시도하기
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "rgba(247,249,252,0.85)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              홈으로
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
