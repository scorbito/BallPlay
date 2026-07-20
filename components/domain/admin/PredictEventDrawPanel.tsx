"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  drawWeeklyEventWinnerAction,
  drawCouponWinnersAction,
  type DrawWinnerResult,
  type DrawCouponResult
} from "@/lib/actions/predictEvent";
import type { AiProviderWeekly, EventDraw, EventQualifier } from "@/lib/server/predict/weeklyContest";

type Props = {
  weekStartISO: string;
  weekEndISO: string;
  prevWeekISO: string;
  nextWeekISO: string | null; // 미래 주는 막음
  gameCount: number;
  threshold: number;
  aiAvgAccuracy: number | null;
  aiMaxAccuracy: number | null;
  aiProviders: AiProviderWeekly[];
  qualifiers: EventQualifier[];
  participantCount: number;
  existingDraw: EventDraw | null;
  draws: EventDraw[];
};

function mmdd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)}`;
}

const box: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  marginBottom: 16
};

export function PredictEventDrawPanel({
  weekStartISO,
  weekEndISO,
  prevWeekISO,
  nextWeekISO,
  gameCount,
  threshold,
  aiAvgAccuracy,
  aiMaxAccuracy,
  aiProviders,
  qualifiers,
  participantCount,
  existingDraw,
  draws
}: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DrawWinnerResult | null>(null);
  const [couponPending, startCouponTransition] = useTransition();
  const [couponResult, setCouponResult] = useState<DrawCouponResult | null>(null);

  const runDraw = () => {
    setResult(null);
    startTransition(async () => {
      const res = await drawWeeklyEventWinnerAction(weekStartISO);
      setResult(res);
    });
  };

  const runCouponDraw = () => {
    setCouponResult(null);
    startCouponTransition(async () => {
      const res = await drawCouponWinnersAction(weekStartISO);
      setCouponResult(res);
    });
  };

  return (
    <div style={{ padding: 12 }}>
      {/* 주차 네비 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Link href={`/admin/predict-event?week=${prevWeekISO}`} style={{ fontWeight: 800 }}>
          ◀ 이전 주
        </Link>
        <strong style={{ fontSize: 16 }}>
          {mmdd(weekStartISO)}(화) ~ {mmdd(weekEndISO)}(일)
        </strong>
        {nextWeekISO ? (
          <Link href={`/admin/predict-event?week=${nextWeekISO}`} style={{ fontWeight: 800 }}>
            다음 주 ▶
          </Link>
        ) : (
          <span style={{ color: "#94a3b8", fontWeight: 800 }}>다음 주 ▶</span>
        )}
      </div>

      {/* 요약 */}
      <div style={box}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span>경기 수: <strong>{gameCount}</strong></span>
          <span>자격선(2/3): <strong>{threshold}경기</strong></span>
          <span>AI 평균: <strong>{aiAvgAccuracy !== null ? `${aiAvgAccuracy}%` : "—"}</strong></span>
          <span>
            기준선(최고 AI): <strong>{aiMaxAccuracy !== null ? `${aiMaxAccuracy}%` : "—"}</strong> 초과
          </span>
          <span>자격자(메인): <strong>{qualifiers.length}명</strong></span>
          <span>참여자(쿠폰, 5경기↑): <strong>{participantCount}명</strong></span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          AI: {aiProviders.map((p) => `${p.provider} ${p.accuracy !== null ? `${p.accuracy}%` : "—"}(${p.correct}/${p.total})`).join(" · ") || "—"}
        </div>
      </div>

      {/* 이미 추첨된 주 */}
      {existingDraw && existingDraw.winnerUserId ? (
        <div style={{ ...box, background: "#fdf2f8", borderColor: "#fbcfe8" }}>
          <div style={{ fontWeight: 800, color: "#db2777", marginBottom: 4 }}>이미 선정됨</div>
          <div>
            1위: <strong>{existingDraw.winnerNickname ?? "익명"}</strong>{" "}
            <span style={{ fontSize: 12, color: "#64748b" }}>({existingDraw.winnerUserId})</span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>추첨 시각: {new Date(existingDraw.drawnAt).toLocaleString("ko-KR")}</div>
        </div>
      ) : null}

      {/* 추첨 버튼 */}
      <button
        type="button"
        onClick={runDraw}
        disabled={pending || qualifiers.length === 0}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: 0,
          background: qualifiers.length === 0 ? "#cbd5e1" : "#db2777",
          color: "#fff",
          fontWeight: 900,
          fontSize: 15,
          cursor: qualifiers.length === 0 ? "not-allowed" : "pointer",
          marginBottom: 16
        }}
      >
        {pending
          ? "선정 중..."
          : existingDraw?.winnerUserId
            ? "다시 선정 (교체)"
            : `적중률 1위 선정 (자격자 ${qualifiers.length}명)`}
      </button>

      {/* 추첨 결과 */}
      {result ? (
        result.ok ? (
          <div style={{ ...box, background: "#ecfdf5", borderColor: "#a7f3d0" }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>
              🎉 1위: {result.winner.nickname ?? "익명"}
              {result.tiedCount > 1 ? (
                <span style={{ fontSize: 12, color: "#0f766e" }}> (동점 {result.tiedCount}명 중 추첨)</span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              적중 {result.winner.correct}/{result.winner.total} ({Math.round(result.winner.rate * 100)}%) · 자격자 {result.qualifierCount}명 · {result.winner.userId}
            </div>
          </div>
        ) : (
          <div style={{ ...box, background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626", fontWeight: 700 }}>
            {result.error}
          </div>
        )
      ) : null}

      {/* ── 쿠폰 추첨 (참여자 중 3명, 메인 당첨자 제외) ── */}
      <div style={{ ...box, background: "#fffbeb", borderColor: "#fde68a" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>쿠폰 추첨 — 참여자 중 3명 (메인 당첨자 제외)</div>

        {existingDraw && existingDraw.couponWinners.length > 0 ? (
          <div style={{ marginBottom: 10, fontSize: 13 }}>
            이미 추첨됨:{" "}
            <strong>
              {existingDraw.couponWinners.map((w) => w.nickname ?? "익명").join(", ")}
            </strong>
          </div>
        ) : null}

        <button
          type="button"
          onClick={runCouponDraw}
          disabled={couponPending || participantCount === 0}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 12,
            border: 0,
            background: participantCount === 0 ? "#cbd5e1" : "#d97706",
            color: "#fff",
            fontWeight: 900,
            fontSize: 14,
            cursor: participantCount === 0 ? "not-allowed" : "pointer"
          }}
        >
          {couponPending
            ? "추첨 중..."
            : existingDraw && existingDraw.couponWinners.length > 0
              ? "다시 쿠폰 추첨 (교체)"
              : `참여자 ${participantCount}명 중 3명 추첨`}
        </button>

        {couponResult ? (
          couponResult.ok ? (
            <div style={{ marginTop: 10, fontWeight: 800, color: "#b45309" }}>
              🎟 쿠폰 당첨 ({couponResult.winners.length}명): {couponResult.winners.map((w) => w.nickname ?? "익명").join(", ")}
              <div style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                {couponResult.winners.map((w) => w.userId).join(" · ")}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, color: "#dc2626", fontWeight: 700 }}>{couponResult.error}</div>
          )
        ) : null}
      </div>

      {/* 자격자 명단 */}
      <div style={box}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>자격자 명단 ({qualifiers.length})</div>
        {qualifiers.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>자격자가 없습니다.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {qualifiers.map((q) => (
              <li key={q.userId} style={{ marginBottom: 4 }}>
                <strong>{q.nickname ?? "익명"}</strong> — {Math.round(q.rate * 100)}% ({q.correct}/{q.total})
                <span style={{ fontSize: 11, color: "#94a3b8" }}> · {q.userId}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 추첨 이력 */}
      <div style={box}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>추첨 이력</div>
        {draws.length === 0 ? (
          <p style={{ color: "#94a3b8", margin: 0 }}>아직 추첨 이력이 없습니다.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {draws.map((d) => (
              <li key={d.weekStartDate} style={{ marginBottom: 6 }}>
                {mmdd(d.weekStartDate)}~{mmdd(d.weekEndDate)} — 메인 <strong>{d.winnerNickname ?? "—"}</strong>
                {d.couponWinners.length > 0 ? (
                  <span> · 쿠폰 <strong>{d.couponWinners.map((w) => w.nickname ?? "익명").join(", ")}</strong></span>
                ) : null}
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  {" "}(AI {d.aiAvgAccuracy !== null ? `${d.aiAvgAccuracy}%` : "—"} · 자격자 {d.qualifierCount} · 참여자 {d.participantCount})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
