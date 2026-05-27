"use client";

import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { getTeam } from "@/lib/constants/teams";
import {
  POSITIONS,
  POSITION_SHORT,
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_STARTER_INDEX,
  formatHandBadge,
  type LineupMode,
  type LineupSlot,
  type Player,
  type Position
} from "@/lib/types/lineup";

type ShareLineupModalProps = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  mode: LineupMode;
  slots: (LineupSlot | null)[];
  pitcherSlots: (string | null)[];
  playersById: Map<string, Player>;
};

/** 공유 카드 그라운드 좌표 — LineupDiamond의 POS_COORDS와 동일한 % 값 */
const POS_COORDS: Record<Position, { left: number; top: number }> = {
  CF: { left: 0.5, top: 0.16 },
  LF: { left: 0.23, top: 0.22 },
  RF: { left: 0.77, top: 0.22 },
  SS: { left: 0.38, top: 0.35 },
  "2B": { left: 0.62, top: 0.35 },
  "3B": { left: 0.18, top: 0.48 },
  "1B": { left: 0.82, top: 0.48 },
  P: { left: 0.5, top: 0.5 },
  C: { left: 0.5, top: 0.8 },
  DH: { left: 0.75, top: 0.8 }
};

const FIELD_POSITIONS: Position[] = ["LF", "CF", "RF", "3B", "SS", "2B", "1B", "P", "C", "DH"];

