// 웹 푸시 클라이언트 유틸 — 서비스 워커 등록 / 구독 / 해제.
//
// 서버 전용(web-push, VAPID_PRIVATE_KEY)은 절대 import 하지 않음.
// VAPID public key 는 NEXT_PUBLIC_ 이라 클라이언트 번들 포함 OK.
//
// 결과 타입으로 호출부(설정 토글)가 권한 거부·미지원을 graceful 하게 처리한다.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "error"; message?: string };

export type UnsubscribeResult = { ok: boolean };

/** 이 브라우저가 푸시를 지원하는지. (SW + PushManager) */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS Safari 는 홈 화면 추가(standalone) 상태에서만 푸시 지원.
 *  설치 전이면 isPushSupported 가 false 라 안내가 필요하므로 별도 판별. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIosUa = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ 는 데스크탑 UA 로 위장 → touch 지원 + Mac 으로 보조 판별.
  const isIpadOs = ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document;
  return isIosUa || isIpadOs;
}

/** VAPID public key(base64url) → Uint8Array (applicationServerKey 용).
 *  ArrayBuffer 백킹으로 만들어 BufferSource 타입(lib.dom)에 정확히 부합시킨다. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) {
    await navigator.serviceWorker.ready;
    return existing;
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

/** 현재 활성 푸시 구독이 있는지 (UI 초기 상태 동기화용). */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** SW 등록 → 권한 요청 → 구독 → 서버 저장. */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "error", message: "VAPID 공개키가 설정되지 않았어요." };

  try {
    const reg = await registerServiceWorker();

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "denied" };
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const json = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth
        }
      })
    });

    if (!res.ok) {
      return { ok: false, reason: "error", message: `서버 저장 실패 (${res.status})` };
    }
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return { ok: false, reason: "error", message };
  }
}

/** 구독 해제 → 서버에서 삭제. */
export async function unsubscribeFromPush(): Promise<UnsubscribeResult> {
  if (!isPushSupported()) return { ok: true };
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) return { ok: true };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {
      /* 로컬 해제 실패해도 서버 삭제는 시도 */
    });

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint })
    }).catch(() => {
      /* 네트워크 실패는 무시 — 다음 발송 시 410 으로 cron 이 정리 */
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
