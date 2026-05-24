"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 70; // 이 이상 끌면 새로고침 발동
const MAX_PULL = 110; // 최대 늘어나는 거리 (저항감)
const RESISTANCE = 0.55; // 손가락 이동 거리 대비 인디케이터 이동 (1보다 작으면 저항감)

/** 페이지 상단에서 아래로 당겨서 새로고침.
 *  - 페이지 스크롤이 최상단(scrollTop === 0)일 때만 발동.
 *  - threshold 초과해서 손가락 떼면 router.refresh() 실행.
 *  - 인디케이터는 손가락 따라 늘어남 (저항감 있는 lag). */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0); // 0~MAX_PULL
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    const isAtTop = () => {
      const doc = document.scrollingElement || document.documentElement;
      return doc.scrollTop <= 0 && window.scrollY <= 0;
    };

    // 터치 시작 지점에서 위쪽 조상 중 자체 스크롤이 가능한 컨테이너가 있으면
    // 사용자가 그 안을 스크롤하려는 의도 → PTR 발동 막음.
    // (예: 라인업 빌더의 대기선수 리스트 .lineup-pool-list)
    const isInsideInnerScroller = (target: EventTarget | null) => {
      let el: Element | null = target instanceof Element ? target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!isAtTop()) return;
      if (isInsideInnerScroller(e.target)) return;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (refreshing || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // 위로 올리면 종료
        setPull(0);
        pulling.current = false;
        return;
      }
      if (!isAtTop()) {
        startY.current = null;
        setPull(0);
        return;
      }
      pulling.current = true;
      const resisted = Math.min(MAX_PULL, delta * RESISTANCE);
      setPull(resisted);
    };

    const onEnd = () => {
      if (refreshing) return;
      if (pulling.current && pull >= PULL_THRESHOLD) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        router.refresh();
        // 짧은 시각적 잔상 후 reset
        window.setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 700);
      } else {
        setPull(0);
      }
      startY.current = null;
      pulling.current = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [pull, refreshing, router]);

  const visible = pull > 0 || refreshing;
  const progress = Math.min(1, pull / PULL_THRESHOLD);
  const readyToRefresh = pull >= PULL_THRESHOLD;

  return (
    <>
      {visible ? (
        <div
          className="ptr-indicator"
          style={{
            transform: `translateY(${pull}px)`,
            opacity: Math.min(1, progress * 1.2)
          }}
          aria-hidden="true"
        >
          <RefreshCw
            size={20}
            className={refreshing ? "ptr-icon ptr-icon-spinning" : "ptr-icon"}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`
            }}
          />
          <span>{refreshing ? "새로고침 중..." : readyToRefresh ? "놓으면 새로고침" : "당겨서 새로고침"}</span>
        </div>
      ) : null}
      {children}
    </>
  );
}
