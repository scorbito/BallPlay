"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, Smartphone } from "lucide-react";
import { ModalShell } from "@/components/common/ModalShell";
import { Button } from "@/components/common/Button";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** PWA 설치 안내 모달.
 *  - iOS: Safari "공유 → 홈 화면에 추가" 단계별 안내
 *  - Android Chrome (beforeinstallprompt 잡힘): 원클릭 설치 버튼
 *  - Android Chrome (이벤트 없음): 메뉴(⋮) → 앱 설치 안내
 *  - 그 외: 모바일 디바이스로 접속 안내 */
export function InstallAppModal({ open, onClose }: Props) {
  const { isIOS, isAndroid, canNativeInstall, promptInstall } = useInstallPrompt();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    const outcome = await promptInstall();
    setInstalling(false);
    if (outcome === "accepted") onClose();
  };

  return (
    <ModalShell
      open={open}
      title="앱으로 설치"
      onClose={onClose}
      panelClassName="install-modal-panel"
      backdropClassName="install-modal-backdrop"
    >
      <div className="install-modal-content">
        <div className="install-modal-hero">
          <Image
            src="/assets/mascot-cheer.png"
            alt="오승요"
            width={92}
            height={92}
            className="install-modal-mascot"
          />
          <h2>야구놀이터를<br />홈 화면에 추가해 보세요</h2>
          <p>
            URL 바 없이 풀스크린으로 사용할 수 있고,<br />
            아이콘 하나로 빠르게 진입할 수 있어요.
          </p>
        </div>

        {isIOS ? (
          <ol className="install-steps">
            <li>
              <span className="install-step-num">1</span>
              <span className="install-step-body">
                Safari 하단의 <strong>⋯</strong> 버튼을 누르세요.
              </span>
            </li>
            <li>
              <span className="install-step-num">2</span>
              <span className="install-step-body">
                메뉴에서 <strong>「공유」</strong>를 누르세요.
              </span>
            </li>
            <li>
              <span className="install-step-num">3</span>
              <span className="install-step-body">
                공유 메뉴에서 <strong>「더 보기」</strong>를 누르세요.
                <em className="install-step-hint">(이미 「홈 화면에 추가」가 보이면 건너뛰세요)</em>
              </span>
            </li>
            <li>
              <span className="install-step-num">4</span>
              <span className="install-step-body">
                <strong>「홈 화면에 추가」</strong>를 선택하면 끝이에요! 🎉
              </span>
            </li>
          </ol>
        ) : isAndroid && canNativeInstall ? (
          <div className="install-android-cta">
            <p>
              한 번 탭으로 설치할 수 있어요.<br />
              아래 버튼을 누르면 안드로이드 설치 안내가 떠요.
            </p>
            <Button onClick={handleInstall} disabled={installing}>
              {installing ? "설치 진행 중..." : (
                <>
                  <Download size={16} /> 지금 설치하기
                </>
              )}
            </Button>
          </div>
        ) : isAndroid ? (
          <ol className="install-steps">
            <li>
              <span className="install-step-num">1</span>
              <span className="install-step-body">
                Chrome 우측 상단 <strong>⋮ 메뉴</strong>를 누르세요.
              </span>
            </li>
            <li>
              <span className="install-step-num">2</span>
              <span className="install-step-body">
                <strong>「앱 설치」</strong> 또는 <strong>「홈 화면에 추가」</strong>를 선택하세요.
              </span>
            </li>
            <li>
              <span className="install-step-num">3</span>
              <span className="install-step-body">
                <strong>「설치」</strong>를 누르면 끝이에요! 🎉
              </span>
            </li>
          </ol>
        ) : (
          <div className="install-desktop-hint">
            <Smartphone size={32} />
            <p>
              모바일에서 더 빛나요!<br />
              스마트폰(iPhone Safari 또는 Android Chrome)으로 접속해 설치하실 수 있어요.
            </p>
          </div>
        )}

        <button type="button" className="install-modal-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </ModalShell>
  );
}
