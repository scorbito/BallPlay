"use client";

import { useEffect, useState } from "react";
import { safeMaxTouchPoints, safeNavigatorPlatform, safeUserAgent } from "@/lib/utils/navigator";

/** PWA ?ㅼ튂 愿???붾컮?댁뒪 媛먯? + ?ㅼ씠?곕툕 prompt 罹≪쿂.
 *  - isStandalone: ?대? ???붾㈃ ?ㅼ튂 / ??ㅽ겕由?紐⑤뱶硫?true
 *  - isIOS: iPhone/iPad/iPod
 *  - isAndroid: Android ?붾컮?댁뒪
 *  - canNativeInstall: Android Chrome ?깆뿉??beforeinstallprompt ?대깽?멸? ?≫? 利됱떆 ?ㅼ튂 媛?? *  - promptInstall: ?ㅼ씠?곕툕 ?ㅼ씠?쇰줈洹??몃━嫄?(Android only) */
export type InstallPromptState = {
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  canNativeInstall: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = safeUserAgent();
    // iPad??iPadOS 13+遺???ы뙆由ш? desktop UA濡??꾩옣 (iPad 臾몄옄???놁쓬).
    // navigator.platform === "MacIntel" + maxTouchPoints > 1濡?蹂꾨룄 媛먯?.
    const isIPadOS =
      safeNavigatorPlatform() === "MacIntel" &&
      safeMaxTouchPoints() > 1;
    setIsIOS(/iPhone|iPad|iPod/.test(ua) || isIPadOS);
    setIsAndroid(/Android/.test(ua));

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari 鍮꾪몴以 ?띿꽦
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // ?ㅼ튂 ?꾨즺?섎㈃ deferredPrompt 鍮꾩? + standalone ?곹깭 媛깆떊
    const installedHandler = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return {
    isStandalone,
    isIOS,
    isAndroid,
    canNativeInstall: deferredPrompt !== null,
    promptInstall
  };
}


