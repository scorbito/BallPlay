"use client";

import { Music, Music2, Play, Pause, Trophy, Volume2, VolumeX } from "lucide-react";

type PlayMode = "normal" | "fast" | "superfast" | "live";

export function PlayControls({
  isDone,
  isLive,
  playing,
  mode,
  muted,
  bgmMuted,
  onTogglePlaying,
  onChangeMode,
  onSkip,
  canSkip = true,
  onToggleMuted,
  onToggleBgmMuted,
  onGoResult
}: {
  isDone: boolean;
  isLive: boolean;
  playing: boolean;
  mode: PlayMode;
  muted: boolean;
  bgmMuted: boolean;
  onTogglePlaying: () => void;
  onChangeMode: (m: PlayMode) => void;
  onSkip: () => void;
  /** 끝까지 건너뛰기 노출 여부. 가을야구는 끝까지 시청 강제 → false. 기본 true. */
  canSkip?: boolean;
  onToggleMuted: () => void;
  onToggleBgmMuted: () => void;
  onGoResult: () => void;
}) {
  return (
    // 4. 컨트롤
    <footer className="stadium-play-controls">
      {!isDone ? (
        isLive ? (
          <>
            <div className="stadium-play-live-badge">
              <span className="stadium-live-dot" /> 실시간 매치 진행 중 — 컨트롤 잠금
            </div>
            <button
              type="button"
              className="stadium-play-btn stadium-play-btn-mute"
              onClick={onToggleBgmMuted}
              aria-label={bgmMuted ? "배경음악 켜기" : "배경음악 끄기"}
              aria-pressed={bgmMuted}
              title={bgmMuted ? "배경음악 켜기" : "배경음악 끄기"}
            >
              {bgmMuted ? <Music2 size={16} /> : <Music size={16} />}
            </button>
            <button
              type="button"
              className="stadium-play-btn stadium-play-btn-mute"
              onClick={onToggleMuted}
              aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
              aria-pressed={muted}
              title={muted ? "효과음 켜기" : "효과음 끄기"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="stadium-play-btn stadium-play-btn-icon"
              onClick={onTogglePlaying}
              aria-label={playing ? "일시정지" : "재생"}
              title={playing ? "일시정지" : "재생"}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="stadium-play-mode" role="radiogroup" aria-label="진행 모드">
              {/* 표시 라벨만 변경 — '일반'=실제 fast, '빠른'=실제 superfast. 속도값은 그대로.
                  실제 느린 normal 모드는 UI에서 제외(버튼 2개 → 소리 버튼이 다음 줄로 안 내려감). */}
              <button
                type="button"
                role="radio"
                aria-checked={mode === "fast"}
                className={`stadium-play-mode-btn ${mode === "fast" ? "is-active" : ""}`}
                onClick={() => onChangeMode("fast")}
              >
                일반
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "superfast"}
                className={`stadium-play-mode-btn ${mode === "superfast" ? "is-active" : ""}`}
                onClick={() => onChangeMode("superfast")}
              >
                빠른
              </button>
            </div>
            {/* 건너뛰기 — 6회 진입 이후만 동작 (5회 = KBO 정식경기 성립 기준).
                매치 시작 직후 무한 스킵으로 전적 어뷰징하는 것 방지.
                6회 전엔 disabled 대신 클릭 받아 안내 모달 노출 (사유 설명). */}
            {canSkip ? (
              <button
                type="button"
                className="stadium-play-btn stadium-play-btn-skip"
                onClick={onSkip}
                title="끝까지 건너뛰기"
              >
                건너뛰기
              </button>
            ) : null}
            <button
              type="button"
              className="stadium-play-btn stadium-play-btn-mute"
              onClick={onToggleBgmMuted}
              aria-label={bgmMuted ? "배경음악 켜기" : "배경음악 끄기"}
              aria-pressed={bgmMuted}
              title={bgmMuted ? "배경음악 켜기" : "배경음악 끄기"}
            >
              {bgmMuted ? <Music2 size={16} /> : <Music size={16} />}
            </button>
            <button
              type="button"
              className="stadium-play-btn stadium-play-btn-mute"
              onClick={onToggleMuted}
              aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
              aria-pressed={muted}
              title={muted ? "효과음 켜기" : "효과음 끄기"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </>
        )
      ) : (
        <button
          type="button"
          className="stadium-cta-primary"
          onClick={onGoResult}
        >
          <Trophy size={16} />
          <span>결과 보기</span>
        </button>
      )}
    </footer>
  );
}
