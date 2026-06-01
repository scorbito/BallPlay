import { Cloud, CloudOff, HardDrive, Loader2 } from "lucide-react";
import type { SyncStatus } from "@/lib/storage/useLineupSync";

type LineupSyncBadgeProps = {
  syncStatus: SyncStatus;
};

/** 헤더 좌측 동기화 상태 배지 — localStorage / DB sync 상태 표시 */
export function LineupSyncBadge({ syncStatus }: LineupSyncBadgeProps) {
  return (
    <div className={`lineup-sync-badge is-${syncStatus}`} title={
      syncStatus === "local-only" ? "이 기기에만 저장 — 로그인하면 다른 기기에서도 사용 가능" :
      syncStatus === "synced" ? "DB와 동기화됨 — 다른 기기에서도 사용 가능" :
      syncStatus === "loading" ? "동기화 중..." :
      "동기화 실패 (이 기기 저장은 정상)"
    }>
      {syncStatus === "loading" ? <Loader2 size={12} className="lineup-sync-spin" /> :
       syncStatus === "synced" ? <Cloud size={12} /> :
       syncStatus === "local-only" ? <HardDrive size={12} /> :
       <CloudOff size={12} />}
      <span>{
        syncStatus === "loading" ? "동기화 중" :
        syncStatus === "synced" ? "동기화됨" :
        syncStatus === "local-only" ? "이 기기만" :
        "동기화 실패"
      }</span>
    </div>
  );
}
