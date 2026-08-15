import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreLineupPrediction, type LineupPick } from "@/lib/lineupPredict/scoring";
import { ensureAnonymousSession } from "@/lib/actions/ensureAnonymousSession";
import { isLocked, loadPredictableTeams } from "@/lib/server/lineupPredict/loadToday";
import {
  getMyLineupPrediction,
  getMyLineupStats,
  listMyScoredPredictions,
  upsertLineupPrediction,
  type LineupPredictionRow
} from "@/lib/supabase/query-parts/bpLineupPredictions";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** KST 오늘 날짜. 서버 타임존과 무관하게 계산한다. */
function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 채점된 예측에 타순별 판정을 붙인다.
 *
 * 상세는 DB 에 저장하지 않는다 — 실제 라인업이 bp_team_recent_lineups 에 남아 있어
 * 조회 시점에 다시 대조하면 같은 결과가 나온다. 저장하면 중복 데이터만 늘어난다.
 */
async function withScoreDetail(client: SupabaseClient, rows: LineupPredictionRow[]) {
  if (rows.length === 0) return [];

  const dates = Array.from(new Set(rows.map((r) => r.game_date)));
  const { data: actualRows } = await client
    .from("bp_team_recent_lineups")
    .select("game_date,team_id,batting")
    .in("game_date", dates);

  const actualByKey = new Map<string, LineupPick[]>();
  for (const a of actualRows ?? []) {
    const batting = (a.batting ?? []) as LineupPick[];
    if (batting.length >= 9) actualByKey.set(`${a.game_date}|${a.team_id}`, batting);
  }

  return rows.map((r) => {
    const actual = actualByKey.get(`${r.game_date}|${r.team_id}`);
    return {
      gameDate: r.game_date,
      teamId: r.team_id,
      hitCount: r.hit_count ?? 0,
      exactCount: r.exact_count ?? 0,
      // 지표 도입 전 채점분은 null — 화면에서 수비 항목을 감춘다.
      positionCount: r.position_count,
      // 실제 라인업이 지워졌다면 상세 없이 숫자만 보여준다.
      detail: actual ? scoreLineupPrediction(r.picks ?? [], actual).detail : null
    };
  });
}

/**
 * GET /api/play/lineup-predict?date=YYYY-MM-DD
 *   → 예측 가능한 팀 목록(직전 라인업 기본값 포함) + 내 예측 + 누적 성적.
 *   페이지는 정적으로 두고 유저별 데이터만 여기서 받는다.
 */
export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const supabase = createSupabaseServerClient();

  const load = async (dateISO: string) => {
    const result = await loadPredictableTeams(supabase, dateISO);
    if (!result.ok) return null;
    return result.teams.map((t) => ({ ...t, locked: isLocked(dateISO, t.gameTime) }));
  };

  let date = dateParam && DATE_RE.test(dateParam) ? dateParam : todayKST();
  let teams = await load(date);
  if (!teams) return NextResponse.json({ error: "경기 정보를 불러오지 못했습니다." }, { status: 500 });

  // 날짜를 지정하지 않았는데 오늘 경기가 전부 마감(또는 없음)이면 다음 날로 넘긴다.
  // 저녁 경기가 시작된 뒤 들어온 유저에게 빈 화면만 보여주지 않기 위해서다.
  if (!dateParam && teams.every((t) => t.locked)) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const nextDate = next.toISOString().slice(0, 10);
    const nextTeams = await load(nextDate);
    if (nextTeams && nextTeams.some((t) => !t.locked)) {
      date = nextDate;
      teams = nextTeams;
    }
  }

  // 비로그인(익명 세션 없음) 상태에서도 목록은 보여준다. 제출할 때 세션을 만든다.
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ date, teams, myPrediction: null, stats: null, recentResults: [] });
  }

  const [mine, stats, scored] = await Promise.all([
    getMyLineupPrediction(supabase, user.id, date),
    getMyLineupStats(supabase, user.id),
    listMyScoredPredictions(supabase, user.id, 5)
  ]);

  return NextResponse.json({
    date,
    teams,
    myPrediction: mine.ok ? mine.row : null,
    stats: stats.ok ? stats.stats : null,
    recentResults: scored.ok ? await withScoreDetail(supabase, scored.rows) : []
  });
}

/**
 * POST /api/play/lineup-predict
 *   body: { date, gameId, teamId, picks: [{order, name, rosterId}] × 9 }
 *   하루 1팀. 마감 전이면 몇 번이든 수정할 수 있다.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { date, gameId, teamId, picks } = (body ?? {}) as {
    date?: string;
    gameId?: string;
    teamId?: string;
    picks?: Array<{ order?: number; name?: string; rosterId?: string | null; position?: string | null }>;
  };

  if (!date || !DATE_RE.test(date) || !gameId || !teamId) {
    return NextResponse.json({ error: "필수 값이 빠졌습니다." }, { status: 400 });
  }
  if (!Array.isArray(picks) || picks.length !== 9) {
    return NextResponse.json({ error: "타순 9명을 모두 채워주세요." }, { status: 400 });
  }
  // 타순 1~9가 정확히 한 번씩 있어야 한다.
  const orders = picks.map((p) => p.order);
  if (new Set(orders).size !== 9 || orders.some((o) => typeof o !== "number" || o < 1 || o > 9)) {
    return NextResponse.json({ error: "타순이 올바르지 않습니다." }, { status: 400 });
  }
  if (picks.some((p) => !p.name)) {
    return NextResponse.json({ error: "선수를 모두 선택해주세요." }, { status: 400 });
  }
  // 같은 선수를 여러 자리에 넣지 못하게 막는다. 채점에서도 걸러지지만 입력 단계에서 알려주는 편이 낫다.
  const ids = picks.map((p) => p.rosterId ?? p.name);
  if (new Set(ids).size !== 9) {
    return NextResponse.json({ error: "같은 선수를 두 번 넣을 수 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // 마감 판정은 클라이언트 값을 믿지 않고 서버에서 경기 시각을 다시 읽어 확인한다.
  const teamsResult = await loadPredictableTeams(supabase, date);
  if (!teamsResult.ok) return NextResponse.json({ error: teamsResult.error }, { status: 500 });
  const target = teamsResult.teams.find((t) => t.gameId === gameId && t.teamId === teamId);
  if (!target) {
    return NextResponse.json({ error: "예측할 수 없는 경기입니다." }, { status: 400 });
  }
  if (isLocked(date, target.gameTime)) {
    return NextResponse.json({ error: "예측이 마감됐습니다." }, { status: 409 });
  }

  // 익명 계정 lazy 생성 — 제출 시점에만 세션을 만든다(라우트 핸들러라 쿠키 set 이 유효하다).
  const session = await ensureAnonymousSession();
  if (!session) {
    return NextResponse.json({ error: "로그인 처리에 실패했습니다." }, { status: 401 });
  }

  const saved = await upsertLineupPrediction(supabase, {
    userId: session.userId,
    gameId,
    gameDate: date,
    teamId,
    // position 은 채점에 쓰이지 않지만, 저장해 두어야 다시 열었을 때 수비 배치가 복원된다.
    picks: picks.map((p) => ({
      order: p.order as number,
      name: p.name as string,
      rosterId: p.rosterId ?? null,
      position: p.position ?? null
    }))
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  return NextResponse.json({ ok: true, prediction: saved.row });
}