export function ShareLineupModal({
  open,
  onClose,
  teamId,
  mode,
  slots,
  pitcherSlots,
  playersById
}: ShareLineupModalProps) {
  const [shareStatus, setShareStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!shareStatus) return;
    const t = window.setTimeout(() => setShareStatus(""), 3500);
    return () => window.clearTimeout(t);
  }, [shareStatus]);

  useEffect(() => {
    if (!open) setShareStatus("");
  }, [open]);

  // 모달 열릴 때 미리보기 캔버스에 동일 렌더 (저화질로 — 빠른 표시)
  useEffect(() => {
    if (!open) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    renderShareCanvas(canvas, { teamId, mode, slots, pitcherSlots, playersById, scale: 0.5 });
  }, [open, teamId, mode, slots, pitcherSlots, playersById]);

  const buildShareImage = async (): Promise<{ blob: Blob; filename: string } | null> => {
    const canvas = document.createElement("canvas");
    await renderShareCanvas(canvas, { teamId, mode, slots, pitcherSlots, playersById, scale: 1 });
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) return null;
    const filename = `ballplay-lineup-${teamId}-${mode}.png`;
    return { blob, filename };
  };

  const shareImage = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setShareStatus("");
    try {
      const result = await buildShareImage();
      if (!result) {
        setShareStatus("이미지 생성에 실패했어요.");
        return;
      }
      const { blob, filename } = result;
      const file = new File([blob], filename, { type: "image/png" });
      const url = typeof window !== "undefined" ? window.location.href : "";
      const team = getTeam(teamId);
      const text = `${team.name} ${mode === "batter" ? "타자" : "투수"} 라인업이에요.\n나만의 라인업을 짜보고 싶다면 야구놀이터로..\n${url}`;

      const isMobileShare =
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

      if (isMobileShare && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "야구놀이터", text });
          setShareStatus("공유했어요!");
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
          // fall through to download
        }
      }

      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objUrl);
      try {
        await navigator.clipboard.writeText(text);
        setShareStatus("이미지를 저장했고 텍스트는 클립보드에 복사됐어요.");
      } catch {
        setShareStatus("이미지를 저장했어요.");
      }
    } catch (err) {
      console.error("share failed:", err);
      setShareStatus("공유에 실패했어요. 다시 시도해주세요.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <ModalShell open={open} title="라인업 공유" onClose={onClose} panelClassName="share-lineup-modal-panel" closeOnBackdrop>
      <div className="share-lineup-body">
        <div className="share-lineup-preview">
          <canvas ref={previewCanvasRef} className="share-lineup-preview-canvas" />
        </div>
        <div className="share-lineup-actions">
          <button type="button" className="share-lineup-primary" disabled={isSharing} onClick={shareImage}>
            <Share2 size={16} />
            {isSharing ? "준비 중..." : "이미지 공유"}
          </button>
        </div>
        {shareStatus ? <p className="share-lineup-status">{shareStatus}</p> : null}
      </div>
    </ModalShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Canvas 렌더 — 다이아몬드 그라운드(/assets/ground.png) 위에 포지션별 선수,
 * 그 아래 타순 1~9(또는 선발 + 마무리 + 불펜 7) 리스트. 미리보기는 scale=0.5, 실제 공유는 1.
 * ────────────────────────────────────────────────────────────────────────── */

type RenderOptions = {
  teamId: string;
  mode: LineupMode;
  slots: (LineupSlot | null)[];
  pitcherSlots: (string | null)[];
  playersById: Map<string, Player>;
  scale: number;
};

const BASE_W = 540;
const BASE_H = 960;
const FIELD_TOP = 130;
const FIELD_H = 440;
const LIST_TOP = 590;
const BATTER_ROW_H = 30;
const PITCHER_ROW_TOP = LIST_TOP + BATTER_ROW_H * 9 + 12; // 9번 타자 아래 간격 12px

async function renderShareCanvas(canvas: HTMLCanvasElement, opts: RenderOptions): Promise<void> {
  const { teamId, mode, slots, pitcherSlots, playersById, scale } = opts;
  const W = BASE_W * scale;
  const H = BASE_H * scale;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);

  const team = getTeam(teamId);
  const fontStack = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // 폰트 로딩 대기
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
    } catch {
      /* ignore */
    }
  }

  // 1) 배경
  const bgGrad = ctx.createLinearGradient(0, 0, 0, BASE_H);
  bgGrad.addColorStop(0, "#0d1424");
  bgGrad.addColorStop(1, "#1a2640");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  // 2) 헤더 — 팀 색 띠 + 팀명 + 모드
  const headerH = 100;
  ctx.fillStyle = team.color;
  ctx.fillRect(0, 0, BASE_W, headerH);

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 30px ${fontStack}`;
  ctx.fillText(team.name, 28, 44);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 18px ${fontStack}`;
  ctx.fillText(mode === "batter" ? "타자 라인업" : "투수 라인업", 28, 75);

  // 3) 야구장 영역 — ground.png 로드 후 합성
  try {
    const ground = await loadImage("/assets/ground.png");
    drawCover(ctx, ground, 0, FIELD_TOP, BASE_W, FIELD_H);
  } catch {
    // 이미지 실패 시 단색 필드
    ctx.fillStyle = "#1c3a26";
    ctx.fillRect(0, FIELD_TOP, BASE_W, FIELD_H);
  }

  // 4) 그라운드 어둡게 + 포지션 마커
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, FIELD_TOP, BASE_W, FIELD_H);

  // 포지션별 선수 매핑 (타순 + 모드별 선발투수)
  const playerByPosition = new Map<Position, Player>();
  slots.forEach((slot) => {
    if (!slot) return;
    if (playerByPosition.has(slot.position)) return;
    const p = playersById.get(slot.playerId);
    if (p) playerByPosition.set(slot.position, p);
  });
  // 타자/투수 모드 모두 선발 투수를 P에 표시
  const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
  if (starterId) {
    const starter = playersById.get(starterId);
    if (starter) playerByPosition.set("P", starter);
  }

  FIELD_POSITIONS.forEach((pos) => {
    const coord = POS_COORDS[pos];
    const cx = coord.left * BASE_W;
    const cy = FIELD_TOP + coord.top * FIELD_H;
    const player = playerByPosition.get(pos);
    drawFieldMarker(ctx, cx, cy, POSITION_SHORT[pos], player?.name, team.color, fontStack);
  });

  // 5) 타순/투수 리스트
  if (mode === "batter") {
    drawBatterList(ctx, slots, playersById, team.color, fontStack);
    // 9번 타자 아래 — 오늘의 선발 투수 한 줄
    drawStarterPitcherRow(ctx, pitcherSlots, playersById, team.color, fontStack);
  } else {
    drawPitcherList(ctx, pitcherSlots, playersById, team.color, fontStack);
  }

  // 6) 푸터 브랜드
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 14px ${fontStack}`;
  ctx.fillText("야구의 모든 재미가 있는 곳", BASE_W / 2, BASE_H - 36);
  ctx.fillStyle = "#ff6a2b";
  ctx.font = `900 20px ${fontStack}`;
  ctx.fillText("야구놀이터 ballnori.com", BASE_W / 2, BASE_H - 16);
}

function drawFieldMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  posLabel: string,
  playerName: string | undefined,
  color: string,
  fontStack: string
) {
  const r = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = playerName ? color : "rgba(255,255,255,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 11px ${fontStack}`;
  ctx.fillText(posLabel, cx, cy + 1);

  if (playerName) {
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 12px ${fontStack}`;
    // 이름 배경 — 가독성용
    const nameW = ctx.measureText(playerName).width;
    const padX = 6;
    const bgX = cx - nameW / 2 - padX;
    const bgY = cy + r + 4;
    const bgH = 18;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    roundRect(ctx, bgX, bgY, nameW + padX * 2, bgH, 4);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(playerName, cx, bgY + 3);
  }
}

function drawBatterList(
  ctx: CanvasRenderingContext2D,
  slots: (LineupSlot | null)[],
  playersById: Map<string, Player>,
  color: string,
  fontStack: string
) {
  const rowH = BATTER_ROW_H;
  const startY = LIST_TOP;
  const colX = 28;
  const colW = BASE_W - colX * 2;
  for (let i = 0; i < 9; i += 1) {
    const slot = slots[i];
    const player = slot ? playersById.get(slot.playerId) : undefined;
    const y = startY + i * rowH;
    const rowVisH = rowH - 4;
    const midY = y + rowVisH / 2;
    // 행 배경
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)";
    roundRect(ctx, colX, y, colW, rowVisH, 6);
    ctx.fill();
    // 번호
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(colX + 16, midY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 12px ${fontStack}`;
    ctx.fillText(String(i + 1), colX + 16, midY + 1);
    // 이름
    ctx.textAlign = "left";
    ctx.fillStyle = player ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.font = `700 14px ${fontStack}`;
    ctx.fillText(player?.name ?? "—", colX + 36, midY + 1);
    if (slot && player) {
      // 좌타/우타/양타 뱃지 — 이름 옆
      const nameW = ctx.measureText(player.name).width;
      const hand = formatHandBadge(player);
      let cursor = colX + 36 + nameW + 6;
      if (hand) {
        drawHandBadge(ctx, cursor, midY, hand.label, hand.tone, fontStack);
        cursor += 30; // 다음 요소 자리 (현재는 미사용)
      }
      void cursor;
      // 포지션 (행 우측)
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `700 11px ${fontStack}`;
      ctx.fillText(POSITION_SHORT[slot.position], colX + colW - 12, midY + 1);
    }
  }
}

