"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight, Settings } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { TeamLogo } from "@/components/common/TeamLogo";
import { AccountTierBadge } from "@/components/common/AccountTierBadge";
import { Card } from "@/components/common/Card";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { useAppState } from "@/lib/state/AppState";
import { updateAvatarAction, updateProfileAction } from "@/lib/actions/profile";
import { uploadUserFile } from "@/lib/supabase/storage-client";
import { TIER_LABEL, type UserTier } from "@/lib/auth/userTier";
import { getLineupSlotLimit } from "@/lib/auth/tierLimits";
import type { AccountStats } from "@/lib/supabase/query-parts/bpAccountStats";
import type { TeamSummary } from "@/lib/supabase/query-parts/bpLineups";
import type { PlayoffSummary } from "@/lib/supabase/query-parts/bpPlayoff";

const menuItems = [
  { label: "설정", href: "/my/settings", icon: Settings }
];

type MyScreenProps = {
  accountStats: AccountStats;
  tier: UserTier;
  teamSummary: TeamSummary;
  playoffSummary: PlayoffSummary;
};

/** ISO 문자열 → "YYYY.MM.DD" (브라우저 로캘=KST 기준). 값 없으면 "-". */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function MyScreen({ accountStats, tier, teamSummary, playoffSummary }: MyScreenProps) {
  const slotLimit = getLineupSlotLimit(tier);
  // 누적 전적은 공식+가을야구가 이미 bp_account_stats 에 합산돼 들어온다(경기장 경기 모두 공식 인정).
  // → 여기서 따로 더하지 않는다(이중 계산 방지).
  const { profile, isAnonymous, updateProfile, showToast } = useAppState();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(profile.avatarUrl);
  const [uploading, startUpload] = useTransition();
  const [savingProfile, startSaveProfile] = useTransition();

  useEffect(() => {
    if (!editing) return;
    setNickname(profile.nickname);
    setAvatarUrl(profile.avatarUrl);
  }, [editing, profile.nickname, profile.avatarUrl]);

  const handleAvatarPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("이미지 크기는 5MB 이하여야 합니다.");
      return;
    }
    startUpload(async () => {
      try {
        const url = await uploadUserFile("profile-images", file, `avatar-${Date.now()}`);
        const result = await updateAvatarAction(url);
        setAvatarUrl(result.avatarUrl);
        updateProfile({ avatarUrl: result.avatarUrl });
        showToast("프로필 사진을 변경했어요.");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "사진 업로드에 실패했어요.");
      }
    });
  };

  return (
    <AppShell activeTab="my" title="마이" theme="light" hideHeader>
      <Card className="profile-card">
        <div className="profile-card-bg" aria-hidden="true" />
        <div className="profile-hero">
          {profile.avatarUrl ? (
            <span className="profile-hero-avatar">
              <Image alt="프로필 사진" src={profile.avatarUrl} fill sizes="48px" style={{ objectFit: "cover" }} />
            </span>
          ) : (
            <TeamLogo teamId={profile.mainTeamId} size="lg" />
          )}
          <div>
            <span className="profile-name-row">
              <h1>{profile.nickname}</h1>
              <span className="profile-tier-badge">{TIER_LABEL[tier]}</span>
            </span>
          </div>
          <button
            type="button"
            className="profile-edit-mini-btn"
            onClick={() => setEditing(true)}
          >
            편집
          </button>
        </div>
        {isAnonymous ? (
          <Link className="profile-anon-cta" href="/login" prefetch>
            정식 계정으로 전환하면 다른 기기에서도 볼 수 있어요 →
          </Link>
        ) : null}
      </Card>

      {/* 누적 전적 — 내가 직접 실행한 공식 경기 누적 */}
      <Card className="mypage-stat-card">
        <div className="mypage-stat-head">
          <strong>누적 전적</strong>
          <Link href="/records" className="mypage-stat-link mypage-stat-btn" prefetch>
            내 경기 기록 보기 <ChevronRight size={14} />
          </Link>
        </div>
        <div className="mypage-record-row">
          <AccountTierBadge wins={accountStats.wins} size={40} showName className="mypage-record-badge" />
          <span className="mypage-record-wl">
            {accountStats.wins}승 {accountStats.losses}패
          </span>
          <span className="mypage-record-rate">
            {accountStats.total > 0 ? `승률 ${Math.round(accountStats.winRate * 100)}%` : "아직 경기 없음"}
          </span>
          <Link href="/play/account-ranking" className="mypage-stat-link" prefetch>
            공식 랭킹 <ChevronRight size={14} />
          </Link>
        </div>
      </Card>

      {/* 내 팀 요약 — 운영/은퇴 팀 수 + 홈/원정 전적 + 최고 승률 팀 */}
      <Card className="mypage-stat-card">
        <div className="mypage-stat-head">
          <strong>내 팀</strong>
          <Link href="/play/lineup" className="mypage-stat-link" prefetch>
            팀 관리 <ChevronRight size={14} />
          </Link>
        </div>
        <div className="mypage-team-grid">
          <div className="mypage-team-cell">
            <span className="mypage-team-label">운영 팀</span>
            <span className="mypage-team-num">
              {teamSummary.activeCount}
              <small>/{slotLimit}</small>
            </span>
          </div>
          <div className="mypage-team-cell">
            <span className="mypage-team-label">은퇴 팀</span>
            <span className="mypage-team-num">{teamSummary.archivedCount}</span>
          </div>
          <div className="mypage-team-cell">
            <span className="mypage-team-label">홈 전적</span>
            <span className="mypage-team-num">
              {teamSummary.home.wins}<small>승</small> {teamSummary.home.losses}<small>패</small>
            </span>
          </div>
          <div className="mypage-team-cell">
            <span className="mypage-team-label">원정 전적</span>
            <span className="mypage-team-num">
              {teamSummary.away.wins}<small>승</small> {teamSummary.away.losses}<small>패</small>
            </span>
          </div>
        </div>
        {teamSummary.topTeam ? (
          <div className="mypage-best-team">
            <TeamLogo teamId={teamSummary.topTeam.teamId} size="sm" />
            <span className="mypage-best-name">{teamSummary.topTeam.name}</span>
            <span className="mypage-best-record">
              {teamSummary.topTeam.matches}경기 · 주력 팀
            </span>
          </div>
        ) : null}
      </Card>

      {/* 가을야구(플레이오프) 도전 기록 — 누적/깔때기형 */}
      <Card className="mypage-stat-card my-playoff-card">
        <div className="mypage-stat-head">
          <strong>🏆 가을야구</strong>
          <span className="mypage-stat-link">
            총 도전 {playoffSummary.totalChallenges}회
          </span>
        </div>
        {playoffSummary.totalChallenges > 0 ? (
          <>
            <div className="mypage-record-row my-playoff-record-row">
              <span className="mypage-record-wl">
                {playoffSummary.wins}승 {playoffSummary.losses}패
              </span>
              <span className="mypage-record-rate">
                {playoffSummary.totalGames > 0
                  ? `승률 ${Math.round((playoffSummary.wins / playoffSummary.totalGames) * 100)}%`
                  : "아직 경기 없음"}
              </span>
            </div>
            <div className="my-playoff-grid">
              <div className="my-playoff-cell">
                <span className="my-playoff-num">{playoffSummary.beat4}</span>
                <span className="my-playoff-label">4위 격파</span>
              </div>
              <div className="my-playoff-cell">
                <span className="my-playoff-num">{playoffSummary.beat3}</span>
                <span className="my-playoff-label">3위 격파</span>
              </div>
              <div className="my-playoff-cell">
                <span className="my-playoff-num">{playoffSummary.beat2}</span>
                <span className="my-playoff-label">2위 격파</span>
              </div>
              <div className="my-playoff-cell is-champion">
                <span className="my-playoff-num">{playoffSummary.championCount}</span>
                <span className="my-playoff-label">🏆 우승</span>
              </div>
            </div>
          </>
        ) : (
          <p className="my-playoff-empty">아직 가을야구 도전 기록이 없어요.</p>
        )}
      </Card>

      {/* 은퇴한 팀 — 보관된 팀의 최종 홈/원정 전적 */}
      {teamSummary.archivedTeams.length > 0 ? (
        <Card className="mypage-stat-card">
          <div className="mypage-stat-head">
            <strong>은퇴한 팀</strong>
            <span className="mypage-stat-link">{teamSummary.archivedTeams.length}팀</span>
          </div>
          <ul className="mypage-archived-list">
            {teamSummary.archivedTeams.map((t, i) => (
              <li className="mypage-archived-item" key={`${t.teamId}-${i}`}>
                <TeamBadge teamId={t.teamId} size="sm" />
                <div className="mypage-archived-body">
                  <div className="mypage-archived-top">
                    <span className="mypage-archived-name">{t.name}</span>
                    <span className="mypage-archived-rec">
                      홈 {t.home.wins}·{t.home.losses} <em>/</em> 원정 {t.away.wins}·{t.away.losses}
                    </span>
                  </div>
                  <div className="mypage-archived-dates">
                    생성 {fmtDate(t.createdAt)} · 은퇴 {fmtDate(t.archivedAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="menu-list">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link href={item.href} key={item.label} prefetch>
              <Icon size={18} />
              <strong>{item.label}</strong>
              <span className="menu-count" />
              <ChevronRight size={18} />
            </Link>
          );
        })}
      </section>
      <ModalShell
        open={editing}
        title="프로필 편집"
        onClose={() => setEditing(false)}
        panelClassName="profile-modal-panel"
      >
        <div className="form-stack">
          <div className="profile-avatar-edit">
            <div className="profile-avatar-preview">
              {avatarUrl ? (
                <Image alt="프로필 사진" src={avatarUrl} fill sizes="96px" style={{ objectFit: "cover" }} />
              ) : (
                <span className="profile-avatar-placeholder">{(nickname || "?").slice(0, 1)}</span>
              )}
            </div>
            <label className={`profile-avatar-button ${uploading ? "is-uploading" : ""}`}>
              <Camera size={14} />
              {uploading ? "업로드 중..." : "사진 변경"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarPick} disabled={uploading} />
            </label>
          </div>
          <label className="field-row">
            <span>닉네임</span>
            <input
              className="plain-input"
              value={nickname}
              maxLength={16}
              placeholder="닉네임 (최대 16자)"
              onChange={(event) => setNickname(event.target.value)}
            />
            <p className="field-hint">경기장 등록 라인업에 닉네임이 표시됩니다.</p>
          </label>
          <Button disabled={savingProfile} onClick={() => {
            const nextNickname = nickname.trim() || profile.nickname;
            startSaveProfile(async () => {
              try {
                await updateProfileAction({ nickname: nextNickname, bio: profile.bio ?? null });
                updateProfile({ nickname: nextNickname });
                setEditing(false);
                router.refresh();
              } catch (err) {
                showToast(err instanceof Error ? err.message : "프로필 저장에 실패했어요.");
              }
            });
          }}>
            {savingProfile ? "저장 중" : "저장하기"}
          </Button>
        </div>
      </ModalShell>
    </AppShell>
  );
}
