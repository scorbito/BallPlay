import { createSupabaseAdminClient } from "../lib/supabase/server";

function formatBattingAverageToKorean(text: string): string {
  const regex = /\b0?\.\d{2,3}\b/g;
  return text.replace(regex, (match) => {
    const numStr = match.startsWith(".") ? "0" + match : match;
    const num = parseFloat(numStr);
    if (isNaN(num) || num < 0 || num >= 1) return match;
    
    const parts = numStr.split(".");
    const decimalPart = parts[1].padEnd(3, "0").substring(0, 3);
    const hal = parseInt(decimalPart[0], 10);
    const pun = parseInt(decimalPart[1], 10);
    const lee = parseInt(decimalPart[2], 10);
    
    if (hal === 0 && pun === 0 && lee === 0) return "0할";
    
    let result = "";
    if (hal > 0) result += `${hal}할 `;
    if (pun > 0) result += `${pun}푼 `;
    if (lee > 0) result += `${lee}리`;
    return result.trim();
  });
}

async function main() {
  const targetWeek = process.argv[2] || "2026-06-01";
  console.log(`Fetching weekly report for week: ${targetWeek}...`);
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("weekly_ai_reports")
      .select("rankings_json")
      .eq("week_id", targetWeek)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.rankings_json) {
      console.log(`No report found for week: ${targetWeek}`);
      return;
    }

    const rankings = data.rankings_json as any[];
    
    // 순위 오름차순 정렬
    rankings.sort((a, b) => a.weeklyRank - b.weeklyRank);

    const outputText = rankings.map(team => {
      const shortTeamName = team.teamName.split(" ")[0];
      const comment = formatBattingAverageToKorean(team.overallComment);
      return `${team.weeklyRank}위팀 ${shortTeamName}\n${comment}`;
    }).join("\n\n");

    console.log("=== TTS OUTPUT START ===");
    console.log(outputText);
    console.log("=== TTS OUTPUT END ===");
  } catch (err) {
    console.error("Error fetching report:", err);
  }
}

main();