/** 좌타/우타/양타, 좌투/우투 뱃지 — 작은 라운드 박스. */
function drawHandBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  midY: number,
  label: string,
  tone: "L" | "R" | "S",
  fontStack: string
) {
  const padX = 4;
  const h = 16;
  ctx.font = `800 10px ${fontStack}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width + padX * 2;
  const y = midY - h / 2;
  const bg =
    tone === "L" ? "rgba(64,156,255,0.22)" : tone === "R" ? "rgba(255,124,124,0.22)" : "rgba(180,120,255,0.24)";
  const fg = tone === "L" ? "#6db4ff" : tone === "R" ? "#ff9c9c" : "#c8a4ff";
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(label, x + padX, midY + 1);
}

/** 타자 모드 9번 타순 아래에 표시되는 오늘 선발 투수 한 줄. */
function drawStarterPitcherRow(
  ctx: CanvasRenderingContext2D,
  pitcherSlots: (string | null)[],
  playersById: Map<string, Player>,
  color: string,
  fontStack: string
) {
  const colX = 28;
  const colW = BASE_W - colX * 2;
  const y = PITCHER_ROW_TOP;
  const h = 38;
  const midY = y + h / 2;

  ctx.fillStyle = "rgba(255,106,43,0.16)";
  roundRect(ctx, colX, y, colW, h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,106,43,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 선발 배지
  ctx.fillStyle = "#ff6a2b";
  ctx.beginPath();
  ctx.arc(colX + 18, midY, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 11px ${fontStack}`;
  ctx.fillText("선발", colX + 18, midY + 1);

  const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
  const starter = starterId ? playersById.get(starterId) : undefined;
  ctx.textAlign = "left";
  ctx.fillStyle = starter ? "#ffffff" : "rgba(255,255,255,0.4)";
  ctx.font = `800 15px ${fontStack}`;
  const nameX = colX + 40;
  ctx.fillText(starter?.name ?? "—", nameX, midY + 1);

  if (starter) {
    const nameW = ctx.measureText(starter.name).width;
    const hand = formatHandBadge(starter);
    if (hand) {
      drawHandBadge(ctx, nameX + nameW + 6, midY, hand.label, hand.tone, fontStack);
    }
    // 우측 P 표시
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,106,43,0.85)";
    ctx.font = `800 11px ${fontStack}`;
    ctx.fillText(POSITION_SHORT.P, colX + colW - 12, midY + 1);
    // 등번호 (있으면)
    void color;
  }
}

