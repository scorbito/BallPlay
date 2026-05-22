"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight, Download, Settings } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { Card } from "@/components/common/Card";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { InstallAppModal } from "@/components/domain/InstallAppModal";
import { getTeam } from "@/lib/constants/teams";
import { useAppState } from "@/lib/state/AppState";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { updateAvatarAction, updateProfileAction } from "@/lib/actions/profile";
import { uploadUserFile } from "@/lib/supabase/storage-client";

const menuItems = [
  { label: "설정", href: "/my/settings", icon: Settings }
];

export function MyScreen() {
  const { profile, isAnonymous, updateProfile, showToast } = useAppState();
  const { isStandalone } = useInstallPrompt();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(profile.avatarUrl);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [uploading, startUpload] = useTransition();
  const [savingProfile, startSaveProfile] = useTransition();
  const profileTeam = getTeam(profile.mainTeamId);

  useEffect(() => {
    if (!editing) return;
    setNickname(profile.nickname);
    setAvatarUrl(profile.avatarUrl);
    setBio(profile.bio ?? "");
  }, [editing, profile.nickname, profile.avatarUrl, profile.bio]);

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
    <AppShell activeTab="my" title="마이" theme="dark" hideHeader>
      <Card className="profile-card">
        <div className="profile-card-bg" aria-hidden="true" />
        <div className="profile-hero">
          {profile.avatarUrl ? (
            <span className="profile-hero-avatar">
              <Image alt="프로필 사진" src={profile.avatarUrl} fill sizes="48px" style={{ objectFit: "cover" }} />
            </span>
          ) : (
            <TeamBadge teamId={profile.mainTeamId} size="lg" />
          )}
          <div>
            <h1>{profile.nickname}</h1>
            <span className="profile-hero-team">
              <span className="profile-hero-team-text">응원팀 {profileTeam.name}</span>
              <TeamBadge teamId={profile.mainTeamId} size="sm" />
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
        {profile.bio ? (
          <p className="profile-bio">{profile.bio}</p>
        ) : (
          <button type="button" className="profile-bio profile-bio-empty" onClick={() => setEditing(true)}>
            + 자기소개 추가하기
          </button>
        )}
        {isAnonymous ? (
          <Link className="profile-anon-cta" href="/login" prefetch>
            정식 계정으로 전환하면 다른 기기에서도 볼 수 있어요 →
          </Link>
        ) : null}
      </Card>
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
        {/* 이미 PWA로 설치된 사용자에겐 메뉴 숨김 — 설치 권유 의미 없음 */}
        {!isStandalone ? (
          <button type="button" className="menu-row-button" onClick={() => setInstallModalOpen(true)}>
            <Download size={18} />
            <strong>앱으로 설치</strong>
            <span className="menu-count" />
            <ChevronRight size={18} />
          </button>
        ) : null}
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
              maxLength={15}
              placeholder="닉네임 (최대 15자)"
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
          <label className="field-row">
            <span>자기소개</span>
            <input
              className="plain-input"
              value={bio}
              maxLength={150}
              placeholder="한 줄로 나를 소개해보세요 (선택)"
              onChange={(event) => {
                const next = event.target.value.replace(/[\r\n]+/g, " ");
                setBio(next);
              }}
            />
            <p className="field-hint">{bio.length}/150</p>
          </label>
          <p className="field-hint">응원팀 변경은 &lsquo;오늘은 승요&rsquo; 앱에서 할 수 있어요.</p>
          <Button disabled={savingProfile} onClick={() => {
            const nextNickname = nickname.trim() || profile.nickname;
            const trimmedBio = bio.replace(/[\r\n]+/g, " ").trim().slice(0, 150);
            const nextBio = trimmedBio.length > 0 ? trimmedBio : null;
            startSaveProfile(async () => {
              try {
                await updateProfileAction({ nickname: nextNickname, bio: nextBio });
                updateProfile({ nickname: nextNickname, bio: nextBio });
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
      <InstallAppModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
    </AppShell>
  );
}
