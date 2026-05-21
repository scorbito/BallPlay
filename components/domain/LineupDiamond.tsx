"use client";

import Image from "next/image";
import type { LineupSlot, Player, Position } from "@/lib/types/lineup";
import { POSITION_SHORT } from "@/lib/types/lineup";

/** 포지션 교환 시 한 자리에서 다른 자리로 날아가는 선수 표시 */
export type SwapTraveler = {
  playerId: string;
  from: Position;
  to: Position;
};

type LineupDiamondProps = {
  slots: (LineupSlot | null)[];
  playersById: Map<string, Player>;
  teamColor?: string;
  /** 클릭으로 선택된 포지션 — 있으면 강조 표시 */
  selectedPosition?: Position | null;
  /** 마커 클릭 핸들러. 두 번 클릭으로 포지션 교환 흐름. */
  onPositionClick?: (position: Position) => void;
  /** 진행 중인 swap 애니메이션. 비어있으면 정적 표시. */
  travelers?: SwapTraveler[];
};

/** 배경 ground.png 위 포지션별 좌표 (퍼센트). 시각 조정은 여기서.
 *  좌표 기준: left=가로(왼0→오100), top=세로(위0→아래100). 마커 중심점. */
const POS_COORDS: Record<Position, { left: string; top: string }> = {
  // 외야 (이미지 상단)
  CF: { left: "50%", top: "16%" },   // 중견수 — 깊은 중앙
  LF: { left: "23%", top: "22%" },   // 좌익수 — 깊은 좌
  RF: { left: "77%", top: "22%" },   // 우익수 — 깊은 우
  // 내야 (베이스 근처)
  SS: { left: "38%", top: "35%" },   // 유격수 — 2루-3루 사이 얕은 좌
  "2B": { left: "62%", top: "35%" }, // 2루수 — 2루-1루 사이 얕은 우
  "3B": { left: "26%", top: "48%" }, // 3루수 — 3루 베이스 근처
  "1B": { left: "75%", top: "48%" }, // 1루수 — 1루 베이스 근처
  P: { left: "50%", top: "50%" },    // 투수 — 마운드
  C: { left: "50%", top: "80%" },    // 포수 — 홈플레이트 뒤
  // 필드 밖
  DH: { left: "75%", top: "80%" }    // 지명타자 — 우하단 외부
};

const RENDER_ORDER: Position[] = ["LF", "CF", "RF", "3B", "SS", "2B", "1B", "P", "C", "DH"];

export function LineupDiamond({
  slots,
  playersById,
  teamColor = "#ff6a2b",
  selectedPosition = null,
  onPositionClick,
  travelers = []
}: LineupDiamondProps) {
  const playerByPosition = new Map<Position, Player>();
  slots.forEach((slot) => {
    if (!slot) return;
    if (playerByPosition.has(slot.position)) return;
    const player = playersById.get(slot.playerId);
    if (player) {
      playerByPosition.set(slot.position, player);
    }
  });

  const interactive = Boolean(onPositionClick);

  // 애니메이션 중인 포지션 — 정적 이름 라벨 숨김 (고스트가 대신 표시)
  const hiddenNames = new Set<Position>();
  travelers.forEach((t) => {
    hiddenNames.add(t.from);
    hiddenNames.add(t.to);
  });

  return (
    <div className="lineup-field" aria-label="수비 위치">
      <Image
        src="/assets/ground.png"
        alt=""
        fill
        sizes="(max-width: 480px) 100vw, 414px"
        className="lineup-field-bg"
        draggable={false}
        priority
      />

      {RENDER_ORDER.map((pos) => {
        const coord = POS_COORDS[pos];
        const player = playerByPosition.get(pos);
        const filled = Boolean(player);
        const selected = selectedPosition === pos;

        const className = [
          "lineup-field-marker",
          filled ? "lineup-field-marker-filled" : "lineup-field-marker-empty",
          pos === "DH" ? "lineup-field-marker-dh" : "",
          selected ? "lineup-field-marker-selected" : "",
          interactive ? "lineup-field-marker-interactive" : ""
        ].filter(Boolean).join(" ");

        const content = (
          <>
            <span className="lineup-field-marker-circle">{POSITION_SHORT[pos]}</span>
            {player && !hiddenNames.has(pos) ? (
              <span className="lineup-field-marker-name">{player.name}</span>
            ) : null}
          </>
        );

        const style = {
          left: coord.left,
          top: coord.top,
          ["--marker-color" as string]: filled ? teamColor : "rgba(255,255,255,0.16)"
        };

        if (interactive && onPositionClick) {
          return (
            <button
              key={pos}
              type="button"
              className={className}
              style={style}
              onClick={() => onPositionClick(pos)}
              aria-label={`${POSITION_SHORT[pos]} 포지션${player ? ` (${player.name})` : ""} 선택`}
              aria-pressed={selected}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={pos} className={className} style={style}>
            {content}
          </div>
        );
      })}

      {/* swap 애니메이션 고스트 — from 좌표에서 to 좌표로 날아가는 선수 라벨 */}
      {travelers.map((t, idx) => {
        const player = playersById.get(t.playerId);
        if (!player) return null;
        const fromCoord = POS_COORDS[t.from];
        const toCoord = POS_COORDS[t.to];
        const ghostStyle = {
          left: fromCoord.left,
          top: fromCoord.top,
          ["--ghost-from-left" as string]: fromCoord.left,
          ["--ghost-from-top" as string]: fromCoord.top,
          ["--ghost-to-left" as string]: toCoord.left,
          ["--ghost-to-top" as string]: toCoord.top
        };
        return (
          <div
            key={`ghost-${t.playerId}-${idx}`}
            className="lineup-swap-ghost"
            style={ghostStyle}
            aria-hidden="true"
          >
            {player.name}
          </div>
        );
      })}
    </div>
  );
}
