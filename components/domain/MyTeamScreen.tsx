"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { LineupDiamond, type SwapTraveler } from "@/components/domain/LineupDiamond";
import { BatterSlotList } from "@/components/domain/lineup/BatterSlotList";
import { PitcherSlotList } from "@/components/domain/lineup/PitcherSlotList";
import { LineupPoolCard } from "@/components/domain/lineup/LineupPoolCard";
import { PositionPickerModal } from "@/components/domain/lineup/modals/PositionPickerModal";
import { ConfirmResetModal } from "@/components/domain/lineup/modals/ConfirmResetModal";
import { getRoster } from "@/lib/rosters";
import { useAppState } from "@/lib/state/AppState";
import {
  POSITION_SHORT,
  PITCHER_CLOSER_INDEX,
  PITCHER_REQUIRED_BULLPEN_INDEX,
  PITCHER_SLOTS_COUNT,
  PITCHER_STARTER_INDEX,
  type Player,
  type Position,
  type LineupSlot,
  type LineupMode,
  type LineupOrder
} from "@/lib/types/lineup";
import {
  EMPTY_SLOTS,
  EMPTY_PITCHER_SLOTS,
  ORDERS,
  getFallbackOrder,
  getSwapAnimClass,
  type SlotState
} from "@/lib/lineup/swapHelpers";
import { Trophy, RefreshCw, Sparkles, UserPlus, Bot, Swords, ArrowRight } from "lucide-react";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";
import { buildSimTeamInput } from "@/lib/sim/lineupAdapter";
import { buildFakeOpponentTeam } from "@/lib/sim/fakeOpponent";
import { applyBlendedStatsToTeam, enhanceStatsDirectoryByPlayerIds } from "@/lib/sim/statsLoaderWithRecent";
import { fillMissingPitcherSlots } from "@/lib/sim/autoPitcherLineup";
import statsData from "@/data/kbo_players_2026.json";
import { makeFallbackBatter, makeFallbackPitcher } from "@/lib/sim/leagueAverage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLatestLineupForTeam } from "@/lib/supabase/query-parts/bpRecentLineups";
import { teams as KBO_TEAMS_LIST } from "@/lib/constants/teams";
import { TeamLogo } from "@/components/common/TeamLogo";
import type { SimBatter, SimPitcher } from "@/lib/sim/types";

const ALL_TEAMS = ["doosan", "lg", "kt", "samsung", "ssg", "nc", "kia", "hanwha", "kiwoom", "lotte"];

function getAllKboPlayers(): Player[] {
  return ALL_TEAMS.flatMap((teamId) => getRoster(teamId));
}

type TeamInfo = {
  name: string;
  initials: string;
  badgeStyle: "circle" | "shield";
  color: string;
};

type MyTeamLineup = {
  batting: SlotState[];
  pitching: (string | null)[];
};

type PlayerCardStats = { label: string; value: string }[];
type PlayerDetailSection = {
  title: string;
  stats: { label: string; value: string }[];
};
type RecruitResult = {
  player: Player;
  duplicate: boolean;
};
type RecruitRevealState = {
  title: string;
  subtitle: string;
  results: RecruitResult[];
  revealed: Set<number>;
  doneLabel: string;
};

const SINGLE_RECRUIT_COST = 100;
const TEN_RECRUIT_COST = 900;
const DUPLICATE_SCOUT_PIECES = 10;

function formatRateStat(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(3).replace(/^0/, "")
    : "-";
}

