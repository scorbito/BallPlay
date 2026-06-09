"use client";

import { useState, useEffect } from "react";
import { getTeam } from "@/lib/constants/teams";
import { TeamBadge } from "@/components/common/TeamBadge";
import { MessageCircle, ShieldAlert, Award, Star, ThumbsUp, ArrowRight } from "lucide-react";

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
function ensureAwayFill(homeHex: string, awayHex: string, awayAccent?: string): string {
  const home = hexToRgb(homeHex);
  const away = hexToRgb(awayHex);
  if (colorDist(home, away) >= 110) return awayHex;
  if (awayAccent) {
    const acc = hexToRgb(awayAccent);
    if (colorDist(home, acc) >= 110) return awayAccent;
  }
  const lighter: [number, number, number] = [home[0] + (255 - home[0]) * 0.55, home[1] + (255 - home[1]) * 0.55, home[2] + (255 - home[2]) * 0.55];
  const darker: [number, number, number] = [away[0] * 0.5, away[1] * 0.5, away[2] * 0.5];
  const chosen = colorDist(home, lighter) >= colorDist(home, darker) ? lighter : darker;
  return rgbToHex(chosen[0], chosen[1], chosen[2]);
}

export type BattlePredictionRow = {
  id: string;
  game_id: string;
  game_date: string;
  target_side: "home" | "away";
  ai_provider: "gemini" | "claude" | "gpt";
  model_name: string | null;
  predicted_winner_team_id: string;
  key_factor: string;
  one_liner: string;
  detailed_analysis: string;
  counter_argument: string;
  published_at: string;
  is_correct: boolean | null;
};

type Props = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  predictions: BattlePredictionRow[];
  gameStatus: string;
};

