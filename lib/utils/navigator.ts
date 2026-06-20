export function safeUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  try {
    return navigator.userAgent || "";
  } catch {
    return "";
  }
}

export function safeNavigatorPlatform(): string {
  if (typeof navigator === "undefined") return "";
  try {
    return navigator.platform || "";
  } catch {
    return "";
  }
}

export function safeMaxTouchPoints(): number {
  if (typeof navigator === "undefined") return 0;
  try {
    return typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  } catch {
    return 0;
  }
}
