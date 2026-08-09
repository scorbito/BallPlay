"use client";

// 닮은 선수 찾기 — 사진을 올리면 얼굴이 가장 비슷한 KBO 1군 선수를 찾아준다.
//
// 사진은 서버로 보내지 않는다. 얼굴 임베딩 추출과 205명 비교가 모두 브라우저에서 끝난다.
// 덕분에 생체정보를 수집하지 않고, 서버 CPU도 쓰지 않는다.
//
// 선수 사진은 표시하지 않는다. KBO 프로필 사진은 KBOP 저작물이고 초상권은 선수에게 있어
// 재배포에 해당할 수 있다. 대신 이름·등번호·팀 컬러 카드로 보여주고, 원본이 궁금한 사람은
// 이름을 눌러 KBO 공식 페이지로 나가게 한다.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Info, RefreshCw, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModalShell } from "@/components/common/ModalShell";
import { useAppState } from "@/lib/state/AppState";
import { trackEvent } from "@/lib/analytics/events";
import { teams as KBO_TEAMS } from "@/lib/constants/teams";
import { describeFace, loadImageFromFile } from "@/lib/face/detector";
import {
  findTopMatches,
  kboPlayerPhotoUrl,
  kboPlayerUrl,
  l2normalize,
  loadFaceIndex,
  type FaceMatch,
  type FacePlayer
} from "@/lib/face/match";

type Phase = "idle" | "working" | "result" | "error";

function teamColor(teamId: string): string {
  const team = KBO_TEAMS.find((item) => item.id === teamId);
  return team?.color ?? "#6b7280";
}

function teamShortName(teamId: string): string {
  return KBO_TEAMS.find((item) => item.id === teamId)?.shortName ?? teamId.toUpperCase();
}

/**
 * KBO 공식 프로필 사진. CDN을 그대로 참조하므로(인라인 링크) 우리 서버에 사본이 남지 않는다.
 * 원본이 94×118이라 표시 크기를 그 이상으로 키우지 않는다 — 늘리면 뭉개져서 비교가 어려워진다.
 * CDN이 막히거나 사진이 없으면 팀 컬러 이니셜로 폴백.
 */
