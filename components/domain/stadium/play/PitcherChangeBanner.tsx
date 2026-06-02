import { ArrowRight, RefreshCw } from "lucide-react";

// 투수 역할 라벨 — SP=선발, RP=중간, CL=마무리. 그 외 문자열은 그대로 표시.
function roleLabel(role: string | undefined | null): string {
  if (role === "SP") return "선발";
  if (role === "RP") return "중간";
  if (role === "CL") return "마무리";
  return role?.trim() || "투수";
}

// 역할 chip 톤 — 컨테이너 className에 매핑되는 modifier 반환.
// 선발=blue, 중간=neutral, 마무리=danger, 그 외=neutral.
function roleTone(role: string | undefined | null): "starter" | "middle" | "closer" {
  if (role === "SP") return "starter";
  if (role === "CL") return "closer";
  return "middle";
}

type PitcherInfo = { name: string; role: string } | null;

export type PitcherChangeBannerProps = {
  prev: PitcherInfo;
  next: PitcherInfo;
};

// 투수 교체 카드형 강조 배너.
// PlayScreen.tsx 의 PITCHER_CHANGE phase 일 때 narration 자리에 노출.
// prev/next 가 null 인 경우 "투수" 폴백 표시.
export function PitcherChangeBanner({ prev, next }: PitcherChangeBannerProps) {
  const prevName = prev?.name?.trim() || "투수";
  const nextName = next?.name?.trim() || "투수";
  const prevRole = prev?.role;
  const nextRole = next?.role;

  return (
    <div className="stadium-pitcher-change-banner" role="status" aria-live="polite">
      <div className="stadium-pitcher-change-banner__header">
        <RefreshCw size={13} aria-hidden />
        <span>투수 교체</span>
      </div>
      <div className="stadium-pitcher-change-banner__body">
        <div className="stadium-pitcher-change-banner__side">
          <span className="stadium-pitcher-change-banner__name">{prevName}</span>
          <span
            className={`stadium-pitcher-change-banner__role is-${roleTone(prevRole)}`}
          >
            {roleLabel(prevRole)}
          </span>
        </div>
        <div className="stadium-pitcher-change-banner__arrow" aria-hidden>
          <ArrowRight size={16} />
        </div>
        <div className="stadium-pitcher-change-banner__side">
          <span className="stadium-pitcher-change-banner__name">{nextName}</span>
          <span
            className={`stadium-pitcher-change-banner__role is-${roleTone(nextRole)}`}
          >
            {roleLabel(nextRole)}
          </span>
        </div>
      </div>
    </div>
  );
}
