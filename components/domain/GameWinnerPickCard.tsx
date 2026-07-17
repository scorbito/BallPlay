"use client";

// 단일 경기 승리팀 픽 카드 — AI 예측 상세 페이지에 붙는 "승리팀 예측 1경기 버전".
// 규칙은 승리팀 예측 화면(WinnerPredictScreen)과 완전히 동일:
//   - 팀 선택 = 예측 확정 (locked_at 즉시 기록)
//   - 다른 팀 선택 = 변경 / 같은 팀 재선택 = 취소
//   - 경기 시작 시각이 지나면 자동 잠금 (DB 트리거가 최종 강제)
//
// 상위 페이지가 revalidate 캐시라 사용자별 픽은 서버에서 못 읽는다 → 클라에서 조회.

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import { ensureAwayFill } from "@/lib/utils/teamColors";
import { useAppState } from "@/lib/state/AppState";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousClient } from "@/lib/supabase/ensureAnonymousClient";
import { deletePrediction, upsertPrediction } from "@/lib/supabase/query-parts/bpPredictions";
import { emitPointBalanceUpdated } from "@/components/domain/points/pointEvents";
import { POINT_LABEL } from "@/lib/points/config";
import { trackEvent } from "@/lib/analytics/events";

type Props = {
  gameId: string;
  gameDate: string;
  gameTime: string | null;
  homeTeamId: string;
  awayTeamId: string;
};

// 경기 시작 시각(KST) → epoch ms. gameTime 없으면 null(판단 불가 → 시작 전 취급).
function gameStartMs(dateISO: string, gameTime: string | null): number | null {
  if (!gameTime) return null;
  const ms = Date.parse(`${dateISO}T${gameTime.slice(0, 5)}:00+09:00`);
  return Number.isNaN(ms) ? null : ms;
}

