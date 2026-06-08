import { createSupabaseAdminClient } from "../lib/supabase/server";
import { getTeam } from "../lib/constants/teams";

function formatBattingAverageToKorean(text: string): string {
  if (!text) return "";
  // 소수점 앞에 숫자가 없는 0.xxx 또는 .xxx 형태만 매칭 (ERA 2.63 등이 26할 3푼이 되는 것을 방지)
  const regex = /(?<!\d)0?\.\d{2,3}\b/g;
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

// predicted_result 포맷팅
function formatPredictionResult(winnerTeamId: string, result: string, wins: number, losses: number): string {
  const teamName = getTeam(winnerTeamId).shortName;
  if (result === "sweep_win" || wins === 3) return `${teamName} 위닝 (스윕)`;
  if (result === "split") return "팽팽한 시리즈 (동률)";
  if (result === "losing") return `${teamName} 루징`;
  if (result === "sweep_loss") return `${teamName} 스윕패`;
  return `${teamName} 위닝`;
}

async function main() {
  const targetWeek = process.argv[2] || "2026-06-08";
  console.log(`Fetching AI predictions for week: ${targetWeek}...`);
  try {
    const supabase = createSupabaseAdminClient();
    
    // 1. 시리즈 목록 가져오기
    const { data: seriesRows, error: seriesError } = await supabase
      .from("bp_ai_weekly_series")
      .select("id, series_group, home_team_id, away_team_id, label, headline")
      .eq("week_start_date", targetWeek)
      .order("series_group", { ascending: true });

    if (seriesError) throw seriesError;
    if (!seriesRows || seriesRows.length === 0) {
      console.log(`No series found for week: ${targetWeek}`);
      return;
    }

    const seriesIds = seriesRows.map(s => s.id);

    // 2. 예측 정보 가져오기
    const { data: predictionRows, error: predictionError } = await supabase
      .from("bp_ai_weekly_series_predictions")
      .select("series_id, ai_provider, predicted_winner_team_id, predicted_result, predicted_wins, predicted_losses, key_factor, one_liner, detailed_analysis")
      .in("series_id", seriesIds)
      .order("ai_provider", { ascending: true });

    if (predictionError) throw predictionError;

    const predictionsBySeries = new Map<string, any[]>();
    predictionRows?.forEach(p => {
      const list = predictionsBySeries.get(p.series_id) || [];
      list.push(p);
      predictionsBySeries.set(p.series_id, list);
    });

    // 3. 시리즈 그룹별 분리 (주초: early, 주말: weekend)
    const earlySeries = seriesRows.filter(s => s.series_group === "early");
    const weekendSeries = seriesRows.filter(s => s.series_group === "weekend");

    const renderSeriesGroupText = (title: string, list: any[]) => {
      let groupText = `\n[${title}]\n`;
      if (list.length === 0) {
        groupText += "진행되는 시리즈가 없습니다.\n";
        return groupText;
      }

      list.forEach(s => {
        const homeName = getTeam(s.home_team_id).shortName;
        const awayName = getTeam(s.away_team_id).shortName;
        groupText += `${homeName} ${awayName} 시리즈\n`;

        const picks = predictionsBySeries.get(s.id) || [];
        const providerOrder = { gpt: 1, gemini: 2, claude: 3 };
        picks.sort((a, b) => {
          const orderA = providerOrder[a.ai_provider as keyof typeof providerOrder] || 99;
          const orderB = providerOrder[b.ai_provider as keyof typeof providerOrder] || 99;
          return orderA - orderB;
        });

        picks.forEach(p => {
          const providerUpper = p.ai_provider.toUpperCase();
          const resultText = formatPredictionResult(p.predicted_winner_team_id, p.predicted_result, p.predicted_wins, p.predicted_losses);
          // 간략설명으로 one_liner 혹은 key_factor 사용
          const explanation = p.one_liner || p.key_factor || "설명 없음";
          groupText += `${p.ai_provider} ${resultText}\n${formatBattingAverageToKorean(explanation)}\n\n`;
        });
      });

      return groupText;
    };

    console.log("=== AI PREDICTIONS OUTPUT START ===");
    let finalOutput = "";
    finalOutput += renderSeriesGroupText("주초 시리즈", earlySeries);
    finalOutput += renderSeriesGroupText("주말 시리즈", weekendSeries);
    console.log(finalOutput);
    console.log("=== AI PREDICTIONS OUTPUT END ===");

  } catch (err) {
    console.error("Error fetching predictions:", err);
  }
}

main();