function PlayerPhoto({ player, className = "" }: { player: FacePlayer; className?: string }) {
  const [failed, setFailed] = useState(false);
  const color = teamColor(player.team);

  if (failed) {
    return (
      <div
        className={`grid place-items-center text-xl font-extrabold text-white ${className}`}
        style={{ backgroundColor: color }}
      >
        {player.name.slice(0, 1)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부 CDN 인라인 링크. next/image 로 감싸면 우리 서버를 경유해 사본이 생긴다.
    <img
      src={kboPlayerPhotoUrl(player)}
      alt={`${player.name} 프로필 사진`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
      style={{ backgroundColor: `${color}14` }}
    />
  );
}

export function FaceMatchScreen() {
  const { showToast } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [matches, setMatches] = useState<FaceMatch[]>([]);
  const [errorText, setErrorText] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  // 화면을 떠날 때 미리보기 objectURL 을 해제한다. 사진이 메모리에 남지 않게.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPhase("working");
      setMatches([]);
      setErrorText("");

      try {
        setStatusText("사진을 읽는 중…");
        const { image, objectUrl } = await loadImageFromFile(file);
        objectUrlRef.current = objectUrl;
        setPhotoUrl(objectUrl);

        // 첫 진입에서만 무거운 단계다. 이후에는 브라우저 캐시로 즉시 지나간다.
        setStatusText("얼굴 인식 준비 중… (처음 한 번만 받아요)");
        const [index, descriptor] = await Promise.all([loadFaceIndex(), describeFace(image)]);

        if (!descriptor) {
          setErrorText("사진에서 얼굴을 찾지 못했어요. 얼굴이 정면으로 크게 나온 사진으로 다시 시도해 주세요.");
          setPhase("error");
          return;
        }

        setStatusText("닮은 선수를 찾는 중…");
        const top = findTopMatches(index, l2normalize(descriptor), 5);
        setMatches(top);
        setPhase("result");

        void trackEvent("face_match_completed", {
          player: top[0].player.name,
          team: top[0].player.team,
          sync_rate: top[0].syncRate
        });
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.");
        setPhase("error");
      }
    },
    []
  );

  const onPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // 같은 파일을 다시 골라도 change 가 발생하도록 값을 비운다.
      event.target.value = "";
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const onShare = useCallback(async () => {
    if (matches.length === 0) return;
    const best = matches[0];
    const text = `나와 닮은 KBO 선수는 ${teamShortName(best.player.team)} ${best.player.name}! 싱크로율 ${best.syncRate}%\n야구놀이터에서 찾아보세요 → https://ballnori.com/play/face`;
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
  }, [matches, showToast]);

  const best = matches[0];
  const rest = matches.slice(1);

  return (
    <AppShell
      activeTab="play"
      title="나와 닮은 선수는?"
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
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
        {phase === "idle" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <Image
              src="/icons/menu/lookalike-player-icon-final.png"
              alt=""
              width={288}
              height={288}
              priority
              className="mx-auto h-36 w-36"
            />
            <h2 className="mt-4 text-lg font-bold text-slate-900">얼굴 사진을 올려보세요</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              KBO 1군 주력 선수 205명 중에서 찾아드려요.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-bold text-white transition active:scale-[0.99]"
            >
              사진 선택하기
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              사진은 기기 안에서만 분석되며 서버로 전송되거나 저장되지 않습니다.
            </p>
          </div>
        )}

        {phase === "working" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-900" />
            <p className="mt-5 text-sm font-medium text-slate-600">{statusText}</p>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm leading-relaxed text-slate-600">{errorText}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white"
            >
              다른 사진으로 시도
            </button>
          </div>
        )}

        {phase === "result" && best && (
          <>
            <div
              className="overflow-hidden rounded-2xl border shadow-sm"
              style={{ borderColor: `${teamColor(best.player.team)}33` }}
            >
              <div
                className="px-5 pb-5 pt-6 text-center"
                style={{
                  background: `linear-gradient(180deg, ${teamColor(best.player.team)}1a 0%, #ffffff 70%)`
                }}
              >
                <p className="text-xs font-medium text-slate-500">나와 가장 닮은 선수</p>

                {/* 나란히 놓아야 얼마나 닮았는지 눈으로 확인된다. 선수 사진 원본이 94×118이라
                    같은 3:4 비율·같은 크기로 맞춰 비교가 공평하게 보이도록 했다. */}
                <div className="mt-4 flex items-center justify-center gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    {photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- 로컬 objectURL. 서버로 가지 않는다.
                      <img
                        src={photoUrl}
                        alt="업로드한 사진"
                        className="h-[130px] w-[104px] rounded-xl border-2 border-white object-cover shadow-md"
                      />
                    )}
                    <span className="text-[11px] font-medium text-slate-400">내 사진</span>
                  </div>

                  <span className="pb-5 text-xs font-bold text-slate-300">VS</span>

                  <div className="flex flex-col items-center gap-1.5">
                    <PlayerPhoto
                      player={best.player}
                      className="h-[130px] w-[104px] rounded-xl border-2 border-white shadow-md"
                    />
                    <span className="text-[11px] font-medium text-slate-400">
                      {teamShortName(best.player.team)}
                    </span>
                  </div>
                </div>

                <a
                  href={kboPlayerUrl(best.player)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-[26px] font-extrabold leading-tight text-slate-900 underline-offset-4 hover:underline"
                >
                  {best.player.name}
                </a>
                <p className="mt-1 text-sm text-slate-500">
                  {teamShortName(best.player.team)}
                  {best.player.no !== null && ` · No.${best.player.no}`} · {best.player.pos}
                </p>
                <div
                  className="mx-auto mt-4 w-[168px] rounded-xl px-4 py-2.5 text-white"
                  style={{ backgroundColor: teamColor(best.player.team) }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                    싱크로율
                  </div>
                  <div className="text-[28px] font-extrabold leading-none">{best.syncRate}%</div>
                </div>
                <p className="mt-2.5 text-[11px] text-slate-400">205명 중 가장 닮은 선수예요</p>
              </div>
            </div>

            {rest.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="px-1 pb-1 pt-1 text-xs font-semibold text-slate-400">이런 선수와도 닮았어요</p>
                <ul>
                  {rest.map((match, i) => (
                    <li
                      key={match.player.id}
                      className="flex items-center gap-3 border-t border-slate-100 py-2.5 first:border-t-0"
                    >
                      <span className="w-4 text-center text-xs font-bold text-slate-300">{i + 2}</span>
                      <PlayerPhoto
                        player={match.player}
                        className="h-[42px] w-[34px] shrink-0 rounded-md"
                      />
                      <a
                        href={kboPlayerUrl(match.player)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-slate-800 underline-offset-2 hover:underline"
                      >
                        {match.player.name}
                      </a>
                      <span className="text-xs text-slate-400">{teamShortName(match.player.team)}</span>
                      <span className="ml-auto text-xs font-bold tabular-nums text-slate-500">
                        {match.syncRate}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700"
              >
                <RefreshCw className="h-4 w-4" />
                다시 하기
              </button>
              <button
                type="button"
                onClick={onShare}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white"
              >
                <Share2 className="h-4 w-4" />
                결과 공유
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
              재미로 보는 결과예요. 선수 이름을 누르면 KBO 공식 기록 페이지로 이동합니다.
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
      </div>

      <ModalShell open={helpOpen} onClose={() => setHelpOpen(false)} title="나와 닮은 선수는?">
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            올린 사진에서 얼굴 특징을 숫자로 바꾼 뒤, 미리 준비해 둔 KBO 1군 주력 선수 205명의 특징과
            비교해 가장 가까운 선수를 찾아드려요.
          </p>
          <p>
            <b className="text-slate-800">사진은 전송되지 않습니다.</b> 분석은 모두 사용자의 기기
            안에서 이뤄지고, 화면을 벗어나면 사진은 사라집니다.
          </p>
          <p>
            <b className="text-slate-800">싱크로율</b>은 205명 전체와 비교했을 때 이 선수가 얼마나
            두드러지게 가까운지를 나타내요. 보통 80% 안팎이 나오고, 95%를 넘으면 아주 드문 경우예요.
          </p>
          <p>선수 이름을 누르면 KBO 공식 기록 페이지에서 더 자세히 보실 수 있어요.</p>
          <p className="text-xs text-slate-400">
            얼굴이 정면으로 크게 나오고, 밝은 곳에서 찍은 사진일수록 결과가 정확해요.
          </p>
        </div>
      </ModalShell>
    </AppShell>
  );
}