function drawPitcherList(
  ctx: CanvasRenderingContext2D,
  pitcherSlots: (string | null)[],
  playersById: Map<string, Player>,
  color: string,
  fontStack: string
) {
  const startY = LIST_TOP;
  const colX = 28;
  const colW = BASE_W - colX * 2;
  // 선발 1줄
  const starterId = pitcherSlots[0];
  const starter = starterId ? playersById.get(starterId) : undefined;
  const starterH = 40;
  ctx.fillStyle = "rgba(255,106,43,0.18)";
  roundRect(ctx, colX, startY, colW, starterH, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,106,43,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ff6a2b";
  ctx.font = `900 13px ${fontStack}`;
  ctx.fillText("선발", colX + 14, startY + starterH / 2);
  ctx.fillStyle = starter ? "#ffffff" : "rgba(255,255,255,0.4)";
  ctx.font = `800 17px ${fontStack}`;
  const starterNameX = colX + 70;
  ctx.fillText(starter?.name ?? "—", starterNameX, startY + starterH / 2);
  if (starter) {
    const nameW = ctx.measureText(starter.name).width;
    const hand = formatHandBadge(starter);
    if (hand) {
      drawHandBadge(ctx, starterNameX + nameW + 8, startY + starterH / 2, hand.label, hand.tone, fontStack);
    }
  }

  // 마무리 + 불펜 7명 — 2열 4행
  const bullStartY = startY + starterH + 10;
  const cellW = (colW - 8) / 2;
  const cellH = 28;
  for (let i = 0; i < 8; i += 1) {
    const id = pitcherSlots[i + 1];
    const p = id ? playersById.get(id) : undefined;
    const slotIdx = i + 1;
    const isCloser = slotIdx === PITCHER_CLOSER_INDEX;
    const badge = isCloser ? "마" : String(slotIdx - PITCHER_REQUIRED_BULLPEN_INDEX + 1);
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = colX + col * (cellW + 8);
    const y = bullStartY + row * (cellH + 6);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, x, y, cellW, cellH, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 14, y + cellH / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 10px ${fontStack}`;
    ctx.fillText(badge, x + 14, y + cellH / 2 + 1);
    ctx.textAlign = "left";
    ctx.fillStyle = p ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.font = `700 13px ${fontStack}`;
    ctx.fillText(p?.name ?? "—", x + 30, y + cellH / 2 + 1);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = dw / dh;
  let sw: number, sh: number, sx: number, sy: number;
  if (imgRatio > boxRatio) {
    sh = img.naturalHeight;
    sw = sh * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// POSITIONS 사용처 — TS 미사용 경고 방지
void POSITIONS;
