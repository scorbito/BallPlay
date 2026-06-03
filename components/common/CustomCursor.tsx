"use client";

// JS 기반 커스텀 커서 — body.has-custom-cursor 가 켜져 있을 때만 활성.
// 마우스 위치를 따라다니는 배트 이미지 + 클릭 시 회전 스윙 애니메이션.

import { useEffect, useRef, useState } from "react";

const SWING_DURATION_MS = 300;

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const swingResetTimerRef = useRef<number | null>(null);

  // body.has-custom-cursor 클래스 변경 감지 → enabled state 동기화.
  useEffect(() => {
    const sync = () => setEnabled(document.body.classList.contains("has-custom-cursor"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let frameId = 0;
    let lastX = -9999;
    let lastY = -9999;

    const updatePos = () => {
      frameId = 0;
      el.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`;
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!frameId) frameId = requestAnimationFrame(updatePos);
      // hover 상태 동기화 — link/button 위에선 약간 다른 위치/포즈 등 추후 확장 여지.
      el.style.opacity = "1";
    };

    const onLeave = () => {
      el.style.opacity = "0";
    };

    const onDown = () => {
      el.classList.remove("is-swing");
      // reflow 강제로 애니메이션 재시작.
      void el.offsetWidth;
      el.classList.add("is-swing");
      if (swingResetTimerRef.current) window.clearTimeout(swingResetTimerRef.current);
      swingResetTimerRef.current = window.setTimeout(() => {
        el.classList.remove("is-swing");
      }, SWING_DURATION_MS);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      if (frameId) cancelAnimationFrame(frameId);
      if (swingResetTimerRef.current) window.clearTimeout(swingResetTimerRef.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      className="custom-cursor"
      aria-hidden
      style={{
        opacity: 0
      }}
    />
  );
}
