"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ModalShell } from "@/components/common/ModalShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import {
  getPublicProfileAction,
  type PublicProfilePayload
} from "@/lib/actions/publicProfile";

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  /** 모달이 표시할 대상 사용자 id. null이면 모달은 표시되지 않는다. */
  targetUserId: string | null;
};

/** 작성자(닉네임/사진) 탭 시 열리는 가벼운 프로필 모달.
 *  본인을 눌러도 같은 모달이 열린다(`self` 상태). */
export function ProfileModal({ open, onClose, targetUserId }: ProfileModalProps) {
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !targetUserId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPublicProfileAction(targetUserId)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          setError("프로필을 찾을 수 없어요.");
        } else {
          setData(payload);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "프로필을 불러오지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, targetUserId]);

  return (
    <ModalShell
      open={open}
      title="프로필"
      onClose={onClose}
      panelClassName="profile-popover-panel"
      closeOnBackdrop
    >
      {loading ? (
        <div className="profile-popover-state">불러오는 중...</div>
      ) : error ? (
        <div className="profile-popover-state profile-popover-error">{error}</div>
      ) : data ? (
        <div className="profile-popover-stack">
          <div className="profile-popover-header">
            <div className="profile-popover-avatar">
              {data.avatarUrl ? (
                <Image alt={data.nickname} src={data.avatarUrl} fill sizes="64px" style={{ objectFit: "cover" }} />
              ) : (
                <span className="profile-popover-avatar-fallback">{data.nickname.slice(0, 1)}</span>
              )}
            </div>
            <div className="profile-popover-headline">
              <strong className="profile-popover-name">{data.nickname}</strong>
              <span className="profile-popover-team">
                <TeamBadge teamId={data.mainTeamId} size="sm" />
                <span>{getTeam(data.mainTeamId).shortName}</span>
              </span>
            </div>
          </div>
          <p className={`profile-popover-bio ${data.bio ? "" : "profile-popover-bio-empty"}`}>
            {data.bio ?? "아직 소개가 없어요"}
          </p>
          {data.isSelf ? (
            <div className="profile-popover-actions">
              <span className="profile-popover-action-label">내 프로필이에요</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="profile-popover-state">표시할 정보가 없어요.</div>
      )}
    </ModalShell>
  );
}

/** 작성자(닉네임/사진) 클릭으로 모달을 열기 위한 공통 헬퍼. */
export type ProfileModalControls = {
  openProfile: (userId: string) => void;
  modalProps: ProfileModalProps;
};

export function useProfileModal(): ProfileModalControls {
  const [target, setTarget] = useState<string | null>(null);
  return {
    openProfile: (userId: string) => setTarget(userId),
    modalProps: {
      open: target !== null,
      onClose: () => setTarget(null),
      targetUserId: target
    }
  };
}
