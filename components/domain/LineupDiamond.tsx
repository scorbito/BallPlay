"use client";

import Image from "next/image";
import type { LineupSlot, Player, Position } from "@/lib/types/lineup";
import { POSITION_SHORT } from "@/lib/types/lineup";

type LineupDiamondProps = {
  slots: (LineupSlot | null)[];
  playersById: Map<string, Player>;
  teamColor?: string;
};

/** 배경 ground.jpg 위 포지션별 좌표 (퍼센트 — 이미지 비율 기준).
 *  중계 시점(홈 플레이트가 아래)에 맞춰 잡았다. 시각 조정은 여기서. */
const POS_COORDS: Record<Position, { left: string; top: string }> = {
  CF: { left: "50%", top: "18%" },
  LF: { left: "22%", top: "26%" },
  RF: { left: "78%", top: "26%" },
  SS: { left: "40%", top: "44%" },
  "2B": { left: "60%", top: "44%" },
  "3B": { left: "28%", top: "55%" },
  "1B": { left: "72%", top: "55%" },
  P: { left: "50%", top: "55%" },
  C: { left: "50%", top: "82%" },
  // DH는 필드 우하단 외부에 별도 표시
  DH: { left: "90%", top: "86%" }
};

const RENDER_ORDER: Position[] = ["LF", "CF", "RF", "3B", "SS", "2B", "1B", "P", "C", "DH"];

export function LineupDiamond({ slots, playersById, teamColor = "#ff6a2b" }: LineupDiamondProps) {
  // 위치별로 가장 먼저 등장하는 슬롯의 선수 (같은 포지션 중복 시 타순 우선)
  const playerByPosition = new Map<Position, Player>();
  slots.forEach((slot) => {
    if (!slot) return;
    if (playerByPosition.has(slot.position)) return;
    const player = playersById.get(slot.playerId);
    if (player) {
      playerByPosition.set(slot.position, player);
    }
  });

  return (
    <div className="lineup-field" aria-label="수비 위치">
      {/* 배경: 야구장 이미지 */}
      <Image
        src="/assets/ground.png"
        alt=""
        fill
        sizes="(max-width: 480px) 100vw, 414px"
        className="lineup-field-bg"
        draggable={false}
        priority
      />

      {/* 포지션 마커 */}
      {RENDER_ORDER.map((pos) => {
        const coord = POS_COORDS[pos];
        const player = playerByPosition.get(pos);
        const filled = Boolean(player);
        return (
          <div
            key={pos}
            className={`lineup-field-marker ${filled ? "lineup-field-marker-filled" : "lineup-field-marker-empty"} ${pos === "DH" ? "lineup-field-marker-dh" : ""}`}
            style={{
              left: coord.left,
              top: coord.top,
              ["--marker-color" as string]: filled ? teamColor : "rgba(255,255,255,0.16)"
            }}
          >
            <span className="lineup-field-marker-circle">{POSITION_SHORT[pos]}</span>
            {player ? (
              <span className="lineup-field-marker-name">{player.name}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
