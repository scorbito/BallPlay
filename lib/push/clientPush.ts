import { safeUserAgent } from "@/lib/utils/navigator";

// ???몄떆 ?대씪?댁뼵???좏떥 ???쒕퉬???뚯빱 ?깅줉 / 援щ룆 / ?댁젣.
//
// ?쒕쾭 ?꾩슜(web-push, VAPID_PRIVATE_KEY)? ?덈? import ?섏? ?딆쓬.
// VAPID public key ??NEXT_PUBLIC_ ?대씪 ?대씪?댁뼵??踰덈뱾 ?ы븿 OK.
//
// 寃곌낵 ??낆쑝濡??몄텧遺(?ㅼ젙 ?좉?)媛 沅뚰븳 嫄곕?쨌誘몄??먯쓣 graceful ?섍쾶 泥섎━?쒕떎.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "error"; message?: string };

export type UnsubscribeResult = { ok: boolean };

/** ??釉뚮씪?곗?媛 ?몄떆瑜?吏?먰븯?붿?. (SW + PushManager) */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS Safari ?????붾㈃ 異붽?(standalone) ?곹깭?먯꽌留??몄떆 吏??
 *  ?ㅼ튂 ?꾩씠硫?isPushSupported 媛 false ???덈궡媛 ?꾩슂?섎?濡?蹂꾨룄 ?먮퀎. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = safeUserAgent();
  const isIosUa = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ ???곗뒪?ы깙 UA 濡??꾩옣 ??touch 吏??+ Mac ?쇰줈 蹂댁“ ?먮퀎.
  const isIpadOs = ua.includes("Macintosh") && typeof document !== "undefined" && "ontouchend" in document;
  return isIosUa || isIpadOs;
}

/** VAPID public key(base64url) ??Uint8Array (applicationServerKey ??.
 *  ArrayBuffer 諛깊궧?쇰줈 留뚮뱾??BufferSource ???lib.dom)???뺥솗??遺?⑹떆?⑤떎. */
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

/** ?꾩옱 ?쒖꽦 ?몄떆 援щ룆???덈뒗吏 (UI 珥덇린 ?곹깭 ?숆린?붿슜). */
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

/** SW ?깅줉 ??沅뚰븳 ?붿껌 ??援щ룆 ???쒕쾭 ??? */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "error", message: "VAPID 怨듦컻?ㅺ? ?ㅼ젙?섏? ?딆븯?댁슂." };

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
      return { ok: false, reason: "error", message: `?쒕쾭 ????ㅽ뙣 (${res.status})` };
    }
    return { ok: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "?????녿뒗 ?ㅻ쪟";
    return { ok: false, reason: "error", message };
  }
}

/** 援щ룆 ?댁젣 ???쒕쾭?먯꽌 ??젣. */
export async function unsubscribeFromPush(): Promise<UnsubscribeResult> {
  if (!isPushSupported()) return { ok: true };
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) return { ok: true };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {
      /* 濡쒖뺄 ?댁젣 ?ㅽ뙣?대룄 ?쒕쾭 ??젣???쒕룄 */
    });

    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint })
    }).catch(() => {
      /* ?ㅽ듃?뚰겕 ?ㅽ뙣??臾댁떆 ???ㅼ쓬 諛쒖넚 ??410 ?쇰줈 cron ???뺣━ */
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}


