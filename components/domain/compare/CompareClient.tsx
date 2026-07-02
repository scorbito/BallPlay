"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { teams, getTeam } from "@/lib/constants/teams";
import { computePowerIndex, type PowerBreakdown } from "@/lib/compare/powerIndex";
import { generateSeed, saveMatchSession } from "@/lib/sim/matchSession";
import type { CompareTeamData, CompareH2H } from "@/lib/compare/types";
import type { SimBatter, SimPitcher, SimTeamInput } from "@/lib/sim/types";
import "./compare.css";

type SideKey = "a" | "b";

// 소수 셋째 자리, 앞자리 0 제거 (.312 형태)
function fmt3(v: number): string {
  return v.toFixed(3).replace(/^0/, "");
}
function fmt2(v: number): string {
  return v.toFixed(2);
}
function ops(b: SimBatter): number {
  return b.obp + b.slg;
}

// ── 팀 컬러 대비 보정 (AiWinnerStatsTab 과 동일 규칙) ──
// 두 팀 색이 비슷하면 원정팀(우측)을 accent 또는 명/암 조정색으로 바꿔 구분한다.
type Rgb = [number, number, number];
function hexToRgb(hex: string): Rgb {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const int = parseInt(n, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function colorDist(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
function mix(c: Rgb, t: Rgb, amt: number): Rgb {
  return [c[0] + (t[0] - c[0]) * amt, c[1] + (t[1] - c[1]) * amt, c[2] + (t[2] - c[2]) * amt];
}
/** 홈 색과 원정 색이 너무 비슷하면 원정 색을 구분되는 색(accent→명/암)으로 치환. */
function ensureAwayFill(homeHex: string, awayHex: string, awayAccent?: string): string {
  const home = hexToRgb(homeHex);
  const away = hexToRgb(awayHex);
  if (colorDist(home, away) >= 110) return awayHex; // 충분히 다름
  if (awayAccent) {
    const acc = hexToRgb(awayAccent);
    if (colorDist(home, acc) >= 110) return awayAccent;
  }
  const lighter = mix(away, [255, 255, 255], 0.55);
  const darker = mix(away, [0, 0, 0], 0.5);
  const chosen = colorDist(home, lighter) >= colorDist(home, darker) ? lighter : darker;
  return rgbToHex(chosen[0], chosen[1], chosen[2]);
}

type SideState = {
  teamId: string;
  setTeamId: (id: string) => void;
  data: CompareTeamData | null;
  loading: boolean;
  starterId: string | null;
  setStarterId: (id: string) => void;
  lineupIds: string[];
  setLineupAt: (index: number, id: string) => void;
  battersById: Map<string, SimBatter>;
  pitchersById: Map<string, SimPitcher>;
  lineupBatters: SimBatter[];
  starter: SimPitcher | null;
  power: PowerBreakdown;
};

function useSide(initial: string, persistKey: string): SideState {
  const [teamId, setTeamIdRaw] = useState(initial);
  const [data, setData] = useState<CompareTeamData | null>(null);
  const [loading, setLoading] = useState(false);
  const [starterId, setStarterId] = useState<string | null>(null);
  const [lineupIds, setLineupIds] = useState<string[]>([]);

  // 이전에 보던 팀 복원 — 마운트 1회. 상태만 바꾸고 저장은 하지 않는다.
  // (복원 경로에서 저장하면 StrictMode 이중 실행 등으로 default가 복원값을 덮어쓸 수 있음)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(persistKey);
      if (saved && teams.some((t) => t.id === saved)) setTeamIdRaw(saved);
    } catch {
      /* localStorage 접근 불가 시 default 유지 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 사용자가 팀을 바꿀 때만 저장 — 복원/초기 default 로는 저장하지 않아 clobber 방지.
  const setTeamId = useCallback(
    (id: string) => {
      setTeamIdRaw(id);
      try {
        window.localStorage.setItem(persistKey, id);
      } catch {
        /* ignore */
      }
    },
    [persistKey]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/compare?team=${teamId}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setData(null);
          setLoading(false);
          return;
        }
        const d = res as CompareTeamData;
        setData(d);

        // 선발 초기값: 최근 선발 → 없으면 선발(SP) 첫 명 → 아무 투수
        const spFallback = d.rosterPitchers.find((p) => p.role !== "RP")?.playerId;
        setStarterId(d.recentStarter?.rosterId ?? spFallback ?? d.rosterPitchers[0]?.playerId ?? null);

        // 타순 초기값: 최근 라인업 → 부족분은 타석수 많은 순으로 보강, 9인.
        const batterIds = new Set(d.rosterBatters.map((b) => b.playerId));
        let ids = d.battingLineup.map((s) => s.rosterId).filter((id) => batterIds.has(id));
        if (ids.length < 9) {
          const used = new Set(ids);
          const extra = [...d.rosterBatters]
            .sort((x, y) => (y.pa || 0) - (x.pa || 0))
            .map((b) => b.playerId)
            .filter((id) => !used.has(id));
          ids = [...ids, ...extra].slice(0, 9);
        } else {
          ids = ids.slice(0, 9);
        }
        setLineupIds(ids);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const battersById = useMemo(
    () => new Map((data?.rosterBatters ?? []).map((b) => [b.playerId, b])),
    [data]
  );
  const pitchersById = useMemo(
    () => new Map((data?.rosterPitchers ?? []).map((p) => [p.playerId, p])),
    [data]
  );

  const lineupBatters = useMemo(
    () => lineupIds.map((id) => battersById.get(id)).filter((b): b is SimBatter => Boolean(b)),
    [lineupIds, battersById]
  );
  const starter = starterId ? pitchersById.get(starterId) ?? null : null;

  const power = useMemo(
    () =>
      computePowerIndex({
        batters: lineupBatters,
        starter,
        bullpen: (data?.rosterPitchers ?? []).filter((p) => p.playerId !== starterId),
        form: data?.standing?.form ?? [],
      }),
    [lineupBatters, starter, data, starterId]
  );

  const setLineupAt = (index: number, id: string) =>
    setLineupIds((prev) => prev.map((v, i) => (i === index ? id : v)));

  return {
    teamId,
    setTeamId,
    data,
    loading,
    starterId,
    setStarterId,
    lineupIds,
    setLineupAt,
    battersById,
    pitchersById,
    lineupBatters,
    starter,
    power,
  };
}

