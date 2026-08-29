"use client";

// 오늘의 라인업 예측 — 오늘 경기 중 한 팀을 골라 선발 9명과 타순·수비 위치를 맞힌다.
//
// 편집 UI는 라인업 분석(빌더)의 컴포넌트를 그대로 쓴다. 유저가 이미 익힌 조작이라
// 학습 비용이 없고, 다이아몬드·타순 스왑·포지션 변경이 전부 검증된 구현이다.
// 편집 상태만 useLineupEditor 로 따로 관리한다(빌더는 투수·저장·출전까지 얽혀 있어 공유 불가).
//
// 페이지는 정적이고 유저별 데이터는 /api/play/lineup-predict 에서 클라이언트가 받는다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, Lock, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { LineupDiamond } from "@/components/domain/LineupDiamond";
import { BatterSlotList } from "@/components/domain/lineup/BatterSlotList";
import { LineupPoolCard } from "@/components/domain/lineup/LineupPoolCard";
import { PositionPickerModal } from "@/components/domain/lineup/modals/PositionPickerModal";
import { RecentLineupPickerModal } from "@/components/domain/modals/RecentLineupPickerModal";
import { ShareLineupModal } from "@/components/domain/modals/ShareLineupModal";
import type { RecentLineupRow } from "@/lib/supabase/query-parts/bpRecentLineups";
import { useAppState } from "@/lib/state/AppState";
import { teams as KBO_TEAMS } from "@/lib/constants/teams";
import { getRoster } from "@/lib/rosters";
import { useLineupEditor } from "@/lib/lineup/useLineupEditor";
import { getFallbackOrder, type SlotState } from "@/lib/lineup/swapHelpers";
import {
  normalizeKboPosition,
  type LineupOrder,
  type LineupSlot,
  type Player,
  type Position
} from "@/lib/types/lineup";
import type { LineupPick } from "@/lib/lineupPredict/scoring";

type PredictableTeam = {
  gameId: string;
  teamId: string;
  opponentId: string;
  isHome: boolean;
  gameTime: string;
  stadium: string | null;
  opponentStarter: string | null;
  ownStarter: string | null;
  defaultPicks: Array<LineupPick & { position?: string | null }>;
  defaultFromDate: string | null;
  locked: boolean;
};

type ScoreDetailRow = {
  order: number;
  name: string;
  result: "exact" | "hit" | "miss";
  actualName: string | null;
  positionCorrect: boolean;
};

type ScoredResult = {
  gameDate: string;
  teamId: string;
  hitCount: number;
  exactCount: number;
  /** 수비 보너스. 지표 도입 전 채점분은 null. */
  positionCount: number | null;
  detail: ScoreDetailRow[] | null;
};

type ApiResponse = {
  date: string;
  teams: PredictableTeam[];
  myPrediction: { game_id: string; team_id: string; picks: LineupPick[] } | null;
  stats: { played: number; totalHit: number; totalExact: number; bestHit: number } | null;
  recentResults: ScoredResult[];
};

function shortName(teamId: string): string {
  return KBO_TEAMS.find((t) => t.id === teamId)?.shortName ?? teamId.toUpperCase();
}

function teamColorOf(teamId: string): string {
  return KBO_TEAMS.find((t) => t.id === teamId)?.color ?? "#6b7280";
}

