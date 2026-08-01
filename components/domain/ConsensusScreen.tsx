"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles, Swords } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { ConsensusGameCard, ConsensusPageData, ProviderPick } from "@/lib/predict/consensus";

// 종합분석&예측 — 3개 AI 픽 + 정밀데이터(불펜·폼)를 취합한 경기별 종합픽 화면.
// 카드 본체는 핵심만(종합픽·3AI 한줄·데이터 포인트 2-3개), 상세는 펼치기(progressive disclosure).

const PROVIDER_LABEL: Record<string, string> = { gpt: "GPT", gemini: "Gemini", claude: "Claude" };
const PROVIDER_COLOR: Record<string, string> = {
  gpt: "text-emerald-600",
  gemini: "text-blue-500",
  claude: "text-orange-500"
};

function formatDateLabel(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function teamName(teamId: string): string {
  return getTeam(teamId)?.shortName ?? teamId.toUpperCase();
}

function formLabel(form: { wins: number; losses: number; draws: number } | null): string {
  if (!form) return "-";
  return `${form.wins}승${form.losses}패${form.draws > 0 ? `${form.draws}무` : ""}`;
}

function PickChips({ picks }: { picks: ProviderPick[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {picks.map((p) => (
        <span key={p.provider} className="inline-flex items-center gap-1 text-xs font-bold">
          <span className={PROVIDER_COLOR[p.provider] ?? "text-slate-500"}>{PROVIDER_LABEL[p.provider] ?? p.provider}</span>
          <span className="text-slate-700">{teamName(p.teamId)}</span>
          {p.isCorrect !== null ? (
            <span className={p.isCorrect ? "text-emerald-600" : "text-rose-500"}>{p.isCorrect ? "✓" : "✗"}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function GameCard({ card }: { card: ConsensusGameCard }) {
  const [open, setOpen] = useState(false);
  const home = getTeam(card.homeTeamId);
  const away = getTeam(card.awayTeamId);
  const finished = card.gameStatus === "finished" && card.actualHomeScore !== null && card.actualAwayScore !== null;
  const actualWinner = finished
    ? card.actualHomeScore! > card.actualAwayScore!
      ? card.homeTeamId
      : card.actualAwayScore! > card.actualHomeScore!
        ? card.awayTeamId
        : null
    : null;
  const consensusHit = finished && card.consensusTeamId ? actualWinner === card.consensusTeamId : null;

  // 데이터 포인트 — 불펜 최근10 ERA 비교 + 최근 10경기 폼. 우위 팀 표시.
  const bullpenLine = (() => {
    const h = card.homeBullpen?.recent10Era;
    const a = card.awayBullpen?.recent10Era;
    if (h == null && a == null) return null;
    const better = h != null && a != null ? (h < a ? card.homeTeamId : card.awayTeamId) : null;
    return { h, a, better };
  })();

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* 매치업 헤더 */}
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {card.gameTime ? card.gameTime.slice(0, 5) : ""} {card.stadium}
        </span>
        {finished ? (
          <span className="font-bold text-slate-500">
            {teamName(card.awayTeamId)} {card.actualAwayScore} : {card.actualHomeScore} {teamName(card.homeTeamId)} 종료
          </span>
        ) : null}
      </div>
      <div className="mb-3 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <TeamBadge teamId={card.awayTeamId} size="sm" />
          <div>
            <div className="text-sm font-extrabold text-slate-800">{away?.shortName ?? card.awayTeamId}</div>
            <div className="text-[11px] text-slate-400">{card.awayStarter ?? "선발 미정"}</div>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-300">VS</span>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-extrabold text-slate-800">{home?.shortName ?? card.homeTeamId}</div>
            <div className="text-[11px] text-slate-400">{card.homeStarter ?? "선발 미정"}</div>
          </div>
          <TeamBadge teamId={card.homeTeamId} size="sm" />
        </div>
      </div>

      {/* 종합픽 배너 */}
      {card.consensusTeamId && card.consensusProb !== null ? (
        <div
          className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 ${
            card.unanimous ? "bg-emerald-50" : "bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {card.unanimous ? (
              <Sparkles className="h-4 w-4 text-emerald-500" />
            ) : (
              <Swords className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs font-bold text-slate-500">종합픽</span>
            <TeamBadge teamId={card.consensusTeamId} size="sm" />
            <span className="text-base font-extrabold text-slate-800">{teamName(card.consensusTeamId)}</span>
            <span className="text-sm font-extrabold text-slate-600">{Math.round(card.consensusProb * 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            {consensusHit !== null ? (
              <span className={`text-xs font-extrabold ${consensusHit ? "text-emerald-600" : "text-rose-500"}`}>
                {consensusHit ? "적중" : "실패"}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                card.unanimous ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {card.unanimous ? "만장일치" : "격전지"}
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-center text-xs font-bold text-slate-400">
          AI 예측 대기 중 — 3개 AI 입력 후 종합픽이 계산됩니다
        </div>
      )}

      {/* 3AI 한줄 */}
      <div className="mb-3">
        <PickChips picks={card.picks} />
      </div>

      {/* 데이터 포인트 (핵심만) */}
      <div className="space-y-1 text-xs text-slate-600">
        {bullpenLine ? (
          <div>
            <span className="font-bold text-slate-400">불펜 최근10</span>{" "}
            {teamName(card.awayTeamId)} {bullpenLine.a ?? "-"} · {teamName(card.homeTeamId)} {bullpenLine.h ?? "-"}
            {bullpenLine.better ? (
              <span className="ml-1 font-extrabold text-slate-800">→ {teamName(bullpenLine.better)} 우위</span>
            ) : null}
          </div>
        ) : null}
        <div>
          <span className="font-bold text-slate-400">최근 10경기</span> {teamName(card.awayTeamId)}{" "}
          {formLabel(card.awayForm)} · {teamName(card.homeTeamId)} {formLabel(card.homeForm)}
        </div>
        {card.fatigueFlags.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {card.fatigueFlags.map((flag) => {
              const [teamId, label] = flag.split(":");
              return (
                <span
                  key={flag}
                  className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600"
                >
                  {teamName(teamId)} {label}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 상세 펼치기 — 각 AI 근거 */}
      {card.picks.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-100 py-1.5 text-[11px] font-bold text-slate-400"
        >
          AI별 근거 {open ? "접기" : "보기"}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      ) : null}
      {open ? (
        <ul className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {card.picks.map((p) => (
            <li key={p.provider}>
              <span className={`font-extrabold ${PROVIDER_COLOR[p.provider] ?? ""}`}>
                {PROVIDER_LABEL[p.provider]}
              </span>{" "}
              <span className="font-bold text-slate-700">{teamName(p.teamId)}</span>{" "}
              <span className="text-slate-400">({p.confidence})</span> — {p.keyFactor}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

type Props = {
  data: ConsensusPageData;
  prevDate: string | null;
  nextDate: string | null;
  isToday: boolean;
};

export function ConsensusScreen({ data, prevDate, nextDate, isToday }: Props) {
  return (
    <AppShell theme="light" title="종합분석&예측" backHref="/">
      <div className="mx-auto w-full max-w-xl px-4 pb-16">
        {/* 날짜 내비 */}
        <div className="mb-3 flex items-center justify-center gap-4 pt-2">
          {prevDate ? (
            <Link href={`/predict/consensus?date=${prevDate}`} className="rounded-full p-1 text-slate-400">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          ) : (
            <span className="p-1 text-slate-200">
              <ChevronLeft className="h-5 w-5" />
            </span>
          )}
          <div className="text-center">
            <div className="text-sm font-extrabold text-slate-800">
              {formatDateLabel(data.selectedDate)} {isToday ? "(오늘)" : ""}
            </div>
          </div>
          {nextDate ? (
            <Link href={`/predict/consensus?date=${nextDate}`} className="rounded-full p-1 text-slate-400">
              <ChevronRight className="h-5 w-5" />
            </Link>
          ) : (
            <span className="p-1 text-slate-200">
              <ChevronRight className="h-5 w-5" />
            </span>
          )}
        </div>

        {/* 요약 스트립 */}
        {data.unanimousCount + data.splitCount > 0 ? (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-extrabold text-emerald-700">
              만장일치 {data.unanimousCount}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-extrabold text-amber-700">
              격전지 {data.splitCount}
            </span>
          </div>
        ) : null}

        {/* 경기 카드 */}
        <div className="space-y-4">
          {data.cards.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              이 날짜에는 경기가 없습니다
            </div>
          ) : (
            data.cards.map((card) => <GameCard key={card.gameId} card={card} />)
          )}
        </div>

        {/* 방식 안내 (본체는 짧게 — progressive disclosure) */}
        <details className="mt-6 rounded-xl border border-slate-100 bg-white p-4 text-xs text-slate-500">
          <summary className="cursor-pointer font-bold text-slate-400">종합픽은 어떻게 계산되나요?</summary>
          <p className="mt-2 leading-relaxed">
            세 AI의 픽을 각 AI의 과거 적중률로 가중해 합산합니다. 세 AI가 같은 팀을 고르면(만장일치) 신뢰도가
            높고, 의견이 갈린 경기(격전지)는 역사적으로 다수 의견의 적중률이 낮아 박빙으로 표시합니다. 불펜
            최근 10경기 성적과 피로도, 최근 10경기 폼을 데이터 포인트로 함께 제공합니다.
          </p>
        </details>
      </div>
    </AppShell>
  );
}