function formatDecimalStat(value: unknown, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatCountStat(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "-";
}

function formatPercentStat(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "-";
}

function getPlayerCardStats(player: Player, batter?: SimBatter, pitcher?: SimPitcher): PlayerCardStats {
  if (player.primaryPosition === "P") {
    return [
      { label: "ERA", value: formatDecimalStat(pitcher?.era, 1) },
      { label: "WHIP", value: formatDecimalStat(pitcher?.whip, 1) },
      { label: "K/9", value: formatDecimalStat(pitcher?.k9, 1) }
    ];
  }

  const ops =
    typeof batter?.ops === "number"
      ? batter.ops
      : typeof batter?.obp === "number" && typeof batter?.slg === "number"
        ? batter.obp + batter.slg
        : undefined;

  return [
    { label: "AVG", value: formatRateStat(batter?.avg) },
    { label: "OBP", value: formatRateStat(batter?.obp) },
    { label: "OPS", value: formatRateStat(ops) }
  ];
}

function getTeamShortName(teamId: string): string {
  return KBO_TEAMS_LIST.find((team) => team.id === teamId)?.shortName ?? teamId.toUpperCase();
}

function getPlayerPositionGroupLabel(position: Position): string {
  if (position === "P") return "투수";
  if (position === "C") return "포수";
  if (position === "LF" || position === "CF" || position === "RF") return "외야";
  if (position === "DH") return "지명";
  return "내야";
}

function hasPlayerStatData(player: Player, batter?: SimBatter, pitcher?: SimPitcher): boolean {
  if (player.primaryPosition === "P") {
    return typeof pitcher?.ip === "number" && pitcher.ip > 0;
  }
  return typeof batter?.pa === "number" && batter.pa > 0;
}

function getPlayerRecordSourceLabel(player: Player, batter?: SimBatter, pitcher?: SimPitcher): string {
  if ((player.seasonGames ?? 0) > 0) return "1군 기록";
  return hasPlayerStatData(player, batter, pitcher) ? "2군 기록" : "기록 없음";
}

function getPlayerDetailSections(player: Player, batter?: SimBatter, pitcher?: SimPitcher): PlayerDetailSection[] {
  const recordSourceLabel = getPlayerRecordSourceLabel(player, batter, pitcher);
  if (player.primaryPosition === "P") {
    return [
      {
        title: "핵심 지표",
        stats: [
          { label: "ERA", value: formatDecimalStat(pitcher?.era) },
          { label: "WHIP", value: formatDecimalStat(pitcher?.whip) },
          { label: "K/9", value: formatDecimalStat(pitcher?.k9) },
          { label: "BB/9", value: formatDecimalStat(pitcher?.bb9) },
          { label: "HR/9", value: formatDecimalStat(pitcher?.hr9) },
          { label: "역할", value: pitcher?.role ?? "-" }
        ]
      },
      {
        title: "누적 기록",
        stats: [
          { label: "이닝", value: formatDecimalStat(pitcher?.ip, 1) },
          { label: "삼진", value: formatCountStat(pitcher?.k) },
          { label: "볼넷", value: formatCountStat(pitcher?.bb) },
          { label: "피홈런", value: formatCountStat(pitcher?.hr) },
          { label: "피안타", value: formatCountStat(pitcher?.hitsAllowed) },
          { label: "자책", value: formatCountStat(pitcher?.earnedRuns) }
        ]
      },
      {
        title: "결과 기록",
        stats: [
          { label: "승", value: formatCountStat(pitcher?.wins) },
          { label: "패", value: formatCountStat(pitcher?.losses) },
          { label: "세이브", value: formatCountStat(pitcher?.saves) },
          { label: "홀드", value: formatCountStat(pitcher?.holds) },
          { label: "투구 체력", value: formatCountStat(pitcher?.staminaPitches) },
          { label: "등판", value: formatCountStat(player.seasonGames) }
        ]
      }
    ];
  }

  const ops =
    typeof batter?.ops === "number"
      ? batter.ops
      : typeof batter?.obp === "number" && typeof batter?.slg === "number"
        ? batter.obp + batter.slg
        : undefined;

  return [
    {
      title: "핵심 지표",
      stats: [
        { label: "AVG", value: formatRateStat(batter?.avg) },
        { label: "OBP", value: formatRateStat(batter?.obp) },
        { label: "SLG", value: formatRateStat(batter?.slg) },
        { label: "OPS", value: formatRateStat(ops) },
        { label: "ISO", value: formatRateStat(batter?.iso) },
        { label: "BABIP", value: formatRateStat(batter?.babip) }
      ]
    },
    {
      title: "누적 기록",
      stats: [
        { label: "경기", value: formatCountStat(player.seasonGames) },
        { label: "타석", value: formatCountStat(batter?.pa) },
        { label: "타수", value: formatCountStat(batter?.ab) },
        { label: "안타", value: formatCountStat(batter?.hits) },
        { label: "2루타", value: formatCountStat(batter?.doubles) },
        { label: "3루타", value: formatCountStat(batter?.triples) },
        { label: "홈런", value: formatCountStat(batter?.homers) },
        { label: "볼넷", value: formatCountStat(batter?.walks) },
        { label: "삼진", value: formatCountStat(batter?.strikeouts) }
      ]
    },
    {
      title: "상세 지표",
      stats: [
        { label: "BB%", value: formatPercentStat(batter?.bbRate) },
        { label: "K%", value: formatPercentStat(batter?.kRate) },
        { label: "컨택", value: formatPercentStat(batter?.contactScore) },
        { label: "vs좌 OPS", value: formatRateStat(batter?.vsLhpOps) },
        { label: "vs우 OPS", value: formatRateStat(batter?.vsRhpOps) },
        { label: "타격", value: player.battingHand ?? "-" }
      ]
    }
  ];
}

export function MyTeamScreen() {
  const router = useRouter();
  const { showToast } = useAppState();
  const [activeTab, setActiveTab] = useState<"players" | "lineup" | "draw" | "match">("players");
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [points, setPoints] = useState<number>(10000);
  const [scoutPieces, setScoutPieces] = useState<number>(0);

  // 창단 폼 상태
  const [formName, setFormName] = useState("");
  const [formInitials, setFormInitials] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");
  const [formBadge, setFormBadge] = useState<"circle" | "shield">("shield");

  // 라인업 관련 상태
  const [mode, setMode] = useState<LineupMode>("batter");
  const [slots, setSlots] = useState<SlotState[]>(EMPTY_SLOTS);
  const [pitcherSlots, setPitcherSlots] = useState<(string | null)[]>(EMPTY_PITCHER_SLOTS);

  // 인터랙션 관련 상태
  const [swapSource, setSwapSource] = useState<Position | null>(null);
  const [swapTravelers, setSwapTravelers] = useState<SwapTraveler[]>([]);
  const swapTimerRef = useRef<number | null>(null);
  const [swapOrderSourceIdx, setSwapOrderSourceIdx] = useState<number | null>(null);
  const [swapOrderAnimation, setSwapOrderAnimation] = useState<{ a: number; b: number } | null>(null);
  const swapOrderAnimTimerRef = useRef<number | null>(null);

  const [positionPickerForOrder, setPositionPickerForOrder] = useState<LineupOrder | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [drawnPlayer, setDrawnPlayer] = useState<Player | null>(null);
  const [recruitReveal, setRecruitReveal] = useState<RecruitRevealState | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [rosterFilter, setRosterFilter] = useState<"all" | "batters" | "pitchers">("all");

  // 로컬 스토리지 데이터 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    const info = localStorage.getItem("ballplay:my-team-info");
    const pl = localStorage.getItem("ballplay:my-team-players");
    const pts = localStorage.getItem("ballplay:my-team-points");
    const pieces = localStorage.getItem("ballplay:my-team-scout-pieces");
    const line = localStorage.getItem("ballplay:my-team-lineup");

    if (info) setTeamInfo(JSON.parse(info));
    if (pl) setPlayers(JSON.parse(pl));
    if (pts) setPoints(Number(pts));
    else setPoints(10000);
    if (pieces) setScoutPieces(Number(pieces));

    if (line) {
      const parsed = JSON.parse(line) as MyTeamLineup;
      setSlots(parsed.batting || EMPTY_SLOTS);
      
      const loadedPitching = [...(parsed.pitching || EMPTY_PITCHER_SLOTS)];
      while (loadedPitching.length < PITCHER_SLOTS_COUNT) {
        loadedPitching.push(null);
      }
      setPitcherSlots(loadedPitching);
    }
  }, []);

  const saveTeamInfo = (info: TeamInfo) => {
    localStorage.setItem("ballplay:my-team-info", JSON.stringify(info));
    setTeamInfo(info);
  };

  const savePlayers = (newPlayers: Player[]) => {
    localStorage.setItem("ballplay:my-team-players", JSON.stringify(newPlayers));
    setPlayers(newPlayers);
  };

  const savePoints = (newPoints: number) => {
    localStorage.setItem("ballplay:my-team-points", String(newPoints));
    setPoints(newPoints);
  };

  const saveScoutPieces = (newPieces: number) => {
    localStorage.setItem("ballplay:my-team-scout-pieces", String(newPieces));
    setScoutPieces(newPieces);
  };

  // 라인업 변경 시 자동 저장
  const triggerSaveLineup = (nextSlots: SlotState[], nextPitcherSlots: (string | null)[]) => {
    const data: MyTeamLineup = {
      batting: nextSlots,
      pitching: nextPitcherSlots
    };
    localStorage.setItem("ballplay:my-team-lineup", JSON.stringify(data));
  };

  // 구단 창단 처리
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formInitials.trim()) return;
    saveTeamInfo({
      name: formName.trim(),
      initials: formInitials.trim().toUpperCase(),
      badgeStyle: formBadge,
      color: formColor
    });
  };

  // 창단 드래프트
  const handleFoundingDraft = () => {
    const allPlayers = getAllKboPlayers();
    const batters = allPlayers.filter(p => p.primaryPosition !== "P");
    const pitchers = allPlayers.filter(p => p.primaryPosition === "P");

    const shuffledBatters = [...batters].sort(() => 0.5 - Math.random());
    const shuffledPitchers = [...pitchers].sort(() => 0.5 - Math.random());

    const selectedBatters = shuffledBatters.slice(0, 15);
    const selectedPitchers = shuffledPitchers.slice(0, 5);
    const foundingPlayers = [...selectedBatters, ...selectedPitchers];

    savePlayers(foundingPlayers);
    savePoints(10000);
    saveScoutPieces(0);
    setRecruitReveal({
      title: "창단 선수 지급",
      subtitle: `기본 선수 ${foundingPlayers.length}명을 확인하세요.`,
      results: foundingPlayers.map((player) => ({ player, duplicate: false })),
      revealed: new Set(),
      doneLabel: "나만의 팀으로 이동"
    });
  };

  const handleResetTeam = () => {
    if (confirm("정말로 구단을 초기화하시겠습니까? 모든 정보가 리셋됩니다.")) {
      localStorage.removeItem("ballplay:my-team-info");
      localStorage.removeItem("ballplay:my-team-players");
      localStorage.removeItem("ballplay:my-team-lineup");
      localStorage.removeItem("ballplay:my-team-points");
      localStorage.removeItem("ballplay:my-team-scout-pieces");
      setTeamInfo(null);
      setPlayers([]);
      setPoints(10000);
      setScoutPieces(0);
      setSlots(EMPTY_SLOTS);
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
    }
  };

  // 선수 뽑기
  const handleDrawPlayer = (count: 1 | 10) => {
    const cost = count === 10 ? TEN_RECRUIT_COST : SINGLE_RECRUIT_COST;
    if (points < cost) {
      alert("포인트가 부족합니다! 상단에서 무료로 충전하세요.");
      return;
    }

    const allPlayers = getAllKboPlayers();
    const availablePlayers = allPlayers;

    if (availablePlayers.length === 0) {
      alert("축하합니다! 이미 모든 KBO 선수를 수집하셨습니다.");
      return;
    }

    const ownedIds = new Set(players.map((player) => player.id));
    const newPlayers = [...players];
    const results: RecruitResult[] = [];
    let nextPieces = scoutPieces;

    for (let i = 0; i < count; i += 1) {
      const randomPlayer = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
      const duplicate = ownedIds.has(randomPlayer.id);
      results.push({ player: randomPlayer, duplicate });

      if (duplicate) {
        nextPieces += DUPLICATE_SCOUT_PIECES;
      } else {
        ownedIds.add(randomPlayer.id);
        newPlayers.push(randomPlayer);
      }
    }

    savePlayers(newPlayers);
    savePoints(points - cost);
    saveScoutPieces(nextPieces);
    setRecruitReveal({
      title: count === 10 ? "10회 선수 영입" : "1회 선수 영입",
      subtitle: `신규 ${results.filter((result) => !result.duplicate).length}명 · 중복 ${results.filter((result) => result.duplicate).length}명`,
      results,
      revealed: new Set(),
      doneLabel: "확인"
    });
  };

  // AI 팀과 대결 실행
  const handleStartAiMatch = async (opponentTeamId: string) => {
    if (!teamInfo) return;
    const filledSlots = slots.filter((s): s is LineupSlot => s !== null);
    const starterId = pitcherSlots[PITCHER_STARTER_INDEX];

    if (filledSlots.length !== 9) {
      showToast("타자 9명을 모두 채워야 경기를 치를 수 있습니다.");
      return;
    }
    if (!starterId) {
      showToast("선발 투수를 지정해야 경기를 치를 수 있습니다.");
      return;
    }

    // 투수 슬롯 자동 보강 (빈 불펜/마무리를 KBO 전체 투수 풀에서 보강함)
    // getTeamStats("doosan")을 통해 유효한 스탯 파일 데이터를 읽어오도록 doosan 구단 ID를 전달합니다.
    const allKboPitchers = getAllKboPlayers().filter(p => p.primaryPosition === "P");
    const validIds = new Set(allKboPitchers.map((p) => p.id));
    const pitchingToUse = fillMissingPitcherSlots(
      "doosan",
      pitcherSlots,
      validIds
    );

    if (!pitchingToUse) {
      showToast("투수 라인업 자동 보충에 실패했습니다.");
      return;
    }

    // 나만의 팀 로스터 선수 스탯 조회
    const playerIds = new Set<string>();
    filledSlots.forEach((s) => playerIds.add(s.playerId));
    pitchingToUse.slots.forEach((id) => id && playerIds.add(id));

    const battersMap = new Map<string, SimBatter>();
    const pitchersMap = new Map<string, SimPitcher>();

    const typedStatsData = statsData as any;
    for (const team of Object.values(typedStatsData.teams) as any[]) {
      for (const b of team.batters) {
        if (playerIds.has(b.playerId)) battersMap.set(b.playerId, b as SimBatter);
      }
      for (const p of team.pitchers) {
        if (playerIds.has(p.playerId)) pitchersMap.set(p.playerId, p as SimPitcher);
      }
    }

    // 혹시 누락된 선수 있을 경우 평균값 fallback 생성
    playerIds.forEach((pid) => {
      if (!battersMap.has(pid) && !pitchersMap.has(pid)) {
        const p = playersMap.get(pid);
        if (p) {
          if (p.primaryPosition === "P") {
            pitchersMap.set(pid, makeFallbackPitcher(pid, p.name, p.throwingHand ?? "R"));
          } else {
            battersMap.set(pid, makeFallbackBatter(pid, p.name, p.battingHand ?? "R"));
          }
        }
      }
    });

    const statsDir = { batters: battersMap, pitchers: pitchersMap };

    // 나만의 팀 SimTeamInput 빌드
    const myAdapt = buildSimTeamInput(
      "my-team",
      { 
        teamId: "my-team", 
        slots: filledSlots, 
        useDH: true, 
        updatedAt: new Date().toISOString() 
      },
      pitchingToUse,
      statsDir,
      teamInfo.name
    );

    if (!myAdapt.ok) {
      showToast("내 라인업을 변환하는 데 실패했습니다.");
      return;
    }

    const seed = generateSeed();
    
    // DB에서 상대 AI 팀의 최신 라인업 힌트 조회
    let opponentHint = null;
    try {
      const client = createSupabaseBrowserClient();
      const res = await getLatestLineupForTeam(client, opponentTeamId);
      if (res.ok) {
        opponentHint = res.row;
      }
    } catch (e) {
      console.error("Failed to fetch latest lineup for AI opponent:", e);
    }

    const opponentRaw = buildFakeOpponentTeam(opponentTeamId, seed, opponentHint);
    if (!opponentRaw) {
      showToast("상대팀 데이터를 로드하지 못했습니다.");
      return;
    }

    // 상대팀 스탯 디렉터리 빌드 및 적용
    const opponentPlayerIds = new Set<string>();
    opponentRaw.batters.forEach(b => opponentPlayerIds.add(b.playerId));
    opponentRaw.starter && opponentPlayerIds.add(opponentRaw.starter.playerId);
    opponentRaw.bullpen.forEach(bp => opponentPlayerIds.add(bp.playerId));

    const oppBattersMap = new Map<string, SimBatter>();
    const oppPitchersMap = new Map<string, SimPitcher>();
    for (const team of Object.values(typedStatsData.teams) as any[]) {
      for (const b of team.batters) {
        if (opponentPlayerIds.has(b.playerId)) oppBattersMap.set(b.playerId, b as SimBatter);
      }
      for (const p of team.pitchers) {
        if (opponentPlayerIds.has(p.playerId)) oppPitchersMap.set(p.playerId, p as SimPitcher);
      }
    }

    const oppStatsDir = { batters: oppBattersMap, pitchers: oppPitchersMap };
    
    // DB 최근 폼 능력치 블렌딩 반영
    try {
      const client = createSupabaseBrowserClient();
      await enhanceStatsDirectoryByPlayerIds(client, oppStatsDir, Array.from(opponentPlayerIds));
    } catch (e) {
      console.error("Failed to enhance stats directory with recent form for opponent:", e);
    }

    const opponent = applyBlendedStatsToTeam(opponentRaw, oppStatsDir);

    const input = {
      home: myAdapt.team,
      away: opponent,
      context: {}
    };

    // 가상 대결 세션 저장
    saveMatchSession({
      myTeamId: "my-team",
      opponentTeamId,
      seed,
      input,
      startedAt: new Date().toISOString(),
      source: "ai"
    });

    showToast("경기를 시작합니다!");
    router.push("/stadium/play");
  };

  // 선수 매핑용 Map
  const playersMap = useMemo(() => {
    return new Map<string, Player>(players.map(p => [p.id, p]));
  }, [players]);

  const playerStatsById = useMemo(() => {
    const byId = new Map<string, { batter?: SimBatter; pitcher?: SimPitcher }>();
    const typedStatsData = statsData as any;

    for (const team of Object.values(typedStatsData.teams ?? {}) as any[]) {
      for (const batter of team.batters ?? []) {
        const current = byId.get(batter.playerId) ?? {};
        byId.set(batter.playerId, { ...current, batter: batter as SimBatter });
      }
      for (const pitcher of team.pitchers ?? []) {
        const current = byId.get(pitcher.playerId) ?? {};
        byId.set(pitcher.playerId, { ...current, pitcher: pitcher as SimPitcher });
      }
    }

    return byId;
  }, []);

  const filteredRosterPlayers = useMemo(() => {
    if (rosterFilter === "batters") {
      return players.filter((p) => p.primaryPosition !== "P");
    }
    if (rosterFilter === "pitchers") {
      return players.filter((p) => p.primaryPosition === "P");
    }
    return players;
  }, [players, rosterFilter]);

  // 로스터 변경 시 stale ID 클렌징 (로스터에 없는 선수가 라인업에 남아 오류를 유발하는 현상 방지)
  useEffect(() => {
    if (players.length === 0) return;
    setSlots((current) => {
      let changed = false;
      const next = current.map((s) => {
        if (s !== null && !playersMap.has(s.playerId)) {
          changed = true;
          return null;
        }
        return s;
      });
      return changed ? next : current;
    });
    setPitcherSlots((current) => {
      let changed = false;
      const next = current.map((id) => {
        if (id !== null && !playersMap.has(id)) {
          changed = true;
          return null;
        }
        return id;
      });
      return changed ? next : current;
    });
  }, [players, playersMap]);

  // 다이아몬드 렌더용 slots
  const diamondSlots = useMemo(() => {
    const combined: SlotState[] = [...slots];
    const starterId = pitcherSlots[PITCHER_STARTER_INDEX];
    if (starterId) {
      combined.push({ order: 1 as LineupOrder, playerId: starterId, position: "P" });
    }
    return combined;
  }, [slots, pitcherSlots]);

  // 배치된 선수 ID 세트 (중복 방지용)
  const placedPlayerIds = useMemo(() => {
    if (mode === "batter") {
      return new Set(slots.filter((s): s is LineupSlot => s !== null).map((s) => s.playerId));
    }
    const ids = new Set<string>();
    pitcherSlots.forEach((id) => id && ids.add(id));
    return ids;
  }, [mode, slots, pitcherSlots]);

  // 선수 추가 핸들러
  const handleAddPlayer = (player: Player) => {
    if (placedPlayerIds.has(player.id)) {
      showToast("이미 라인업에 배치되어 있습니다.");
      return;
    }

    if (mode === "batter") {
      if (player.primaryPosition === "P") {
        showToast("투수는 투수 탭에서 배치해 주세요.");
        return;
      }
      const firstEmpty = slots.findIndex((s) => s === null);
      if (firstEmpty === -1) {
        showToast("타순 9명이 모두 찼습니다.");
        return;
      }

      const usedPositions = new Set(
        slots.filter((s): s is LineupSlot => s !== null).map((s) => s.position)
      );
      const fallbackOrder = getFallbackOrder(player.primaryPosition);
      const assignedPosition: Position = usedPositions.has(player.primaryPosition)
        ? (fallbackOrder.find((p) => !usedPositions.has(p)) ?? player.primaryPosition)
        : player.primaryPosition;

      const next = [...slots];
      next[firstEmpty] = {
        order: (firstEmpty + 1) as LineupOrder,
        playerId: player.id,
        position: assignedPosition
      };
      setSlots(next);
      triggerSaveLineup(next, pitcherSlots);
      return;
    }

    // 투수 배치
    if (player.primaryPosition !== "P") {
      showToast("야수는 타자 탭에서 배치해 주세요.");
      return;
    }
    const next = [...pitcherSlots];
    while (next.length < PITCHER_SLOTS_COUNT) {
      next.push(null);
    }
    
    // 선발(0), 마무리(1), 불펜 1선발(2)에 해당하는 인덱스만 한정 배치
    const allowedIndices = [PITCHER_STARTER_INDEX, PITCHER_CLOSER_INDEX, PITCHER_REQUIRED_BULLPEN_INDEX];
    const emptyIdx = allowedIndices.find((idx) => next[idx] === null);

    if (emptyIdx === undefined) {
      showToast("투수 배치 한도(3명: 선발 1, 불펜 1, 마무리 1)를 초과했습니다.");
      return;
    }

    next[emptyIdx] = player.id;
    setPitcherSlots(next);
    triggerSaveLineup(slots, next);
  };

  const handleRemoveSlot = (order: LineupOrder) => {
    const next = slots.map((s, i) => (i === order - 1 ? null : s));
    setSlots(next);
    triggerSaveLineup(next, pitcherSlots);
    setSwapOrderSourceIdx(null);
  };

  const handleRemovePitcher = (idx: number) => {
    const next = pitcherSlots.map((id, i) => (i === idx ? null : id));
    setPitcherSlots(next);
    triggerSaveLineup(slots, next);
    setSwapOrderSourceIdx(null);
  };

  // 타순 순서 바꿈 (order 클릭)
  const handleOrderClick = (idx: number) => {
    if (swapOrderSourceIdx === null) {
      setSwapOrderSourceIdx(idx);
      return;
    }
    if (swapOrderSourceIdx === idx) {
      setSwapOrderSourceIdx(null);
      return;
    }

    if (mode === "batter") {
      const a = slots[swapOrderSourceIdx];
      const b = slots[idx];
      const next = [...slots];
      next[swapOrderSourceIdx] = b ? { ...b, order: (swapOrderSourceIdx + 1) as LineupOrder } : null;
      next[idx] = a ? { ...a, order: (idx + 1) as LineupOrder } : null;
      setSlots(next);
      triggerSaveLineup(next, pitcherSlots);
    } else {
      const next = [...pitcherSlots];
      [next[swapOrderSourceIdx], next[idx]] = [next[idx], next[swapOrderSourceIdx]];
      setPitcherSlots(next);
      triggerSaveLineup(slots, next);
    }

    setSwapOrderAnimation({ a: swapOrderSourceIdx, b: idx });
    if (swapOrderAnimTimerRef.current !== null) window.clearTimeout(swapOrderAnimTimerRef.current);
    swapOrderAnimTimerRef.current = window.setTimeout(() => {
      setSwapOrderAnimation(null);
      swapOrderAnimTimerRef.current = null;
    }, 450);

    setSwapOrderSourceIdx(null);
    showToast("순서를 바꿨어요.");
  };

  // 포지션 모달 변경 핸들러
  const handleChangePosition = (order: LineupOrder, newPosition: Position) => {
    const sourceIdx = order - 1;
    const sourceSlot = slots[sourceIdx];
    if (!sourceSlot || sourceSlot.position === newPosition) {
      setPositionPickerForOrder(null);
      return;
    }

    const conflictIdx = slots.findIndex(
      (s, i) => s !== null && i !== sourceIdx && s.position === newPosition
    );
    const oldPosition = sourceSlot.position;

    const next = slots.map((s, i) => {
      if (!s) return s;
      if (i === sourceIdx) return { ...s, position: newPosition };
      if (conflictIdx !== -1 && i === conflictIdx) return { ...s, position: oldPosition };
      return s;
    });

    setSlots(next);
    triggerSaveLineup(next, pitcherSlots);

    const travelers: SwapTraveler[] = [
      { playerId: sourceSlot.playerId, from: oldPosition, to: newPosition }
    ];
    if (conflictIdx !== -1) {
      const conflictSlot = slots[conflictIdx];
      if (conflictSlot) {
        travelers.push({
          playerId: conflictSlot.playerId,
          from: newPosition,
          to: oldPosition
        });
      }
    }
    setSwapTravelers(travelers);
    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);

    setPositionPickerForOrder(null);
  };

  // 다이아몬드 연속 클릭 포지션 스왑
  const handleDiamondPositionClick = (pos: Position) => {
    if (pos === "P") {
      showToast("투수는 투수 탭에서 관리해 주세요.");
      setSwapSource(null);
      return;
    }
    if (swapSource === null) {
      setSwapSource(pos);
      return;
    }
    if (swapSource === pos) {
      setSwapSource(null);
      return;
    }

    const sourceIdx = slots.findIndex((s) => s !== null && s.position === swapSource);
    const targetIdx = slots.findIndex((s) => s !== null && s.position === pos);

    if (sourceIdx === -1 && targetIdx === -1) {
      setSwapSource(pos);
      return;
    }

    const travelers: SwapTraveler[] = [];
    if (sourceIdx !== -1) {
      travelers.push({ playerId: slots[sourceIdx]!.playerId, from: swapSource, to: pos });
    }
    if (targetIdx !== -1) {
      travelers.push({ playerId: slots[targetIdx]!.playerId, from: pos, to: swapSource });
    }

    const next = slots.map((s, i) => {
      if (!s) return s;
      if (i === sourceIdx && i === targetIdx) return s;
      if (i === sourceIdx) return { ...s, position: pos };
      if (i === targetIdx) return { ...s, position: swapSource };
      return s;
    });

    setSlots(next);
    triggerSaveLineup(next, pitcherSlots);

    setSwapSource(null);
    setSwapTravelers(travelers);
    showToast("포지션을 바꿨어요.");

    if (swapTimerRef.current !== null) window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(() => {
      setSwapTravelers([]);
      swapTimerRef.current = null;
    }, 650);
  };

  const handleReset = () => {
    if (mode === "batter") {
      if (slots.every((s) => s === null)) return;
    } else {
      if (pitcherSlots.every((s) => s === null)) return;
    }
    setConfirmResetOpen(true);
  };

  const confirmReset = () => {
    if (mode === "batter") {
      setSlots(EMPTY_SLOTS);
      triggerSaveLineup(EMPTY_SLOTS, pitcherSlots);
      setSwapSource(null);
    } else {
      setPitcherSlots(EMPTY_PITCHER_SLOTS);
      triggerSaveLineup(slots, EMPTY_PITCHER_SLOTS);
    }
    setConfirmResetOpen(false);
    showToast("라인업을 비웠습니다.");
  };

  // 대기 선수 풀 (보유 선수 중 라인업에 들지 않은 선수 리스트)
  const poolPlayers = useMemo(() => {
    const filtered = players.filter((p) => !placedPlayerIds.has(p.id));
    const byMode = mode === "batter"
      ? filtered.filter((p) => p.primaryPosition !== "P")
      : filtered.filter((p) => p.primaryPosition === "P");
    return byMode.sort((a, b) => {
      const ga = a.seasonGames ?? 0;
      const gb = b.seasonGames ?? 0;
      if (ga !== gb) return gb - ga;
      return a.jerseyNumber - b.jerseyNumber;
    });
  }, [players, placedPlayerIds, mode]);

  const filledCount = slots.filter((s) => s !== null && playersMap.has(s.playerId)).length;
  const pitcherFilled = pitcherSlots.filter((id) => id !== null && playersMap.has(id)).length;

  const BadgeIcon = ({ initials, style, color }: { initials: string; style: "circle" | "shield"; color: string }) => {
    const styleClass = style === "shield" ? "rounded-b-2xl rounded-t-lg" : "rounded-full";
    return (
      <div 
        className={`w-12 h-12 flex items-center justify-center font-bold text-white shadow-md border-2 border-white ${styleClass}`}
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
    );
  };

  // 1. 구단 미설립 상태
  if (!teamInfo) {
    return (
      <AppShell activeTab="home" title="나만의 팀 구단 창단" backHref="/" theme="light">
        <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-md mt-6">
          <div className="text-center mb-6">
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-2xl font-extrabold text-slate-800">나만의 야구단 창단</h2>
            <p className="text-sm text-slate-500 mt-1">당신만의 고유한 구단을 설립해 보세요!</p>
          </div>

          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">구단 이름</label>
              <input
                type="text"
                required
                maxLength={12}
                placeholder="예: 단우 베어스"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">대표 이니셜 (1~3자)</label>
              <input
                type="text"
                required
                maxLength={3}
                placeholder="예: DW"
                value={formInitials}
                onChange={(e) => setFormInitials(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">팀 컬러</label>
              <div className="flex gap-2">
                {["#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#1e293b"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${formColor === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">뱃지 스타일</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormBadge("shield")}
                  className={`flex-1 py-2 border rounded-lg text-sm font-medium ${formBadge === "shield" ? "bg-slate-100 border-slate-800" : "border-slate-200"}`}
                >
                  방패형
                </button>
                <button
                  type="button"
                  onClick={() => setFormBadge("circle")}
                  className={`flex-1 py-2 border rounded-lg text-sm font-medium ${formBadge === "circle" ? "bg-slate-100 border-slate-800" : "border-slate-200"}`}
                >
                  원형
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                구단 승인 및 창단
              </button>
            </div>
          </form>
        </div>
      </AppShell>
    );
  }

  // 2. 창단 직후 드래프트 대기 상태
  if (players.length === 0) {
    return (
      <AppShell activeTab="home" title="나만의 팀 드래프트" backHref="/" theme="light">
        <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-md mt-6 text-center">
          <BadgeIcon initials={teamInfo.initials} style={teamInfo.badgeStyle} color={teamInfo.color} />
          <h2 className="text-2xl font-extrabold text-slate-800 mt-4">{teamInfo.name} 창단 완료!</h2>
          <p className="text-sm text-slate-500 mt-2">
            이제 첫 기본 선수단(타자 15명, 투수 3명)을 영입하기 위한 창단 드래프트를 실행합니다.
          </p>
          <div className="mt-8">
            <button
              onClick={handleFoundingDraft}
              className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-2xl shadow-lg transition-all transform hover:scale-105"
            >
              드래프트 선수단 받기 🚀
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // 3. 나만의 팀 코어 대시보드 (선수단 / 라인업 빌더 / 뽑기)
  return (
    <AppShell activeTab="home" title="나만의 팀" backHref="/" wide theme="light">
      
      {/* 구단 헤더 */}
      <div className="w-full max-w-3xl mx-auto mt-4 mb-0 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BadgeIcon initials={teamInfo.initials} style={teamInfo.badgeStyle} color={teamInfo.color} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-900">{teamInfo.name}</h2>
              <p className="text-xs font-semibold text-slate-400">보유 선수 {players.length}명</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-600">
            {points.toLocaleString()} BP
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("players");
              setRosterFilter("all");
            }}
            className={`rounded-2xl px-2 py-3 text-xs font-black shadow-sm transition-all active:scale-95 ${
              activeTab === "players"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            보유선수
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("lineup")}
            className={`rounded-2xl px-2 py-3 text-xs font-black shadow-sm transition-all active:scale-95 ${
              activeTab === "lineup"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            라인업관리
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            className={`rounded-2xl px-2 py-3 text-xs font-black shadow-sm transition-all active:scale-95 ${
              activeTab === "draw"
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            선수 영입
          </button>
        </div>
      </div>

      <div className="hidden">
        <div className="flex items-center gap-3">
          <BadgeIcon initials={teamInfo.initials} style={teamInfo.badgeStyle} color={teamInfo.color} />
          <div>
            <h2 className="font-extrabold text-base text-slate-800">{teamInfo.name}</h2>
            <p className="text-[10px] text-slate-400">보유 선수 {players.length}명</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              {points.toLocaleString()} BP
            </span>
            <button 
              onClick={() => savePoints(points + 10000)}
              className="text-[9px] text-blue-600 hover:underline mt-0.5"
            >
              +10K 충전
            </button>
          </div>

          <button
            onClick={() => setActiveTab(activeTab === "lineup" ? "players" : "lineup")}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow transition-colors"
          >
            {activeTab === "lineup" ? "대시보드 보기" : "라인업 짜기"}
          </button>
        </div>
      </div>

      {/* 탭: 대시보드(선수단 & 뽑기) 혹은 라인업 빌더 */}
      {activeTab !== "lineup" ? (
        <>
          <div className="w-full max-w-4xl mx-auto space-y-3 px-2 sm:px-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRosterFilter("batters")}
                className={`rounded-2xl border p-3 text-center shadow-sm transition-all active:scale-95 ${
                  rosterFilter === "batters"
                    ? "border-pink-200 bg-pink-50"
                    : "border-slate-100 bg-white"
                }`}
              >
                <p className="text-[10px] font-bold text-slate-400">타자</p>
                <strong className="mt-1 block text-lg font-black text-slate-900">
                  {players.filter((p) => p.primaryPosition !== "P").length}
                </strong>
              </button>
              <button
                type="button"
                onClick={() => setRosterFilter("pitchers")}
                className={`rounded-2xl border p-3 text-center shadow-sm transition-all active:scale-95 ${
                  rosterFilter === "pitchers"
                    ? "border-pink-200 bg-pink-50"
                    : "border-slate-100 bg-white"
                }`}
              >
                <p className="text-[10px] font-bold text-slate-400">투수</p>
                <strong className="mt-1 block text-lg font-black text-slate-900">
                  {players.filter((p) => p.primaryPosition === "P").length}
                </strong>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("lineup")}
                className="rounded-2xl border border-slate-100 bg-white p-3 text-center shadow-sm transition-all active:scale-95"
              >
                <p className="text-[10px] font-bold text-slate-400">라인업</p>
                <strong className="mt-1 block text-lg font-black text-slate-900">
                  {filledCount}/9
                </strong>
              </button>
            </div>

            {activeTab === "draw" ? (
              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">선수 영입</h3>
                    <p className="text-[10px] font-semibold text-slate-400">KBO 전체 선수 중 랜덤으로 영입합니다.</p>
                  </div>
                  <span className="rounded-full border border-pink-100 bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-500">
                    조각 {scoutPieces}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleDrawPlayer(1)}
                    className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">1회</span>
                    <strong className="mt-3 block text-lg font-black text-slate-900">선수 1명 영입</strong>
                    <span className="mt-1 block text-xs font-bold text-slate-400">100 BP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDrawPlayer(10)}
                    className="rounded-3xl border border-pink-100 bg-gradient-to-br from-pink-50 to-white p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
                  >
                    <span className="inline-flex rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-black text-pink-600">10회</span>
                    <strong className="mt-3 block text-lg font-black text-slate-900">선수 10명 영입</strong>
                    <span className="mt-1 block text-xs font-bold text-slate-400">900 BP · 100 BP 할인</span>
                  </button>
                </div>
                <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">
                  중복 선수는 스카우트 조각 {DUPLICATE_SCOUT_PIECES}개로 전환됩니다.
                </p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">보유 선수</h3>
                  <p className="text-[10px] font-semibold text-slate-400">내 구단에 등록된 선수단입니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("lineup")}
                  className="hidden"
                >
                  라인업 관리
                </button>
              </div>
              <ul className="grid max-h-[560px] grid-cols-3 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filteredRosterPlayers.map((p) => {
                  const stats = playerStatsById.get(p.id);
                  const cardStats = getPlayerCardStats(p, stats?.batter, stats?.pitcher);
                  const teamShortName = getTeamShortName(p.teamId);

                  return (
                    <li
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPlayer(p)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedPlayer(p);
                        }
                      }}
                      className="relative cursor-pointer overflow-hidden rounded-2xl border border-pink-100 bg-white p-2.5 shadow-sm transition-transform active:scale-[0.98]"
                    >
                      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-r from-pink-50 to-white" aria-hidden="true" />
                      <div className="relative flex items-start justify-between gap-1">
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80 shadow-sm ring-1 ring-pink-100 [&_.team-logo]:!h-4 [&_.team-logo]:!w-4 [&_.team-logo-img]:!h-4 [&_.team-logo-img]:!w-4 [&_.team-logo-wrap]:!inline-flex">
                            <TeamLogo teamId={p.teamId} size="sm" />
                          </span>
                          <span className="truncate text-[9px] font-black text-pink-500">{teamShortName}</span>
                        </span>
                        <span className="rounded-full border border-pink-100 bg-pink-50 px-1.5 py-0.5 text-[9px] font-black text-pink-500">
                          {getPlayerPositionGroupLabel(p.primaryPosition)}
                        </span>
                      </div>
                      <div className="relative mt-3 text-center">
                        <p className="text-[10px] font-black text-slate-400">
                          #{Number.isFinite(p.jerseyNumber) ? p.jerseyNumber : "-"}
                        </p>
                        <p className="mt-1 truncate text-[15px] font-black text-slate-900">{p.name}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-2">
                        {cardStats.map((stat) => (
                          <div key={stat.label} className="min-w-0 px-1 text-center">
                            <p className="truncate text-[8px] font-bold text-slate-400">{stat.label}</p>
                            <p className="mt-0.5 truncate text-[10px] font-black text-pink-500">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 border-t border-slate-100 pt-4 text-center">
                <button onClick={handleResetTeam} className="text-[10px] font-semibold text-red-500 hover:underline">
                  구단 해체 및 모든 데이터 리셋
                </button>
              </div>
            </div>
          </div>

          <div className="hidden">
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("players")}
              className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all ${activeTab === "players" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
            >
              보유 선수
            </button>
            <button
              onClick={() => setActiveTab("draw")}
              className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all ${activeTab === "draw" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
            >
              선수 영입 (뽑기)
            </button>
            <button
              onClick={() => setActiveTab("match")}
              className={`flex-1 py-2 text-center rounded-lg font-bold text-xs transition-all ${activeTab === "match" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}
            >
              AI 대결 (시뮬)
            </button>
          </nav>

          {activeTab === "players" ? (
            <div className="bg-white p-4 rounded-2xl border shadow-sm">
              <ul className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {players.map((p) => (
                  <li key={p.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {p.primaryPosition}
                    </span>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs text-slate-800 truncate">{p.name}</p>
                      <p className="text-[9px] text-slate-400">{p.teamId.toUpperCase()}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="text-center pt-4 border-t mt-4">
                <button onClick={handleResetTeam} className="text-[10px] text-red-500 hover:underline">
                  구단 해체 및 모든 데이터 리셋
                </button>
              </div>
            </div>
          ) : activeTab === "draw" ? (
            <div className="bg-white p-6 rounded-2xl border shadow-sm text-center space-y-4">
              <Sparkles className="w-12 h-12 text-yellow-400 mx-auto animate-pulse" />
              <div>
                <h3 className="font-black text-slate-800">KBO 선수 1회 영입</h3>
                <p className="text-xs text-slate-400 mt-1">1,000 BP가 차감되며 중복은 나오지 않습니다.</p>
              </div>
              <button
                onClick={() => handleDrawPlayer(1)}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all"
              >
                선수 영입 (1,000 BP)
              </button>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">KBO AI 구단 대결</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">내가 구성한 나만의 팀 라인업(타자 9명, 선발 1명 필수)으로 KBO 10개 구단에 도전합니다.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
                {KBO_TEAMS_LIST.map((team) => (
                  <div key={team.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo teamId={team.id} size="sm" />
                      <strong className="text-xs font-bold text-slate-800 truncate">{team.name}</strong>
                    </div>
                    <button
                      onClick={() => handleStartAiMatch(team.id)}
                      className="px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[10px] rounded-lg shadow-sm flex items-center gap-0.5 shrink-0 transition-colors"
                    >
                      <Swords size={10} /> 도전
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
      ) : (
        <>
        <div className="hidden">
          <button
            type="button"
            onClick={() => setActiveTab("players")}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 shadow-sm"
          >
            보유 선수 보기
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            className="rounded-2xl bg-amber-500 px-3 py-3 text-sm font-black text-white shadow-sm"
          >
            선수 영입
          </button>
        </div>
        {/* 라인업 빌더 UI 이식 (기존 LineupBuilderScreen 마크업 복제) */}
        <div className="lineup-layout">
          
          {/* 야구장 다이아몬드 */}
          <section
            className="lineup-diamond-card"
            aria-label={mode === "batter" ? "수비 위치" : "선발 투수"}
          >
            <LineupDiamond
              slots={diamondSlots}
              playersById={playersMap}
              teamColor={teamInfo.color}
              selectedPosition={mode === "batter" ? swapSource : null}
              onPositionClick={mode === "batter" ? handleDiamondPositionClick : undefined}
              travelers={mode === "batter" ? swapTravelers : []}
            />
            {swapSource ? (
              <div className="lineup-field-hint" role="status">
                <strong>{POSITION_SHORT[swapSource]}</strong> 선택됨 · 교환할 다른 포지션을 탭하세요
                <button type="button" className="lineup-field-hint-cancel" onClick={() => setSwapSource(null)}>
                  취소
                </button>
              </div>
            ) : null}
          </section>

          {/* 타자/투수 탭 토글 및 정보 표시 */}
          <div className="lineup-action-row">
            <div className="lineup-action-lead">
              <p className="lineup-action-hint">
                나만의 팀 라인업 ({filledCount}/9 타자, {pitcherFilled}/3 투수)
              </p>
            </div>
            <div className="lineup-action-buttons">
              <div className="lineup-mode-toggle lineup-mode-toggle-inline" role="tablist" aria-label="라인업 종류">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "batter"}
                  className={mode === "batter" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
                  onClick={() => {
                    setMode("batter");
                    setSwapSource(null);
                  }}
                >
                  타자
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "pitcher"}
                  className={mode === "pitcher" ? "lineup-mode-tab lineup-mode-tab-active" : "lineup-mode-tab"}
                  onClick={() => {
                    setMode("pitcher");
                    setSwapSource(null);
                  }}
                >
                  투수
                </button>
              </div>
            </div>
          </div>

          {/* 선발라인업/투수 배치 목록 (하단 좌측) */}
          {mode === "batter" ? (
            <BatterSlotList
              slots={slots}
              filledCount={filledCount}
              playersById={playersMap}
              swapOrderSourceIdx={swapOrderSourceIdx}
              swapOrderAnimation={swapOrderAnimation}
              isLocked={false}
              onOrderClick={handleOrderClick}
              onPositionPickerOpen={(order) => setPositionPickerForOrder(order)}
              onRemove={handleRemoveSlot}
              onReset={handleReset}
            />
          ) : (
            <PitcherSlotList
              pitcherSlots={pitcherSlots}
              pitcherFilled={pitcherFilled}
              playersById={playersMap}
              swapOrderSourceIdx={swapOrderSourceIdx}
              swapOrderAnimation={swapOrderAnimation}
              isLocked={false}
              onOrderClick={handleOrderClick}
              onRemove={handleRemovePitcher}
              onReset={handleReset}
            />
          )}

          {/* 대기 선수 목록 (하단 우측) */}
          <LineupPoolCard
            poolPlayers={poolPlayers}
            isLocked={false}
            onAddPlayer={handleAddPlayer}
            onLockedClick={() => {}}
          />

        </div>
        </>
      )}

      {/* 모달 연동 */}
      <ConfirmResetModal
        open={confirmResetOpen}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={confirmReset}
      />

      <PositionPickerModal
        order={positionPickerForOrder}
        slots={slots}
        onClose={() => setPositionPickerForOrder(null)}
        onPick={handleChangePosition}
      />

      {/* 선수 뽑기 성공 모달 */}
      {selectedPlayer !== null && (() => {
        const stats = playerStatsById.get(selectedPlayer.id);
        const detailSections = getPlayerDetailSections(selectedPlayer, stats?.batter, stats?.pitcher);
        const originalTeamName = getTeamShortName(selectedPlayer.teamId);
        const positionLabel = getPlayerPositionGroupLabel(selectedPlayer.primaryPosition);
        const recordSourceLabel = getPlayerRecordSourceLabel(selectedPlayer, stats?.batter, stats?.pitcher);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
            <div className="max-h-[92vh] w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-pink-100 bg-white shadow-2xl">
              <div className="max-h-[92vh] overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-pink-500">현재팀</p>
                    <h3 className="mt-0.5 truncate text-sm font-black text-slate-900">{teamInfo.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(null)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-sm"
                  >
                    닫기
                  </button>
                </div>

                <div className="mt-2 rounded-3xl border border-pink-100 bg-gradient-to-br from-pink-50 via-white to-white p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-pink-100 [&_.team-logo]:!h-7 [&_.team-logo]:!w-7 [&_.team-logo-img]:!h-7 [&_.team-logo-img]:!w-7">
                        <TeamLogo teamId={selectedPlayer.teamId} size="sm" />
                      </span>
                      <span className="text-lg font-black text-pink-500">{originalTeamName}</span>
                      <span className="text-lg font-black tracking-normal text-pink-500">
                        #{Number.isFinite(selectedPlayer.jerseyNumber) ? selectedPlayer.jerseyNumber : "-"}
                      </span>
                    </div>
                    <h4 className="mt-1 truncate text-2xl font-black tracking-normal text-slate-900">
                      {selectedPlayer.name}
                    </h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="hidden">
                        <span className="flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-full [&_.team-logo]:!h-3.5 [&_.team-logo]:!w-3.5 [&_.team-logo-img]:!h-3.5 [&_.team-logo-img]:!w-3.5">
                          <TeamLogo teamId={selectedPlayer.teamId} size="sm" />
                        </span>
                        원래팀 {originalTeamName}
                      </span>
                      <span className="rounded-full border border-pink-100 bg-white px-2.5 py-1 text-xs font-black text-pink-500">
                        {positionLabel}
                      </span>
                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-600">
                        {recordSourceLabel}
                      </span>
                      <span className="rounded-full border border-slate-100 bg-white px-2.5 py-1 text-xs font-black text-slate-500">
                        {selectedPlayer.primaryPosition === "P"
                          ? `투구 ${selectedPlayer.throwingHand ?? "-"}`
                          : `타격 ${selectedPlayer.battingHand ?? "-"}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  {detailSections.map((section, sectionIndex) => (
                    <section key={section.title} className="rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                      <h5 className="text-sm font-black text-slate-900">
                        {sectionIndex === 1 ? `누적 기록 (${recordSourceLabel})` : section.title}
                      </h5>
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        {section.stats.map((stat) => (
                          <div key={`${section.title}-${stat.label}`} className="rounded-xl bg-slate-50 px-1.5 py-1.5 text-center">
                            <p className="truncate text-[10px] font-bold text-slate-400">{stat.label}</p>
                            <p className="truncate text-sm font-black text-slate-900">{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {recruitReveal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-[1.75rem] border border-pink-100 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">{recruitReveal.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">{recruitReveal.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecruitReveal((current) =>
                    current ? { ...current, revealed: new Set(current.results.map((_, index) => index)) } : current
                  );
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-600 shadow-sm"
              >
                모두 공개
              </button>
            </div>

            <div
              className={`mt-4 grid max-h-[62vh] gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                recruitReveal.results.length === 1
                  ? "grid-cols-1 place-items-center"
                  : "grid-cols-2 sm:grid-cols-5"
              }`}
            >
              {recruitReveal.results.map((result, index) => {
                const isRevealed = recruitReveal.revealed.has(index);
                const stats = playerStatsById.get(result.player.id);
                const cardStats = getPlayerCardStats(result.player, stats?.batter, stats?.pitcher);

                return (
                  <button
                    key={`${result.player.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setRecruitReveal((current) => {
                        if (!current) return current;
                        const revealed = new Set(current.revealed);
                        revealed.add(index);
                        return { ...current, revealed };
                      });
                    }}
                    className={`group min-h-[178px] [perspective:900px] ${
                      recruitReveal.results.length === 1 ? "w-full max-w-[322px]" : ""
                    }`}
                  >
                    <div className={`relative h-full min-h-[178px] transition-transform duration-500 [transform-style:preserve-3d] ${isRevealed ? "[transform:rotateY(180deg)]" : ""}`}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-500 to-amber-400 p-3 text-white shadow-sm [backface-visibility:hidden]">
                        <Sparkles className="h-8 w-8" />
                        <span className="mt-3 text-xs font-black">BP CARD</span>
                        <span className="mt-1 text-[10px] font-bold text-white/80">탭해서 공개</span>
                      </div>
                      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-pink-100 bg-white p-2.5 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-r from-pink-50 to-white" aria-hidden="true" />
                        <div className="relative flex items-start justify-between gap-1">
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80 shadow-sm ring-1 ring-pink-100 [&_.team-logo]:!h-4 [&_.team-logo]:!w-4 [&_.team-logo-img]:!h-4 [&_.team-logo-img]:!w-4 [&_.team-logo-wrap]:!inline-flex">
                              <TeamLogo teamId={result.player.teamId} size="sm" />
                            </span>
                            <span className="truncate text-[9px] font-black text-pink-500">{getTeamShortName(result.player.teamId)}</span>
                          </span>
                          <span className="rounded-full border border-pink-100 bg-pink-50 px-1.5 py-0.5 text-[9px] font-black text-pink-500">
                            {result.duplicate ? "중복" : "신규"}
                          </span>
                        </div>
                        <div className="relative mt-3 text-center">
                          <p className="text-[10px] font-black text-slate-400">
                            #{Number.isFinite(result.player.jerseyNumber) ? result.player.jerseyNumber : "-"}
                          </p>
                          <p className="mt-1 truncate text-[15px] font-black text-slate-900">{result.player.name}</p>
                          <p className="mx-auto mt-1 inline-flex rounded-full border border-pink-100 bg-pink-50 px-2 py-0.5 text-[9px] font-black text-pink-500">
                            {getPlayerPositionGroupLabel(result.player.primaryPosition)}
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-2">
                          {cardStats.map((stat) => (
                            <div key={stat.label} className="min-w-0 px-1 text-center">
                              <p className="truncate text-[8px] font-bold text-slate-400">{stat.label}</p>
                              <p className="mt-0.5 truncate text-[10px] font-black text-pink-500">{stat.value}</p>
                            </div>
                          ))}
                        </div>
                        {result.duplicate ? (
                          <div className="mt-1 rounded-full bg-slate-900 px-2 py-1 text-center text-[9px] font-black text-white">
                            조각 +{DUPLICATE_SCOUT_PIECES}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setRecruitReveal(null)}
              className="mt-4 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white shadow-sm transition-transform active:scale-[0.98]"
            >
              {recruitReveal.doneLabel}
            </button>
          </div>
        </div>
      )}

      {drawnPlayer !== null && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-300">
            <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-black rounded-full">
              NEW PLAYER!
            </span>
            
            <div className="my-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 border-4 border-yellow-400 flex items-center justify-center shadow-lg">
                <UserPlus className="w-10 h-10 text-yellow-500" />
              </div>
              <h4 className="text-xl font-black text-slate-800 mt-4">{drawnPlayer.name}</h4>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {drawnPlayer.teamId.toUpperCase()} · {drawnPlayer.primaryPosition}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">등번호: {drawnPlayer.jerseyNumber}</p>
            </div>

            <button
              onClick={() => setDrawnPlayer(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-md transition-colors"
            >
              선수단에 추가
            </button>
          </div>
        </div>
      )}

    </AppShell>
  );
}