function formatDate(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 저장·전송용 픽 목록 → 편집용 슬롯. 매칭 안 되는 선수는 빈 자리로 둔다.
 *
 * 포지션 우선순위: 픽에 담긴 값 → 직전 경기 라인업의 그 선수 포지션 → 선수 기본 포지션.
 * 로스터의 primaryPosition 은 KBO 가 내야수/외야수로만 분류해 3B·CF 로 뭉쳐 있어서,
 * 그것만으로 채우면 3루수 넷·중견수 셋 같은 배치가 나온다. 실제 포지션을 최대한 살린다.
 */
function picksToSlots(
  picks: Array<LineupPick & { position?: string | null }>,
  byId: Map<string, Player>,
  byName: Map<string, Player>,
  fallbackPositionByPlayerId?: Map<string, Position>
): SlotState[] {
  const slots: SlotState[] = Array.from({ length: 9 }, () => null);
  const resolved: Array<{ idx: number; player: Player; wanted: Position; certain: boolean }> = [];

  for (const pick of picks) {
    if (pick.order < 1 || pick.order > 9) continue;
    const player = (pick.rosterId && byId.get(pick.rosterId)) || byName.get(pick.name);
    if (!player) continue;
    // 박스스코어 포지션은 "三"처럼 한자 표기로 오기도 한다.
    const fromPick = normalizeKboPosition(pick.position ?? "");
    const fromRecent = fallbackPositionByPlayerId?.get(player.id) ?? null;
    resolved.push({
      idx: pick.order - 1,
      player,
      wanted: (fromPick ?? fromRecent ?? player.primaryPosition) as Position,
      // 근거 있는 포지션인지 — 없으면 자리 경합에서 양보시킨다.
      certain: Boolean(fromPick ?? fromRecent)
    });
  }

  // 근거가 확실한 자리부터 확정하고, 남은 선수는 비어 있는 포지션으로 밀어 넣는다.
  // 로스터의 primaryPosition 은 KBO 분류상 내야수=3B·외야수=CF 로 뭉쳐 있어서
  // 그대로 두면 3루수 넷 같은 배치가 되고, 유격수 자리가 통째로 사라진다.
  const used = new Set<Position>();
  const place = (entry: (typeof resolved)[number]) => {
    let position = entry.wanted;
    if (used.has(position)) {
      const candidates = getFallbackOrder(entry.player.primaryPosition);
      position = candidates.find((p) => p !== "P" && !used.has(p)) ?? position;
    }
    used.add(position);
    slots[entry.idx] = {
      order: (entry.idx + 1) as LineupOrder,
      playerId: entry.player.id,
      position
    };
  };
  resolved.filter((r) => r.certain).forEach(place);
  resolved.filter((r) => !r.certain).forEach(place);

  return slots;
}

function slotsToPicks(slots: SlotState[], byId: Map<string, Player>): LineupPick[] {
  return slots
    .filter((s): s is LineupSlot => s !== null)
    .map((s) => ({
      order: s.order,
      name: byId.get(s.playerId)?.name ?? "",
      rosterId: s.playerId,
      // 포지션까지 저장해야 다시 열었을 때 다이아몬드 배치가 그대로 복원된다.
      position: s.position
    }))
    .filter((p) => p.name);
}

export function LineupPredictScreen() {
  const { showToast, profile } = useAppState();
  const favoriteTeamId = profile?.mainTeamId ?? null;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [recentPickerOpen, setRecentPickerOpen] = useState(false);
  const [resultDetail, setResultDetail] = useState<ScoredResult | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  /** 제출 직후 공유를 권하는 시트. 제출 흐름이 끝난 순간이 공유 동기가 가장 크다. */
  const [shareAskOpen, setShareAskOpen] = useState(false);

  const selected = useMemo(
    () => data?.teams.find((t) => t.teamId === selectedTeamId) ?? null,
    [data, selectedTeamId]
  );

  // 투수는 타순에 들어가지 않는다(DH 제도).
  const roster = useMemo(
    () => (selected ? getRoster(selected.teamId).filter((p) => p.primaryPosition !== "P") : []),
    [selected]
  );
  const rosterByName = useMemo(() => new Map(roster.map((p) => [p.name, p])), [roster]);

  const editor = useLineupEditor({ players: roster, onToast: showToast });
  const { replaceAll, playersById } = editor;

  /**
   * 다이아몬드에만 얹는 선발투수. 마운드가 비어 있으면 그라운드가 허전하고,
   * 좌완/우완 정보가 라인업을 짤 때 실제로 쓰인다.
   * 예측 대상이 아니라 편집용 slots 와 분리해 표시 전용 배열을 따로 만든다.
   */
  const starterPlayer = useMemo(() => {
    if (!selected?.ownStarter) return null;
    return (
      getRoster(selected.teamId).find(
        (p) => p.primaryPosition === "P" && p.name === selected.ownStarter
      ) ?? null
    );
  }, [selected]);

  const diamondSlots = useMemo(() => {
    if (!starterPlayer) return editor.slots;
    return [
      ...editor.slots,
      // order 는 다이아몬드 렌더에 쓰이지 않는다. 타순 밖 자리라 10을 넣어 구분한다.
      { order: 10 as LineupOrder, playerId: starterPlayer.id, position: "P" as Position }
    ];
  }, [editor.slots, starterPlayer]);

  const diamondPlayersById = useMemo(() => {
    if (!starterPlayer) return playersById;
    const next = new Map(playersById);
    next.set(starterPlayer.id, starterPlayer);
    return next;
  }, [playersById, starterPlayer]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/play/lineup-predict");
        const json = (await res.json()) as ApiResponse;
        if (!alive) return;
        setData(json);
        // 우선순위: 이미 제출한 팀 → 응원팀(오늘 경기가 있을 때) → 마감 안 된 첫 팀.
        const favoriteToday = favoriteTeamId
          ? json.teams.find((t) => t.teamId === favoriteTeamId && !t.locked)
          : undefined;
        setSelectedTeamId(
          json.myPrediction?.team_id ??
            favoriteToday?.teamId ??
            json.teams.find((t) => !t.locked)?.teamId ??
            json.teams[0]?.teamId ??
            null
        );
      } catch {
        if (alive) showToast("경기 정보를 불러오지 못했어요");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [showToast, favoriteTeamId]);

  // 팀이 정해지면 슬롯을 채운다. 제출 이력이 있으면 그걸, 없으면 직전 경기 라인업을.
  // roster 가 준비된 뒤에 돌아야 하므로 selected·roster 를 함께 의존한다.
  useEffect(() => {
    if (!selected || roster.length === 0) return;
    const byId = new Map(roster.map((p) => [p.id, p]));

    // 직전 경기 라인업의 선수별 실제 포지션 — 저장된 예측에 포지션이 없거나
    // 이전 버전에서 뭉개진 값이 들어 있을 때 이걸로 되살린다.
    const fallbackPosition = new Map<string, Position>();
    for (const pick of selected.defaultPicks) {
      const player = (pick.rosterId && byId.get(pick.rosterId)) || rosterByName.get(pick.name);
      const pos = normalizeKboPosition(pick.position ?? "");
      if (player && pos) fallbackPosition.set(player.id, pos);
    }

    const isMine = data?.myPrediction?.team_id === selected.teamId;
    const source = isMine ? data!.myPrediction!.picks : selected.defaultPicks;
    replaceAll(picksToSlots(source, byId, rosterByName, fallbackPosition));
  }, [selected, roster, rosterByName, data?.myPrediction, data, replaceAll]);

  /** 최근 경기 라인업 불러오기 — 기본값(직전 경기) 말고 다른 날 라인업을 골라 채운다.
   *  상대 선발 좌/우에 따라 라인업이 달라지므로, 비슷한 매치업이었던 날을 참고하는 흐름이다. */
  const applyRecentLineup = useCallback(
    (row: RecentLineupRow) => {
      const byId = new Map(roster.map((p) => [p.id, p]));
      const picks = [...row.batting]
        .sort((a, b) => a.order - b.order)
        .slice(0, 9)
        .map((b) => ({ order: b.order, name: b.name, rosterId: b.rosterId, position: b.position }));
      const slots = picksToSlots(picks, byId, rosterByName);
      const missing = 9 - slots.filter((s) => s !== null).length;
      replaceAll(slots);
      setRecentPickerOpen(false);
      showToast(missing > 0 ? `${missing}자리는 명단에 없어 비워뒀어요` : "최근 라인업을 불러왔어요");
    },
    [roster, rosterByName, replaceAll, showToast]
  );

  /**
   * 결과 공유 — 이미 끝난 경기라 정답을 가리지 않는다.
   * 타순별 판정을 3열로 묶어 세 줄에 담는다. 아홉 줄로 늘어놓으면 메신저에서 잘린다.
   */
  const shareResult = useCallback(
    async (result: ScoredResult) => {
      const head = `⚾ ${formatDate(result.gameDate)} ${shortName(result.teamId)} 라인업 예측`;
      const summary =
        `선발 ${result.hitCount}명 적중 · 타순 ${result.exactCount}개 정확` +
        (result.positionCount !== null ? ` · 수비 ${result.positionCount}` : "");

      const mark = (row: ScoreDetailRow) =>
        row.result === "exact" ? "✅" : row.result === "hit" ? "🟡" : "⬜";
      const lines: string[] = [];
      const detail = result.detail ?? [];
      for (let i = 0; i < detail.length; i += 3) {
        lines.push(
          detail
            .slice(i, i + 3)
            .map((row) => `${row.order} ${row.name} ${mark(row)}`)
            .join("   ")
        );
      }

      const text = [head, summary, "", ...lines, "", "야구놀이터 → https://ballnori.com/play/lineup-predict"]
        .join("\n")
        .trim();

      try {
        if (navigator.share) {
          await navigator.share({ text });
          return;
        }
        await navigator.clipboard.writeText(text);
        showToast("결과를 복사했어요");
      } catch {
        /* 사용자가 공유를 취소한 경우 — 조용히 무시 */
      }
    },
    [showToast]
  );

  const submit = useCallback(async () => {
    if (!data || !selected) return;
    const picks = slotsToPicks(editor.slots, playersById);
    if (picks.length !== 9) {
      showToast("타순 9자리를 모두 채워주세요");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/play/lineup-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: data.date, gameId: selected.gameId, teamId: selected.teamId, picks })
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "제출에 실패했어요");
        return;
      }
      setData((prev) =>
        prev ? { ...prev, myPrediction: { game_id: selected.gameId, team_id: selected.teamId, picks } } : prev
      );
      // 토스트는 생략 — 바로 뜨는 공유 모달이 "예측을 저장했어요"를 이미 안내한다(중복 제거).
      setShareAskOpen(true);
    } catch {
      showToast("제출에 실패했어요");
    } finally {
      setSubmitting(false);
    }
  }, [data, selected, editor.slots, playersById, showToast]);

  const alreadySubmitted = data?.myPrediction?.team_id === selectedTeamId;
  const isLocked = selected?.locked ?? true;

  return (
    <AppShell
      activeTab="play"
      title="오늘의 라인업 예측"
      // 라인업 CSS 가 .phone-frame-light 스코프라 라이트 테마여야 적용된다.
      theme="light"
      backHref="/"
      headerAction={
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="도움말"
          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <Info className="h-[18px] w-[18px]" />
        </button>
      }
    >
      <div className="mx-auto w-full max-w-md px-3 pb-24 pt-3">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
          </div>
        )}

        {!loading && data && data.teams.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">오늘은 예측할 경기가 없어요.</p>
          </div>
        )}

        {!loading && data && data.teams.length > 0 && (
          <>
            {/* 결과와 예측은 같은 자리에서 일어난다. 들어오면 "어제 내 예측이 어땠나"가
                먼저 궁금하므로 최근 결과를 맨 위에 두고, 상세는 눌러서 보게 한다. */}
            {data.recentResults?.[0] && (
              <button
                type="button"
                onClick={() => setResultDetail(data.recentResults[0])}
                className="mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left"
                style={{
                  borderColor: `${teamColorOf(data.recentResults[0].teamId)}33`,
                  background: `${teamColorOf(data.recentResults[0].teamId)}0d`
                }}
              >
                <span
                  className="h-7 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: teamColorOf(data.recentResults[0].teamId) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-slate-500">
                    {formatDate(data.recentResults[0].gameDate)}{" "}
                    {shortName(data.recentResults[0].teamId)} 예측 결과
                  </span>
                  <span className="block text-sm font-bold text-slate-900">
                    선발 {data.recentResults[0].hitCount}명 적중 · 타순{" "}
                    {data.recentResults[0].exactCount}개 정확
                    {data.recentResults[0].positionCount !== null && (
                      <span className="font-medium text-slate-500">
                        {" "}
                        · 수비 {data.recentResults[0].positionCount}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            )}

            {selected && (
              <>
                {/* 팀 선택 + 경기 정보를 한 줄로. 편집 영역(다이아몬드·타순)에 공간을 최대한 넘긴다. */}
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <select
                        value={selectedTeamId ?? ""}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        aria-label="예측할 팀"
                        className="appearance-none rounded-lg py-1.5 pl-3 pr-7 text-sm font-bold text-white outline-none"
                        style={{ backgroundColor: teamColorOf(selected.teamId) }}
                      >
                        {data.teams.map((t) => (
                          <option key={`${t.gameId}-${t.teamId}`} value={t.teamId}>
                            {shortName(t.teamId)}
                            {t.locked ? " (마감)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/80" />
                    </div>
                    <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                      {formatDate(data.date)} {selected.isHome ? "vs" : "@"} {shortName(selected.opponentId)} ·{" "}
                      {selected.gameTime}
                      {selected.stadium && (
                        <span className="font-medium text-slate-400"> · {selected.stadium}</span>
                      )}
                    </p>
                    {isLocked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  </div>

                  {/* 마감 안내만 둘째 줄로 — 평소에는 한 줄로 끝난다. */}
                  {isLocked && (
                    <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                      예측이 마감됐어요. 경기 시작 3시간 전까지 제출할 수 있어요.
                    </p>
                  )}
                </div>

                {/* 수비 위치 — 마커 두 번 탭으로 두 포지션을 맞바꾼다. */}
                <section className="lineup-diamond-card">
                  <LineupDiamond
                    slots={diamondSlots}
                    playersById={diamondPlayersById}
                    teamColor={teamColorOf(selected.teamId)}
                    selectedPosition={editor.swapSource}
                    onPositionClick={isLocked ? undefined : editor.diamondPositionClick}
                    travelers={editor.swapTravelers}
                  />
                </section>

                <div className="lineup-layout mt-2 grid grid-cols-2 gap-2">
                  <BatterSlotList
                    slots={editor.slots}
                    filledCount={editor.filledCount}
                    playersById={playersById}
                    swapOrderSourceIdx={editor.swapOrderSourceIdx}
                    swapOrderAnimation={editor.swapOrderAnimation}
                    isLocked={isLocked}
                    onOrderClick={editor.orderClick}
                    onPositionPickerOpen={editor.setPositionPickerForOrder}
                    onRemove={editor.removeSlot}
                    onReset={() => setResetConfirmOpen(true)}
                    onLockedClick={() => showToast("예측이 마감됐어요")}
                  />
                  <LineupPoolCard
                    poolPlayers={editor.poolPlayers}
                    isLocked={isLocked}
                    onAddPlayer={editor.addPlayer}
                    onLockedClick={() => showToast("예측이 마감됐어요")}
                    headerAction={
                      isLocked ? undefined : (
                        <button
                          type="button"
                          className="lineup-clear-btn"
                          onClick={() => setRecentPickerOpen(true)}
                          aria-label="최근 경기 라인업 불러오기"
                        >
                          최근경기라인업
                        </button>
                      )
                    }
                  />
                </div>

                {!isLocked && (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || editor.filledCount !== 9}
                    className="mt-3 w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.99] disabled:bg-slate-300"
                  >
                    {submitting ? "저장 중…" : alreadySubmitted ? "예측 수정하기" : "예측 제출하기"}
                  </button>
                )}

                {alreadySubmitted && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <p className="text-[11px] text-slate-400">제출 완료. 경기가 끝나면 결과를 알려드려요.</p>
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-slate-600 underline-offset-2 hover:underline"
                    >
                      <Share2 className="h-3 w-3" />
                      공유
                    </button>
                  </div>
                )}

                {/* 지난 예측 결과 — 채점은 경기 종료 후 마감 sync 때 이뤄진다. */}
                {data.recentResults?.length > 0 && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="pb-1 text-xs font-semibold text-slate-400">지난 예측 결과</p>
                    <ul>
                      {data.recentResults.map((r) => (
                        <li key={`${r.gameDate}-${r.teamId}`} className="border-t border-slate-100 first:border-t-0">
                          <button
                            type="button"
                            onClick={() => setResultDetail(r)}
                            className="flex w-full items-center gap-2 py-2 text-left"
                          >
                            <span
                              className="h-5 w-1 rounded-full"
                              style={{ backgroundColor: teamColorOf(r.teamId) }}
                            />
                            <span className="text-xs font-semibold text-slate-700">
                              {formatDate(r.gameDate)} {shortName(r.teamId)}
                            </span>
                            <span className="ml-auto text-xs text-slate-500">
                              적중 <b className="text-slate-900">{r.hitCount}</b>
                              <span className="mx-1.5 text-slate-300">·</span>
                              타순 <b className="text-slate-900">{r.exactCount}</b>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.stats && data.stats.played > 0 && (
                  <div className="mt-3 flex justify-center gap-6 rounded-xl border border-slate-200 bg-white py-2.5 text-center">
                    <div>
                      <p className="text-base font-extrabold text-slate-900">{data.stats.played}</p>
                      <p className="text-[11px] text-slate-400">참여</p>
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-slate-900">
                        {(data.stats.totalHit / data.stats.played).toFixed(1)}
                      </p>
                      <p className="text-[11px] text-slate-400">평균 적중</p>
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-slate-900">{data.stats.bestHit}</p>
                      <p className="text-[11px] text-slate-400">최고 기록</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <PositionPickerModal
        order={editor.positionPickerForOrder}
        slots={editor.slots}
        onClose={() => editor.setPositionPickerForOrder(null)}
        onPick={editor.changePosition}
      />

      {selected && (
        <RecentLineupPickerModal
          open={recentPickerOpen}
          teamId={selected.teamId}
          onClose={() => setRecentPickerOpen(false)}
          onPick={applyRecentLineup}
        />
      )}

      {/* 라인업 분석의 공유 카드를 그대로 쓴다 — 그라운드 배치를 이미지로 그려준다.
          투수는 예측 대상이 아니라 빈 배열을 넘긴다. */}
      {selected && (
        <ShareLineupModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          teamId={selected.teamId}
          mode="batter"
          slots={editor.slots}
          pitcherSlots={[]}
          playersById={playersById}
        />
      )}

      <ModalShell
        open={shareAskOpen}
        onClose={() => setShareAskOpen(false)}
        title="예측을 저장했어요"
        panelClassName="lineup-confirm-modal-panel"
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>내가 예측한 라인업을 친구들에게 공유해볼까요?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShareAskOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"
            >
              나중에
            </button>
            <button
              type="button"
              onClick={() => {
                setShareAskOpen(false);
                setShareOpen(true);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
            >
              <Share2 className="h-4 w-4" />
              공유하기
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="라인업 비우기"
      >
        <div className="space-y-4 text-sm text-slate-600">
          <p>타순을 모두 비울까요?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResetConfirmOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                editor.reset();
                setResetConfirmOpen(false);
              }}
              className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white"
            >
              비우기
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        open={resultDetail !== null}
        onClose={() => setResultDetail(null)}
        title={
          resultDetail
            ? `${formatDate(resultDetail.gameDate)} ${shortName(resultDetail.teamId)} 예측 결과`
            : "예측 결과"
        }
      >
        {resultDetail && (
          <div className="space-y-3">
            <div className="flex justify-center gap-7 rounded-xl bg-slate-50 py-3 text-center">
              <div>
                <p className="text-xl font-extrabold text-slate-900">{resultDetail.hitCount}</p>
                <p className="text-[11px] text-slate-500">선발 적중</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{resultDetail.exactCount}</p>
                <p className="text-[11px] text-slate-500">타순까지</p>
              </div>
              {resultDetail.positionCount !== null && (
                <div>
                  <p className="text-xl font-extrabold text-slate-500">{resultDetail.positionCount}</p>
                  <p className="text-[11px] text-slate-400">수비 보너스</p>
                </div>
              )}
            </div>

            {resultDetail.detail ? (
              <ul className="text-sm">
                {resultDetail.detail.map((row) => (
                  <li
                    key={row.order}
                    className="flex items-center gap-2.5 border-t border-slate-100 py-2 first:border-t-0"
                  >
                    <span className="w-4 text-center text-xs font-bold text-slate-300">{row.order}</span>
                    <span
                      className={`font-semibold ${row.result === "miss" ? "text-slate-400 line-through" : "text-slate-800"}`}
                    >
                      {row.name}
                    </span>
                    {row.positionCorrect && (
                      <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-600">
                        수비
                      </span>
                    )}
                    <span className="ml-auto text-[11px]">
                      {row.result === "exact" && <span className="font-bold text-emerald-600">타순까지 정답</span>}
                      {row.result === "hit" && <span className="font-bold text-amber-600">선발에는 포함</span>}
                      {row.result === "miss" && (
                        <span className="text-slate-400">
                          실제 {row.actualName ?? "-"}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                이 경기의 실제 라인업 기록을 찾지 못해 상세를 표시할 수 없어요.
              </p>
            )}

            <button
              type="button"
              onClick={() => shareResult(resultDetail)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white active:scale-[0.99]"
            >
              <Share2 className="h-4 w-4" />
              결과 공유하기
            </button>
          </div>
        )}
      </ModalShell>

      {/* 워들 게임방법과 같은 중앙 정렬 패널 — 하단 시트보다 읽기 흐름이 자연스럽다. */}
      <ModalShell
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="오늘의 라인업 예측"
        panelClassName="lineup-confirm-modal-panel"
      >
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p>오늘 경기 중 한 팀을 골라 선발 9명과 타순을 예측해요. 하루에 한 팀만 예측할 수 있어요.</p>
          <p>
            <b className="text-slate-800">경기 시작 3시간 전에 마감</b>돼요. 실제 라인업이 공개되기 전에
            마감해야 예측이 의미가 있으니까요. 오늘 경기가 모두 마감되면 다음 날 경기로 넘어가요.
          </p>
          <p>
            채점은 <b className="text-slate-800">적중</b>(실제 선발 명단에 든 수)과{" "}
            <b className="text-slate-800">타순 정확</b>(자리까지 맞은 수) 두 가지로 해요. 수비 위치는
            채점에 넣지 않아요.
          </p>
          <p className="text-xs text-slate-400">
            직전 경기 라인업이 기본으로 채워져 있어요. 타순 번호를 두 번 탭하면 자리가 바뀌고, 그라운드의
            수비 위치도 두 번 탭해서 맞바꿀 수 있어요.
          </p>
        </div>
      </ModalShell>
    </AppShell>
  );
}
