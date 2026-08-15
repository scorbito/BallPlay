"use client";

// KBO 공식 프로필 사진 — 닮은 선수 찾기·워들 결과 등에서 공용으로 쓴다.
//
// CDN을 인라인 링크로 참조하므로 우리 서버에 사본이 남지 않는다. next/image 로 감싸면
// 최적화 파이프라인을 태우느라 우리 서버를 경유하게 되어 그 성질이 깨진다.
// 사진이 없거나 CDN이 막히면 팀 컬러 배경에 이름 첫 글자로 폴백한다.

import { useState } from "react";
import { teams as KBO_TEAMS } from "@/lib/constants/teams";
import { kboPlayerPhotoUrl } from "@/lib/kbo/playerPhoto";

type Props = {
  /** KBO playerId. 없으면 곧바로 이니셜 폴백으로 그린다. */
  playerId?: string | null;
  name: string;
  teamId: string;
  /** 사진이 존재하는 시즌. 모르면 생략(최신 시즌으로 시도). */
  year?: number | null;
  /** 크기·모서리는 호출 측에서 정한다. */
  className?: string;
};

export function KboPlayerPhoto({ playerId, name, teamId, year, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const color = KBO_TEAMS.find((item) => item.id === teamId)?.color ?? "#6b7280";

  if (!playerId || failed) {
    return (
      <div
        className={`grid place-items-center font-extrabold text-white ${className}`}
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {name.slice(0, 1)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부 CDN 인라인 링크. 위 주석 참고.
    <img
      src={kboPlayerPhotoUrl(playerId, year)}
      alt={`${name} 프로필 사진`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      style={{ backgroundColor: `${color}14` }}
    />
  );
}
