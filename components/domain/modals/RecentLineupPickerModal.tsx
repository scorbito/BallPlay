"use client";

import { useEffect, useState } from "react";
import { Calendar, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  listRecentLineupsForTeam,
  type RecentLineupRow
} from "@/lib/supabase/query-parts/bpRecentLineups";
import { getTeam } from "@/lib/constants/teams";
import { normalizeKboPosition } from "@/lib/types/lineup";

type Props = {
  open: boolean;
  teamId: string;
  onClose: () => void;
  onPick: (row: RecentLineupRow) => void;
};

function formatDate(iso: string): string {
  // "2026-05-27" → "5/27"
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[1])}/${Number(m[2])}`;
}

export function RecentLineupPickerModal({ open, teamId, onClose, onPick }: Props) {
  const [rows, setRows] = useState<RecentLineupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    void listRecentLineupsForTeam(client, teamId, 10).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setRows(res.rows);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, teamId]);

  const teamName = getTeam(teamId).shortName;

  return (
    <ModalShell
      open={open}
      title={`${teamName} 실제 경기 라인업`}
      onClose={onClose}
      panelClassName="recent-lineup-modal-panel"
      closeOnBackdrop
    >
      <div className="recent-lineup-modal-body">
        {loading ? (
          <div className="recent-lineup-state">
            <Loader2 size={18} className="recent-lineup-spinner" />
            <span>불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="recent-lineup-state recent-lineup-state-error">
            <span>불러오기 실패: {error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="recent-lineup-state">
            <span>최근 라인업 기록이 없어요.</span>
          </div>
        ) : (
          <ul className="recent-lineup-list">
            {rows.map((row) => {
              const sorted = [...row.batting].sort((a, b) => a.order - b.order);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="recent-lineup-item"
                    onClick={() => onPick(row)}
                  >
                    <div className="recent-lineup-item-head">
                      <span className="recent-lineup-date">
                        <Calendar size={11} aria-hidden="true" />
                        {formatDate(row.game_date)}
                      </span>
                      <span className="recent-lineup-venue">
                        {row.is_home ? "홈" : "원정"}
                      </span>
                      {row.starter_name ? (
                        <span className="recent-lineup-starter">
                          선발 <strong>{row.starter_name}</strong>
                        </span>
                      ) : null}
                    </div>
                    <ol className="recent-lineup-batting">
                      {sorted.map((b) => {
                        // 구 데이터(한자) + 신 데이터(영문 코드) 모두 첫 글자 기준으로 정규화 후 표시.
                        const pos = normalizeKboPosition(b.position);
                        return (
                          <li key={b.order} className="recent-lineup-batting-row">
                            <span className="recent-lineup-batting-order">{b.order}</span>
                            <span className="recent-lineup-batting-pos">{pos ?? "-"}</span>
                            <span className="recent-lineup-batting-name">{b.name}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ModalShell>
  );
}
