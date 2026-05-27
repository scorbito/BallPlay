"use client";

// 홈 카드 우상단 코너 + 설명 툴팁 — HomeScreen의 유일한 인터랙티브 영역.
// HomeScreen을 Server Component로 유지하기 위해 이 부분만 client island로 분리.
//
// 코너 종류: featured(★추천 + !) > external(↗) > badge(준비중) > available(!).
// ! 버튼 클릭 시 설명 툴팁 토글. 한 번에 하나만 열리도록 window 커스텀 이벤트로 다른 카드 닫음.

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AlertCircle, ExternalLink, Star } from "lucide-react";

const OPEN_EVENT = "bp:card-info-open";

type Props = {
  cardId: string;
  title: string;
  description: string;
  available: boolean;
  featured?: boolean;
  external?: boolean;
  badge?: string;
};

export function HomeCardCorner({ cardId, title, description, available, featured, external, badge }: Props) {
  const [open, setOpen] = useState(false);
  // ! 버튼이 있는 코너인지 (featured 또는 외부링크 아닌 available)
  const hasInfo = Boolean(featured) || (available && !external);

  useEffect(() => {
    if (!open) return;
    // 다른 카드 팝오버가 열리면 이 카드 닫기 (한 번에 하나만)
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== cardId) setOpen(false);
    };
    // 바깥 클릭 시 닫기 — 같은 카드의 버튼/툴팁 클릭은 유지
    const onDocClick = (e: globalThis.MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(`[data-card-info="${cardId}"]`)) return;
      setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOtherOpen);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOtherOpen);
      document.removeEventListener("click", onDocClick);
    };
  }, [open, cardId]);

  const toggle = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => {
      const next = !prev;
      if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: cardId }));
      return next;
    });
  };

  const infoButton = (onFeatured: boolean) => (
    <button
      type="button"
      className={onFeatured ? "play-hub-card-info play-hub-card-info-on-featured" : "play-hub-card-info"}
      aria-label={`${title} 설명 보기`}
      aria-expanded={open}
      onClick={toggle}
      data-card-info={cardId}
    >
      <AlertCircle size={14} />
    </button>
  );

  let corner = null;
  if (featured) {
    corner = (
      <div className="play-hub-card-corner-row">
        <span className="play-hub-card-featured">
          <Star size={10} fill="currentColor" strokeWidth={0} />
          추천
        </span>
        {infoButton(true)}
      </div>
    );
  } else if (external) {
    corner = (
      <span className="play-hub-card-external-mark" aria-hidden="true">
        <ExternalLink size={14} />
      </span>
    );
  } else if (!available && badge) {
    corner = <span className="play-hub-card-badge">{badge}</span>;
  } else if (available) {
    corner = infoButton(false);
  }

  return (
    <>
      {corner}
      {open && hasInfo ? (
        <div className="play-hub-card-tooltip" role="tooltip" data-card-info={cardId}>
          {description}
        </div>
      ) : null}
    </>
  );
}