export function GameWinnerPickCard({ gameId, gameDate, gameTime, homeTeamId, awayTeamId }: Props) {
  const { showToast } = useAppState();
  const [picked, setPicked] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, startSaving] = useTransition();
  // 다른 사람들의 선택 집계 — 내가 픽한 뒤에만 노출(밴드왜건 방지).
  const [tally, setTally] = useState<{ total: number; teams: Record<string, number> } | null>(null);

  const loadTally = useCallback(async () => {
    try {
      const res = await fetch(`/api/predict/ai-winner/${gameId}/pick-tally`);
      const data = await res.json();
      if (data && typeof data.total === "number") setTally(data);
    } catch {
      // 집계 실패는 무시 — 막대만 안 보임.
    }
  }, [gameId]);

  // 페이지를 열어둔 채 시작 시각이 지나도 마감이 반영되도록 15초마다 갱신.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  // 기존 픽 조회 — 세션이 이미 있을 때만. (조회만으로 익명 계정을 만들지 않는다)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = createSupabaseBrowserClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) return;
        const { data } = await client
          .from("bp_predictions")
          .select("predicted_winner_team_id")
          .eq("user_id", user.id)
          .eq("game_id", gameId)
          .maybeSingle();
        if (!cancelled) {
          const myPick = data?.predicted_winner_team_id ?? null;
          setPicked(myPick);
          // 이미 픽한 상태로 진입 → 집계 즉시 노출.
          if (myPick) void loadTally();
        }
      } catch {
        // 조회 실패는 무시 — 픽 없음으로 표시.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const start = gameStartMs(gameDate, gameTime);
  const started = start !== null && nowMs >= start;
  const editable = !started;

  const handlePick = useCallback(
    (teamId: string) => {
      if (!editable) return;
      const prev = picked;
      const isCancel = prev === teamId;
      setPicked(isCancel ? null : teamId);

      startSaving(async () => {
        const client = createSupabaseBrowserClient();
        // 예측 저장은 "행동" → 세션 없으면 이 시점에 익명 계정 lazy 생성.
        const userId = await ensureAnonymousClient(client);
        if (!userId) {
          showToast("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
          setPicked(prev);
          return;
        }

        if (isCancel) {
          const res = await deletePrediction(client, userId, gameId);
          if (!res.ok) {
            showToast(`취소 실패: ${res.error}`);
            setPicked(prev);
            return;
          }
          setTally(null); // 취소 시 집계 숨김 — 다시 픽해야 공개.
          showToast("예측을 취소했어요.");
          return;
        }

        const res = await upsertPrediction(client, {
          userId,
          gameId,
          gameDate,
          predictedWinnerTeamId: teamId
        });
        if (!res.ok) {
          showToast(`저장 실패: ${res.error}`);
          setPicked(prev);
          return;
        }
        void trackEvent("prediction_submitted", { gameDate, gameId });

        // BP 지급 — rewardKey 로 경기당 1회 멱등이라 중복 지급 없음.
        let awarded = 0;
        try {
          const r = await fetch("/api/points/prediction-submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameDate })
          });
          const d = await r.json();
          if (r.ok && d.ok) {
            emitPointBalanceUpdated(d.balance);
            awarded = Number(d.awarded ?? 0);
          }
        } catch {
          // BP 실패가 예측을 막지 않는다.
        }
        // 선택됨은 버튼 하이라이트·체크로 이미 보이므로, 토스트는 BP를 실제로 받았을 때만.
        // (BP는 경기당 1회라 팀을 바꿔 다시 눌러도 토스트가 반복되지 않는다)
        if (awarded > 0) {
          showToast(`예측 완료!\n${awarded.toLocaleString()}${POINT_LABEL} 획득!`);
        }
        // 픽 확정 후 다른 사람들의 선택 공개(내 픽 1표 포함).
        void loadTally();
      });
    },
    [editable, picked, gameId, gameDate, showToast, loadTally]
  );

  if (!loaded) return null;

  // 원정 → 홈 순서 (승리팀 예측 화면과 동일)
  const away = getTeam(awayTeamId);
  const home = getTeam(homeTeamId);
  const sides = [
    { id: awayTeamId, team: away },
    { id: homeTeamId, team: home }
  ];

  // 집계 막대 — 내가 픽한 뒤(tally!=null)에만 노출.
  const awayCount = tally?.teams[awayTeamId] ?? 0;
  const homeCount = tally?.teams[homeTeamId] ?? 0;
  const tallyTotal = awayCount + homeCount;
  const awayPct = tallyTotal > 0 ? (awayCount / tallyTotal) * 100 : 0;
  const homePct = tallyTotal > 0 ? (homeCount / tallyTotal) * 100 : 0;

  return (
    <section className="ai-reveal-pick">
      <h2 className="ai-reveal-pick-title">내 승리팀 예측</h2>
      <div className="ai-reveal-pick-teams">
        {sides.map(({ id, team }) => (
          <button
            key={id}
            type="button"
            className={`ai-reveal-pick-btn${picked === id ? " is-picked" : ""}`}
            onClick={() => handlePick(id)}
            disabled={!editable || saving}
            aria-pressed={picked === id}
          >
            <TeamBadge teamId={id} size="sm" />
            <span className="ai-reveal-pick-name">{team.shortName}</span>
            {picked === id ? (
              <Check size={14} strokeWidth={3} className="ai-reveal-pick-check" aria-label="내 픽" />
            ) : null}
          </button>
        ))}
      </div>
      <p className="ai-reveal-pick-hint">
        {!editable
          ? "경기가 시작되어 예측이 마감됐어요"
          : picked
            ? "같은 팀을 다시 누르면 취소돼요"
            : "팀을 선택하면 바로 예측돼요"}
      </p>

      {/* 다른 사람들의 선택 — 내가 픽한 뒤에만 (밴드왜건 방지) */}
      {tally && tallyTotal > 0 ? (
        <div className="ai-reveal-pick-tally">
          <span className="ai-reveal-pick-tally-label">
            👥 다른 사람들의 선택 · 총 {tallyTotal.toLocaleString()}명
          </span>
          <div className="ai-reveal-pick-tally-counts">
            <span>{away.shortName} {Math.round(awayPct)}%</span>
            <span>{home.shortName} {Math.round(homePct)}%</span>
          </div>
          <div className="h2h-bar-container ai-reveal-pick-tally-bar">
            <div className="h2h-bar" style={{ width: `${awayPct}%`, background: away.color }} />
            <div className="h2h-bar-gap" style={{ marginLeft: "auto" }} />
            <div
              className="h2h-bar"
              style={{ width: `${homePct}%`, background: ensureAwayFill(away.color, home.color, home.accent) }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