export function AiWinnerBattleTab({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  predictions,
  gameStatus
}: Props) {
  const homeTeam = getTeam(homeTeamId);
  const awayTeam = getTeam(awayTeamId);

  const AI_LABEL: Record<string, string> = { gemini: "Gemini", gpt: "GPT", claude: "Claude" };

  // target_side별 매핑
  const homePred = predictions.find((p) => p.target_side === "home");
  const awayPred = predictions.find((p) => p.target_side === "away");

  const gameId = homePred?.game_id ?? "unknown";

  const [votedSide, setVotedSide] = useState<"home" | "away" | null>(null);
  const [voteCount, setVoteCount] = useState({ home: 0, away: 0 });
  const [voteLoaded, setVoteLoaded] = useState(false);

  useEffect(() => {
    if (gameId === "unknown") return;
    fetch(`/api/predict/ai-winner/${gameId}/vote`)
      .then((r) => r.json())
      .then((d) => {
        setVoteCount({ home: d.home ?? 0, away: d.away ?? 0 });
        if (d.myVote) setVotedSide(d.myVote);
        setVoteLoaded(true);
      })
      .catch(() => setVoteLoaded(true));
  }, [gameId]);

  const handleVote = async (side: "home" | "away") => {
    if (votedSide || !voteLoaded) return;
    setVotedSide(side);
    setVoteCount((prev) => ({ ...prev, [side]: prev[side] + 1 }));
    try {
      const res = await fetch(`/api/predict/ai-winner/${gameId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side })
      });
      if (res.ok) {
        const d = await res.json();
        setVoteCount({ home: d.home ?? 0, away: d.away ?? 0 });
      }
    } catch {
      // best-effort
    }
  };

  const totalVotes = voteCount.home + voteCount.away;
  const homePct = Math.round((voteCount.home / totalVotes) * 100);
  const awayPct = 100 - homePct;

  const isFinished = gameStatus === "finished";

  if (!homePred || !awayPred) {
    return (
      <div className="ai-battle-empty">
        <div className="ai-battle-empty-icon">🤖</div>
        <p className="ai-battle-empty-title">오늘의 승리회로 배틀 분석 중</p>
        <p className="ai-battle-empty-sub">
          두 AI의 흥미진진한 편파 승리 시나리오 배틀이 곧 공개됩니다!
        </p>
      </div>
    );
  }

  return (
    <section className="ai-battle-container">
      {/* ── 타이틀 코멘트 ── */}
      <div className="ai-battle-intro">
        <h3 className="ai-battle-intro-title">
          <span>🔥</span> AI 편파 승리회로 배틀 <span>🔥</span>
        </h3>
        <p className="ai-battle-intro-desc">
          각 팀의 대변인 AI가 <strong>&quot;무조건 이기는 시나리오&quot;</strong>를 돌립니다.<br />
          양쪽의 설득력 넘치는(?) 행복회로를 직접 비교해 보세요!
        </p>
      </div>

      {/* ── 배틀 뷰 (좌우 대비 레이아웃) ── */}
      <div className="ai-battle-grid">
        {/* 홈팀 카드 */}
        <article
          className="ai-battle-card home-card"
          style={{ "--team-color": homeTeam.color } as React.CSSProperties}
        >
          <div className="ai-battle-card-badge-row">
            <span className="ai-battle-side-badge">{AI_LABEL[homePred.ai_provider] ?? homePred.ai_provider} · 홈팀</span>
            {isFinished && homePred.is_correct && (
              <span className="ai-battle-winner-seal">
                <Award size={12} /> 승리회로 실현!
              </span>
            )}
          </div>
          <header className="ai-battle-card-header">
            <div className="ai-battle-team-row">
              <TeamBadge teamId={homePred.predicted_winner_team_id} size="sm" />
              <h4 className="ai-battle-team-name">{homeTeamName} 우세론</h4>
            </div>
            <p className="ai-battle-card-oneliner">“ {homePred.one_liner} ”</p>
          </header>

          <div className="ai-battle-card-body">
            <section className="ai-battle-section">
              <h5 className="ai-battle-section-title">
                <Star size={14} className="icon-star" />
                이길 수밖에 없는 이유 (Key Factor)
              </h5>
              <div className="ai-battle-section-tag">{homePred.key_factor}</div>
              <p className="ai-battle-section-text">{homePred.detailed_analysis}</p>
            </section>

            <section className="ai-battle-section counter-section">
              <h5 className="ai-battle-section-title">
                <ShieldAlert size={14} className="icon-alert" />
                상대 약점 공략 시나리오
              </h5>
              <p className="ai-battle-section-text">{homePred.counter_argument}</p>
            </section>
          </div>
        </article>

        {/* VS 디바이더 */}
        <div className="ai-battle-vs-divider">
          <div className="vs-circle">VS</div>
          <div className="vs-line" />
        </div>

        {/* 원정팀 카드 */}
        <article
          className="ai-battle-card away-card"
          style={{ "--team-color": awayTeam.color } as React.CSSProperties}
        >
          <div className="ai-battle-card-badge-row">
            <span className="ai-battle-side-badge">{AI_LABEL[awayPred.ai_provider] ?? awayPred.ai_provider} · 원정팀</span>
            {isFinished && awayPred.is_correct && (
              <span className="ai-battle-winner-seal">
                <Award size={12} /> 승리회로 실현!
              </span>
            )}
          </div>
          <header className="ai-battle-card-header">
            <div className="ai-battle-team-row">
              <TeamBadge teamId={awayPred.predicted_winner_team_id} size="sm" />
              <h4 className="ai-battle-team-name">{awayTeamName} 우세론</h4>
            </div>
            <p className="ai-battle-card-oneliner">“ {awayPred.one_liner} ”</p>
          </header>

          <div className="ai-battle-card-body">
            <section className="ai-battle-section">
              <h5 className="ai-battle-section-title">
                <Star size={14} className="icon-star" />
                이길 수밖에 없는 이유 (Key Factor)
              </h5>
              <div className="ai-battle-section-tag">{awayPred.key_factor}</div>
              <p className="ai-battle-section-text">{awayPred.detailed_analysis}</p>
            </section>

            <section className="ai-battle-section counter-section">
              <h5 className="ai-battle-section-title">
                <ShieldAlert size={14} className="icon-alert" />
                상대 약점 공략 시나리오
              </h5>
              <p className="ai-battle-section-text">{awayPred.counter_argument}</p>
            </section>
          </div>
        </article>
      </div>

      {/* ── 실시간 투표 섹션 (인터랙션) ── */}
      <footer className="ai-battle-vote-section">
        <h4 className="ai-battle-vote-title">
          <MessageCircle size={16} /> 어느 대변인의 주장에 끌리시나요?
        </h4>

        {!votedSide ? (
          <div className="ai-battle-vote-actions">
            <button
              onClick={() => handleVote("home")}
              className="ai-battle-vote-btn home-vote-btn"
              style={{ "--bg-color": homeTeam.color } as React.CSSProperties}
            >
              <ThumbsUp size={14} /> {homeTeamName} 주장 투표
            </button>
            <button
              onClick={() => handleVote("away")}
              className="ai-battle-vote-btn away-vote-btn"
              style={{ "--bg-color": awayTeam.color } as React.CSSProperties}
            >
              <ThumbsUp size={14} /> {awayTeamName} 주장 투표
            </button>
          </div>
        ) : (
          <div className="ai-battle-vote-result">
            <div className="ai-battle-vote-info">
              <span className="vote-label home-label">
                {homeTeamName} <strong>{voteCount.home}명</strong>
              </span>
              <span className="vote-percent-summary">{homePct}% vs {awayPct}%</span>
              <span className="vote-label away-label">
                {awayTeamName} <strong>{voteCount.away}명</strong>
              </span>
            </div>
            <div className="ai-battle-vote-bar-track">
              <div
                className="ai-battle-vote-bar-fill home-fill"
                style={{
                  width: `${homePct}%`,
                  backgroundColor: homeTeam.color
                }}
              />
              <div
                className="ai-battle-vote-bar-fill away-fill"
                style={{
                  width: `${awayPct}%`,
                  backgroundColor: ensureAwayFill(homeTeam.color, awayTeam.color, awayTeam.accent)
                }}
              />
            </div>
            <p className="ai-battle-voted-thanks">
              ✓ 투표가 반영되었습니다. 오늘도 당신의 팀을 응원합니다!
            </p>
          </div>
        )}
      </footer>
    </section>
  );
}
