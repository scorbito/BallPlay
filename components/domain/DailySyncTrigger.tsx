"use client";

import { useEffect } from "react";

export function DailySyncTrigger() {
  useEffect(() => {
    fetch("/api/home/sync-daily").catch(() => {});
  }, []);

  return null;
}
