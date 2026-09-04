"use client";

import React from "react";

const RELOAD_KEY = "error-boundary.reloadAt";
const RELOAD_COOLDOWN_MS = 5_000; // 5초 안에 다시 에러 → 더 reload 안 함 (무한루프 방지)

/** fetch 실패 메시지(브라우저마다 문구가 다름). 네이버/카카오 인앱 웹뷰에서 RSC 요청이
 *  끊기면 "network error" TypeError 가 라우터 렌더 중에 throw 돼 여기까지 올라온다. */
const NETWORK_ERROR_RE =
  /network\s?error|failed to fetch|load failed|networkerror when attempting|net::err/i;

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return NETWORK_ERROR_RE.test(message);
}

type Props = {
  children: React.ReactNode;
};

type State = {
  /** null = 정상. "network" = 통신 실패(코드 버그 아님). "app" = 그 외 렌더 에러. */
  kind: null | "network" | "app";
  willReload: boolean;
};

/** 클라이언트 사이드 에러(React #310 등)를 catch.
 *  - 첫 발생: 자동 새로고침 (대부분의 hydration mismatch / 캐시 충돌은 reload로 해소)
 *  - 짧은 시간 안에 반복 발생: reload 중단 + 사용자에게 안내 (무한루프 방지)
 *  - 네트워크 에러: 자동 새로고침 안 함(오프라인이면 브라우저 오류 페이지로 떨어짐).
 *    안내 + 수동 재시도 버튼만. 텔레그램에도 warn 으로만 보고.
 *  - YouTube 등 외부 referrer 경유 진입 시 가끔 발생하는 hydration 충돌 대응. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { kind: null, willReload: false };

  static getDerivedStateFromError(error: unknown): State {
    return { kind: isNetworkError(error) ? "network" : "app", willReload: false };
  }

  // ChunkLoadError 는 라우터 이동/동적 import 중에 나서 React ErrorBoundary 밖(전역 error/
  // unhandledrejection)으로 샌다. 배포 직후 옛 청크가 사라져 발생하므로 1회 자동 새로고침으로 복구.
  private onGlobalError = (message: string) => {
    if (!/ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk/i.test(message)) return;
    this.reloadOnce(false);
  };
  private handleError = (e: ErrorEvent) =>
    this.onGlobalError(e.message || String((e.error as Error | undefined)?.message ?? ""));
  private handleRejection = (e: PromiseRejectionEvent) => {
    const r = e.reason as { name?: string; message?: string } | string | undefined;
    this.onGlobalError(typeof r === "string" ? r : `${r?.name ?? ""} ${r?.message ?? ""}`);
  };

  componentDidMount() {
    if (typeof window === "undefined") return;
    window.addEventListener("error", this.handleError);
    window.addEventListener("unhandledrejection", this.handleRejection);
  }

  componentWillUnmount() {
    if (typeof window === "undefined") return;
    window.removeEventListener("error", this.handleError);
    window.removeEventListener("unhandledrejection", this.handleRejection);
  }

  /** 쿨다운 안에서 1회만 새로고침 (무한루프 방지). updateState=true 면 스플래시 표시. */
  private reloadOnce(updateState: boolean) {
    if (typeof window === "undefined") return;
    try {
      const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? "0");
      if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
        if (updateState) this.setState({ willReload: false });
        return;
      }
      window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // sessionStorage 차단 — 그래도 한 번은 시도.
    }
    if (updateState) this.setState({ willReload: true });
    window.setTimeout(() => window.location.reload(), 100);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);

    if (typeof window === "undefined") return;

    const network = isNetworkError(error);

    // 텔레그램 알림 — 실패해도 메인 흐름에 영향 X (await 안 함)
    // 네트워크 에러는 코드 버그가 아니라 사용자 회선/인앱 웹뷰 문제라 warn 으로 낮춰 보고.
    void fetch("/api/notify-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message || String(error),
        source: network ? "ErrorBoundary/network" : "ErrorBoundary",
        stack: error.stack,
        meta: {
          url: window.location.href,
          online: typeof navigator === "undefined" ? null : navigator.onLine,
          componentStack: (info.componentStack ?? "").slice(0, 500)
        },
        level: network ? "warn" : "error"
      })
    }).catch(() => {});

    // 통신이 끊긴 상태에서 reload 하면 브라우저 오류 페이지로 떨어진다 — 자동 새로고침 금지.
    if (network) return;

    // 최근에 이미 reload했는데 또 에러 → 진짜 코드 버그일 수 있어 더 이상 reload 안 함(쿨다운).
    this.reloadOnce(true);
  }

  render() {
    if (this.state.kind) {
      // reload 예정이면 스플래시 같은 다크 화면 (이미 보던 initial-loader와 비슷)
      // reload 중단되면 사용자에게 새로고침 권유.
      const network = this.state.kind === "network";
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "#06101e",
            color: "#f7f9fc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center"
          }}
        >
          {this.state.willReload ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>잠시만요...</p>
              <p style={{ fontSize: 12, color: "rgba(247,249,252,0.55)", margin: 0 }}>
                화면을 다시 그리고 있어요.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                {network ? "연결이 불안정해요" : "일시적인 오류가 발생했어요"}
              </p>
              {network ? (
                <p style={{ fontSize: 12, color: "rgba(247,249,252,0.55)", margin: 0 }}>
                  네트워크 상태를 확인한 뒤 다시 시도해 주세요.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  marginTop: 8,
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: 0,
                  background: "#ff6a2b",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                다시 시도하기
              </button>
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
