import { createSupabaseAdminClient } from "@/lib/supabase/server";

async function main() {
  console.log("Checking Supabase weekly_ai_reports cache...");
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("weekly_ai_reports")
      .select("week_id, created_at, rankings_json")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    console.log(`Found ${data?.length || 0} cached reports.`);
    data?.forEach(row => {
      console.log(`- Week: ${row.week_id}, CreatedAt: ${row.created_at}`);
      if (row.rankings_json && row.rankings_json.length > 0) {
        console.log(`  Sample Team (First): ${row.rankings_json[0].teamName}`);
        console.log(`  Overall Comment: ${row.rankings_json[0].overallComment}`);
        console.log(`  Series 1 Details: ${row.rankings_json[0].series1?.details}`);
      }
    });
  } catch (err) {
    console.error("Error reading cache:", err);
  }
}

main();