type PickerState = { side: SideKey; kind: "starter" | "batter"; index: number } | null;

export function CompareClient() {
  const router = useRouter();
  const a = useSide("lg", "ballplay:compare:teamA");
  const b = useSide("hanwha", "ballplay:compare:teamB");
  const [picker, setPicker] = useState<PickerState>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [h2h, setH2h] = useState<CompareH2H | null>(null);

  // 편집한 라인업으로 SimTeamInput 조립 — 타자 9명·선발이 갖춰져야 유효.
  const buildTeamInput = (side: SideState): SimTeamInput | null => {
    if (!side.data || !side.starter || side.lineupBatters.length !== 9) return null;
    // 계투(RP/CL)만 불펜으로 — 백업 선발(SP)이 릴리프로 나오지 않게. 엔진은 배열 순서대로 소진.
    const bullpen = side.data.rosterPitchers.filter(
      (p) => p.playerId !== side.starterId && p.role !== "SP"
    );
    return {
      teamId: side.teamId,
      displayName: getTeam(side.teamId).shortName,
      batters: side.lineupBatters,
      starter: side.starter,
      bullpen,
    };
  };

  const homeInput = buildTeamInput(a); // 좌(A) = 홈
  const awayInput = buildTeamInput(b); // 우(B) = 원정
  const matchReady = Boolean(awayInput && homeInput);

  // 편집 라인업으로 관전 매치 세션 저장 → 경기 진행 화면(/stadium/play)으로 이동.
  // 종료·뒤로가기 시 returnHref 로 다시 이 페이지로 복귀.
  const startMatch = () => {
    if (!awayInput || !homeInput) return;
    saveMatchSession({
      myTeamId: a.teamId,
      opponentTeamId: b.teamId,
      seed: generateSeed(),
      input: { home: homeInput, away: awayInput, context: {} },
      startedAt: new Date().toISOString(),
      source: "ai",
      returnHref: "/compare",
    });
    router.push("/stadium/play");
  };

  // 두 팀 시즌 맞대결 전적 — 팀 변경 시 재조회.
  useEffect(() => {
    let cancelled = false;
    setH2h(null);
    if (a.teamId === b.teamId) return;
    fetch(`/api/compare/h2h?a=${a.teamId}&b=${b.teamId}`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.ok) setH2h(res as CompareH2H);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [a.teamId, b.teamId]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // 좌(A)=홈은 팀 원색, 우(B)=원정은 색이 비슷하면 2번째 색(accent 등)으로 구분.
  const colorA = getTeam(a.teamId).color;
  const colorB = ensureAwayFill(colorA, getTeam(b.teamId).color, getTeam(b.teamId).accent);

  const totalA = a.power.total;
  const totalB = b.power.total;
  const sum = totalA + totalB || 1;
  const widthA = Math.round((totalA / sum) * 100);

  const subRows: Array<{ name: string; a: number; b: number }> = [
    { name: "타선", a: a.power.offense, b: b.power.offense },
    { name: "선발", a: a.power.starter, b: b.power.starter },
    { name: "불펜", a: a.power.bullpen, b: b.power.bullpen },
    { name: "최근폼", a: a.power.form, b: b.power.form },
  ];

  return (
    <div className="cmp-wrap">
      <h1 className="cmp-title">팀 전력비교</h1>
      <p className="cmp-sub">두 팀을 선택하고 선발·타선을 바꿔가며 전력지수를 비교해 보세요.</p>

      {/* 팀 선택 */}
      <div className="cmp-selectors">
        <TeamSelect value={a.teamId} exclude={b.teamId} onChange={a.setTeamId} />
        <span className="cmp-vs">VS</span>
        <TeamSelect value={b.teamId} exclude={a.teamId} onChange={b.setTeamId} />
      </div>

      {/* 전력지수 종합 */}
      <div className="cmp-power">
        <div className="cmp-power-head">
          <span className="cmp-power-num" style={{ color: colorA }}>
            {totalA}
          </span>
          <span className="cmp-power-label">전력지수</span>
          <span className="cmp-power-num" style={{ color: colorB }}>
            {totalB}
          </span>
        </div>
        <div className="cmp-power-bar">
          <span style={{ width: `${widthA}%`, background: colorA }} />
          <span style={{ width: `${100 - widthA}%`, background: colorB }} />
        </div>

        <div className="cmp-sub-scores">
          {subRows.map((row) => (
            <div className="cmp-sub-row" key={row.name}>
              <span className="cmp-sub-val a" style={{ color: colorA }}>
                {row.a}
              </span>
              <div className="cmp-minibar right">
                <span style={{ width: `${row.a}%`, background: colorA }} />
              </div>
              <span className="cmp-sub-name">{row.name}</span>
              <div className="cmp-minibar">
                <span style={{ width: `${row.b}%`, background: colorB }} />
              </div>
              <span className="cmp-sub-val" style={{ color: colorB }}>
                {row.b}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 상대 전적 (시즌 맞대결) */}
      {h2h && h2h.games > 0 ? (
        <div className="cmp-h2h">
          <div className="cmp-h2h-title">시즌 맞대결 상대 전적</div>
          <div className="cmp-h2h-body">
            <span className="cmp-h2h-win" style={{ color: colorA }}>
              {h2h.aWins}승
            </span>
            <span className="cmp-h2h-mid">
              {h2h.draws > 0 ? `${h2h.draws}무 · ` : ""}
              {h2h.games}경기
            </span>
            <span className="cmp-h2h-win" style={{ color: colorB }}>
              {h2h.bWins}승
            </span>
          </div>
          <div className="cmp-h2h-bar">
            <span
              style={{
                width: `${Math.round((h2h.aWins / (h2h.aWins + h2h.bWins || 1)) * 100)}%`,
                background: colorA,
              }}
            />
            <span
              style={{
                width: `${100 - Math.round((h2h.aWins / (h2h.aWins + h2h.bWins || 1)) * 100)}%`,
                background: colorB,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* 좌우 팀 카드 */}
      <div className="cmp-cards">
        <TeamCard side="a" state={a} color={colorA} expanded={expanded} toggle={toggle} openPicker={setPicker} />
        <TeamCard side="b" state={b} color={colorB} expanded={expanded} toggle={toggle} openPicker={setPicker} />
      </div>

      {/* 편집한 라인업으로 실제 경기 진행(관전) */}
      <button
        type="button"
        className="cmp-match-btn"
        onClick={startMatch}
        disabled={!matchReady}
        title="현재 편집한 양팀 라인업으로 경기를 진행합니다"
      >
        경기 시뮬레이션
      </button>
      <p className="cmp-match-note">
        {getTeam(a.teamId).shortName}(홈) vs {getTeam(b.teamId).shortName}(원정) · 편집한 라인업으로 경기가 진행됩니다
      </p>

      {/* 선수 교체 모달 */}
      {picker ? (
        <PlayerPicker
          picker={picker}
          state={picker.side === "a" ? a : b}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            const side = picker.side === "a" ? a : b;
            if (picker.kind === "starter") side.setStarterId(id);
            else side.setLineupAt(picker.index, id);
            setPicker(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TeamSelect({
  value,
  exclude,
  onChange,
}: {
  value: string;
  exclude: string;
  onChange: (id: string) => void;
}) {
  return (
    <select className="cmp-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {teams.map((t) => (
        <option key={t.id} value={t.id} disabled={t.id === exclude}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function TeamCard({
  side,
  state,
  color,
  expanded,
  toggle,
  openPicker,
}: {
  side: SideKey;
  state: SideState;
  color: string;
  expanded: Set<string>;
  toggle: (key: string) => void;
  openPicker: (p: PickerState) => void;
}) {
  const team = getTeam(state.teamId);
  const { data, loading, starter, lineupBatters, power } = state;

  const teamOps =
    lineupBatters.length > 0
      ? lineupBatters.reduce((s, x) => s + ops(x), 0) / lineupBatters.length
      : 0;

  return (
    <div className="cmp-card">
      <div className="cmp-card-head" style={{ background: color }}>
        {team.shortName}
      </div>
      <div className="cmp-card-body">
        {loading ? (
          <div className="cmp-loading">불러오는 중…</div>
        ) : !data ? (
          <div className="cmp-loading">데이터를 불러오지 못했습니다.</div>
        ) : (
          <>
            {/* 시즌 전적 */}
            <div className="cmp-section-title">시즌 전적</div>
            {data.standing ? (
              <>
                <div className="cmp-record">
                  <span className="rank">{data.standing.rank}위</span>
                  {data.standing.wins}승 {data.standing.losses}패 {data.standing.draws}무 ·{" "}
                  {data.standing.winRate}
                </div>
                {data.standing.form.length > 0 ? (
                  <div className="cmp-form">
                    {data.standing.form.map((r, i) => (
                      <i className={r} key={i}>
                        {r}
                      </i>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="cmp-record">순위 정보 없음</div>
            )}

            {/* 선발투수 */}
            <div className="cmp-section-title">선발투수 <span className="cmp-hint">이름 탭 → 상세 지표</span></div>
            {starter ? (
              <PitcherRow
                pitcher={starter}
                expanded={expanded.has(`${side}-sp-${starter.playerId}`)}
                onToggle={() => toggle(`${side}-sp-${starter.playerId}`)}
                onSwap={() => openPicker({ side, kind: "starter", index: 0 })}
              />
            ) : (
              <div className="cmp-record">선발 정보 없음</div>
            )}

            {/* 타선 */}
            <div className="cmp-section-title">타선 라인업</div>
            {lineupBatters.map((batter, i) => (
              <BatterRow
                key={`${batter.playerId}-${i}`}
                order={i + 1}
                batter={batter}
                expanded={expanded.has(`${side}-bat-${i}`)}
                onToggle={() => toggle(`${side}-bat-${i}`)}
                onSwap={() => openPicker({ side, kind: "batter", index: i })}
              />
            ))}
            <div className="cmp-teamstat">
              평균 OPS <b>{fmt3(teamOps)}</b> · 전력지수 <b>{power.total}</b>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PitcherRow({
  pitcher,
  expanded,
  onToggle,
  onSwap,
}: {
  pitcher: SimPitcher;
  expanded: boolean;
  onToggle: () => void;
  onSwap: () => void;
}) {
  return (
    <div className="cmp-player">
      <div className="cmp-player-main">
        <button type="button" className="cmp-pname" onClick={onToggle}>
          {pitcher.name}
          <span className="cmp-caret">{expanded ? "▴" : "▾"}</span>
        </button>
        <span className="cmp-keystat">{fmt2(pitcher.era)}</span>
        <button type="button" className="cmp-swap" onClick={onSwap}>
          교체
        </button>
      </div>
      {expanded ? (
        <div className="cmp-detail">
          <div>
            <span>ERA </span>
            <b>{fmt2(pitcher.era)}</b>
          </div>
          <div>
            <span>WHIP </span>
            <b>{fmt2(pitcher.whip)}</b>
          </div>
          <div>
            <span>이닝 </span>
            <b>{pitcher.ip.toFixed(1)}</b>
          </div>
          <div>
            <span>승-패 </span>
            <b>
              {pitcher.wins ?? 0}-{pitcher.losses ?? 0}
            </b>
          </div>
          <div>
            <span>세이브 </span>
            <b>{pitcher.saves}</b>
          </div>
          <div>
            <span>홀드 </span>
            <b>{pitcher.holds ?? 0}</b>
          </div>
          <div>
            <span>K/9 </span>
            <b>{fmt2(pitcher.k9)}</b>
          </div>
          <div>
            <span>BB/9 </span>
            <b>{fmt2(pitcher.bb9)}</b>
          </div>
          <div>
            <span>HR/9 </span>
            <b>{fmt2(pitcher.hr9)}</b>
          </div>
          <div>
            <span>탈삼진 </span>
            <b>{pitcher.k}</b>
          </div>
          <div>
            <span>볼넷 </span>
            <b>{pitcher.bb}</b>
          </div>
          <div>
            <span>피홈런 </span>
            <b>{pitcher.hr}</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BatterRow({
  order,
  batter,
  expanded,
  onToggle,
  onSwap,
}: {
  order: number;
  batter: SimBatter;
  expanded: boolean;
  onToggle: () => void;
  onSwap: () => void;
}) {
  return (
    <div className="cmp-player">
      <div className="cmp-player-main">
        <span className="cmp-order">{order}</span>
        <button type="button" className="cmp-pname" onClick={onToggle}>
          {batter.name}
          <span className="cmp-caret">{expanded ? "▴" : "▾"}</span>
        </button>
        <span className="cmp-keystat">{fmt3(ops(batter))}</span>
        <button type="button" className="cmp-swap" onClick={onSwap}>
          교체
        </button>
      </div>
      {expanded ? (
        <div className="cmp-detail">
          <div>
            <span>타율 </span>
            <b>{fmt3(batter.avg)}</b>
          </div>
          <div>
            <span>출루율 </span>
            <b>{fmt3(batter.obp)}</b>
          </div>
          <div>
            <span>장타율 </span>
            <b>{fmt3(batter.slg)}</b>
          </div>
          <div>
            <span>OPS </span>
            <b>{fmt3(ops(batter))}</b>
          </div>
          <div>
            <span>ISO </span>
            <b>{fmt3(batter.iso)}</b>
          </div>
          <div>
            <span>홈런 </span>
            <b>{batter.homers}</b>
          </div>
          <div>
            <span>안타 </span>
            <b>{batter.hits}</b>
          </div>
          <div>
            <span>2루타 </span>
            <b>{batter.doubles}</b>
          </div>
          <div>
            <span>타석 </span>
            <b>{batter.pa}</b>
          </div>
          <div>
            <span>볼넷 </span>
            <b>{batter.walks}</b>
          </div>
          <div>
            <span>삼진 </span>
            <b>{batter.strikeouts}</b>
          </div>
          <div>
            <span>BB% </span>
            <b>{Math.round(batter.bbRate * 100)}%</b>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerPicker({
  picker,
  state,
  onClose,
  onPick,
}: {
  picker: NonNullable<PickerState>;
  state: SideState;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const isPitcher = picker.kind === "starter";
  const currentId = isPitcher ? state.starterId : state.lineupIds[picker.index];

  // 타순 교체 시 이미 라인업에 있는 타자는 숨긴다(현재 슬롯 선수는 유지) — 중복 선택 방지.
  const inLineup = new Set(state.lineupIds);

  const rows = isPitcher
    ? // 선발(SP) 먼저, 불펜(RP/CL) 아래 — 그룹 내에서는 ERA 오름차순.
      [...(state.data?.rosterPitchers ?? [])].sort(
        (x, y) => (x.role === "SP" ? 0 : 1) - (y.role === "SP" ? 0 : 1) || x.era - y.era
      )
    : [...(state.data?.rosterBatters ?? [])]
        .filter((b) => b.playerId === currentId || !inLineup.has(b.playerId))
        .sort((x, y) => ops(y) - ops(x));

  return (
    <div className="cmp-modal-overlay" onClick={onClose}>
      <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmp-modal-head">
          <span>{isPitcher ? "선발투수 선택" : `${picker.index + 1}번 타자 선택`}</span>
          <button type="button" className="cmp-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="cmp-modal-list">
          {rows.map((p) => {
            const id = p.playerId;
            const stat = isPitcher
              ? `ERA ${fmt2((p as SimPitcher).era)} · WHIP ${fmt2((p as SimPitcher).whip)}`
              : `OPS ${fmt3(ops(p as SimBatter))} · ${(p as SimBatter).homers}홈런`;
            return (
              <button
                type="button"
                key={id}
                className={`cmp-pick ${id === currentId ? "active" : ""}`}
                onClick={() => onPick(id)}
              >
                <span className="cmp-pick-name">{p.name}</span>
                <span className="cmp-pick-stat">{stat}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
