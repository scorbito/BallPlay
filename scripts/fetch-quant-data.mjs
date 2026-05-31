import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// 모든 투수 스냅샷 조회 (최대 3000개)
const { data: allPitchers, error: pErr } = await sb
  .from("bp_player_stats_snapshots")
  .select("player_id, team_id, snapshot_date, sim_payload")
  .eq("kind", "pitcher")
  .order("snapshot_date", { ascending: false })
  .limit(3000);

if (pErr) {
  console.error("Error fetching all pitchers:", pErr.message);
}

const starters = [
  { team: "lg", name: "톨허스트" },
  { team: "kia", name: "양현종" },
  { team: "samsung", name: "양창섭" },
  { team: "doosan", name: "최민석" },
  { team: "nc", name: "테일러" },
  { team: "lotte", name: "비슬리" },
  { team: "hanwha", name: "에르난데스" },
  { team: "ssg", name: "타케다" },
  { team: "kiwoom", name: "박준현" },
  { team: "kt", name: "보쉴리" }
];

const starterStats = [];
for (const s of starters) {
  // 메모리상에서 team_id와 sim_payload.name이 일치하는 가장 최신 snapshot 찾기
  const matchedList = allPitchers?.filter(r => 
    r.sim_payload?.name === s.name || 
    r.sim_payload?.name?.includes(s.name)
  ) ?? [];

  if (matchedList.length > 0) {
    // 가장 최신 snapshot_date인 것 선택
    const latest = matchedList[0]; // order가 snapshot_date desc 이므로 첫번째가 최신
    starterStats.push({
      team: s.team,
      reqTeam: s.team,
      foundTeam: latest.team_id,
      name: s.name,
      snapshot_date: latest.snapshot_date,
      stats: latest.sim_payload
    });
  } else {
    starterStats.push({
      team: s.team,
      name: s.name,
      stats: null,
      message: "No snapshot found in DB"
    });
  }
}

// 1) 팀 순위 조회 (2026시즌 위주)
const { data: standings, error: sErr } = await sb
  .from("team_standings")
  .select("*")
  .eq("season", 2026)
  .order("rank");

const result = {
  standings,
  starterStats
};

writeFileSync(resolve(process.cwd(), "scripts/quant-fetched-data.json"), JSON.stringify(result, null, 2), "utf8");
console.log("Successfully wrote quant data to scripts/quant-fetched-data.json");
