"use client";

// 라인업 등록 모달 — 라인업 빌더에서 호출.
// 설명 입력 + 본인 중복 hash 사전 안내 + 로그인/익명 게이트.
// INSERT 성공 시 onSuccess 호출 (부모가 처리: 토스트, 정리 등).

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LogIn, Save } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  existsOwnerRegisteredHash,
  registerLineup
} from "@/lib/supabase/query-parts/bpLineups";
import { computeLineupHash } from "@/lib/sim/lineupHash";
import { getTeamStats } from "@/lib/sim/statsLoader";
import { newEntryId } from "@/lib/storage/lineupEntries";
import { PITCHER_SLOTS_COUNT, type LineupEntry, type SavedPitcherLineup } from "@/lib/types/lineup";

function autoFillPitcherLineup(teamId: string): SavedPitcherLineup | null {
  const stats = getTeamStats(teamId);
  if (stats.pitchers.length < 1) return null;
  const sorted = [...stats.pitchers].sort((a, b) => b.staminaPitches - a.staminaPitches);
  const slots: (string | null)[] = Array.from({ length: PITCHER_SLOTS_COUNT }, () => null);
  for (let i = 0; i < PITCHER_SLOTS_COUNT && i < sorted.length; i++) {
    slots[i] = sorted[i].playerId;
  }
  return { teamId, slots, updatedAt: new Date().toISOString() };
}

const DESCRIPTION_MAX = 80;

type Props = {
  open: boolean;
  entry: LineupEntry | null; // 등록 대상 슬롯 (batting 9명 + pitching 권장)
  onClose: () => void;
  onSuccess?: (lineupId: string) => void;
};

export function RegisterLineupModal({ open, entry, onClose, onSuccess }: Props) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  // 열릴 때마다 상태 초기화 + 본인 중복 사전 체크
  useEffect(() => {
    if (!open) return;
    setDescription("");
    setSubmitting(false);
    setError(null);
    setDuplicateWarning(false);
    setNeedLogin(false);

    if (!entry) return;
    void (async () => {
      const client = createSupabaseBrowserClient();
      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!user || user.is_anonymous) {
        setNeedLogin(true);
        return;
      }
      const pitching = entry.pitching ?? autoFillPitcherLineup(entry.teamId);
      const hash = computeLineupHash(entry.teamId, entry.batting, pitching);
      const exists = await existsOwnerRegisteredHash(client, user.id, hash);
      if (exists) setDuplicateWarning(true);
    })();
  }, [open, entry]);

  const handleRegister = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { data } = await client.auth.getUser();
    const user = data.user;
    if (!user || user.is_anonymous) {
      setSubmitting(false);
      setNeedLogin(true);
      return;
    }
    const pitching = entry.pitching ?? autoFillPitcherLineup(entry.teamId);
    if (!pitching) {
      setSubmitting(false);
      setError("투수 시드 데이터가 없어 자동 보강에 실패했습니다.");
      return;
    }
    const hash = computeLineupHash(entry.teamId, entry.batting, pitching);
    const result = await registerLineup(client, {
      userId: user.id,
      name: entry.name,
      teamId: entry.teamId,
      batting: entry.batting,
      pitching,
      lineupHash: hash,
      description: description.trim() || null,
      entryId: newEntryId()
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      if (result.code === "duplicate") setDuplicateWarning(true);
      return;
    }
    onSuccess?.(result.row.id);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      title="경기장에 등록"
      onClose={onClose}
      panelClassName="lineup-register-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-register-body">
        {entry ? (
          <>
            <div className="lineup-register-summary">
              <TeamBadge teamId={entry.teamId} size="md" />
              <div className="lineup-register-summary-text">
                <strong>{entry.name}</strong>
                <span>이 라인업이 경기장에 영구 등록됩니다 (변경 불가)</span>
              </div>
            </div>

            {needLogin ? (
              <div className="lineup-register-gate">
                <p>등록은 로그인 사용자만 가능해요.</p>
                <Link href="/login" className="lineup-confirm-primary" prefetch>
                  <LogIn size={14} />
                  로그인
                </Link>
              </div>
            ) : (
              <>
                <label className="lineup-register-field">
                  <span className="lineup-register-field-label">
                    설명 <span className="lineup-register-field-hint">(선택, 최대 {DESCRIPTION_MAX}자)</span>
                  </span>
                  <input
                    type="text"
                    className="lineup-register-input"
                    placeholder="예: 기아 김도영 4번 최강 라인업!"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
                    maxLength={DESCRIPTION_MAX}
                  />
                  <span className="lineup-register-field-count">{description.length}/{DESCRIPTION_MAX}</span>
                </label>

                {duplicateWarning ? (
                  <p className="lineup-register-warn">
                    같은 라인업을 이미 등록했어요. 한 사람당 동일 라인업은 한 번만 등록 가능합니다.
                  </p>
                ) : null}

                {error && !duplicateWarning ? (
                  <p className="stadium-error">{error}</p>
                ) : null}

                <button
                  type="button"
                  className="stadium-cta-primary"
                  disabled={submitting || duplicateWarning}
                  onClick={handleRegister}
                >
                  <Save size={16} />
                  <span>{submitting ? "등록 중..." : "등록하기"}</span>
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
