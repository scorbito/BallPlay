"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TeamBadge } from "@/components/common/TeamBadge";
import { getTeam } from "@/lib/constants/teams";
import type { AiProvider } from "@/lib/supabase/query-parts/bpAiPredictions";

type WeeklySeriesPick = {
  provider: AiProvider;
  teamId: string;
  result: string;
  note: string;
  oneLiner: string;
  detailedAnalysis: string;
};

type WeeklySeriesDetail = {
  id: string;
  label: string;
  range: string;
  homeTeamId: string;
  awayTeamId: string;
  headline: string;
  picks: WeeklySeriesPick[];
};

const AI_LABEL: Record<AiProvider, string> = {
  gemini: "Gemini",
  claude: "Claude",
  gpt: "GPT"
};

const AI_ORDER: AiProvider[] = ["gpt", "gemini", "claude"];
const AI_ORDER_RANK: Record<AiProvider, number> = { gpt: 0, gemini: 1, claude: 2 };

const WEEKLY_SERIES_DETAILS: WeeklySeriesDetail[] = [
  {
    id: "early-doosan-lotte",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "doosan",
    awayTeamId: "lotte",
    headline: "두산 선발진 우세, 롯데 타선 응집력이 변수",
    picks: [
      {
        provider: "gpt",
        teamId: "doosan",
        result: "두산 위닝",
        note: "선발 안정감",
        oneLiner: "두산은 선발 매치업에서 계산이 더 서는 시리즈입니다.",
        detailedAnalysis: "두산은 시리즈 초반 선발진이 흐름을 잡아줄 가능성이 높습니다. 롯데는 타선이 한 번 터지면 분위기를 바꿀 수 있지만, 경기 후반 운영에서 기복이 변수입니다. 전체적으로는 두산이 2승 1패에 가까운 흐름을 만들 가능성이 커 보입니다."
      },
      {
        provider: "gemini",
        teamId: "doosan",
        result: "두산 2승 1패",
        note: "불펜 우위",
        oneLiner: "불펜 안정감까지 보면 두산 쪽 기대값이 높습니다.",
        detailedAnalysis: "롯데가 초반 득점을 만들면 접전이 가능하지만, 후반으로 갈수록 두산 불펜 운영이 더 안정적으로 보입니다. 특히 1점 차 승부에서 두산이 지킬 수 있는 카드가 더 많습니다. 롯데는 장타보다 연속 출루가 살아나야 시리즈를 가져갈 수 있습니다."
      },
      {
        provider: "claude",
        teamId: "lotte",
        result: "롯데 위닝",
        note: "타선 반등",
        oneLiner: "롯데 타선이 살아나면 예측보다 훨씬 접전이 될 수 있습니다.",
        detailedAnalysis: "롯데는 타선 응집력이 살아나는 날에는 선발 열세를 충분히 뒤집을 수 있습니다. 두산이 안정적인 팀인 것은 맞지만, 롯데가 초반에 점수를 내고 분위기를 잡으면 시리즈 전체 판도가 흔들릴 수 있습니다. 변수는 롯데의 득점권 집중력입니다."
      }
    ]
  },
  {
    id: "early-lg-hanwha",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "lg",
    awayTeamId: "hanwha",
    headline: "LG의 출루 흐름과 한화 장타력이 맞붙는 시리즈",
    picks: [
      { provider: "gpt", teamId: "lg", result: "LG 위닝", note: "상위타선 우세", oneLiner: "LG는 출루와 주루 압박으로 시리즈 주도권을 잡을 수 있습니다.", detailedAnalysis: "LG는 한 번에 크게 치는 팀이라기보다 계속 주자를 쌓고 압박하는 흐름이 강점입니다. 한화의 장타력은 분명 변수지만, LG가 초반부터 투구 수를 늘리고 불펜을 끌어내면 위닝 가능성이 높습니다." },
      { provider: "gemini", teamId: "hanwha", result: "한화 2승 1패", note: "장타 변수", oneLiner: "한화는 장타 한 방으로 경기 흐름을 바꿀 수 있는 팀입니다.", detailedAnalysis: "LG가 안정적인 운영을 가져가더라도 한화는 장타로 단숨에 점수 차를 뒤집을 수 있습니다. 시리즈 중 한 경기 이상은 한화 타선이 크게 터질 가능성이 있습니다. 선발이 5이닝 이상 버텨주면 한화 위닝도 충분합니다." },
      { provider: "claude", teamId: "lg", result: "LG 2승 1패", note: "수비 안정", oneLiner: "수비와 작전 수행까지 포함하면 LG가 조금 더 안정적입니다.", detailedAnalysis: "한화의 장타 변수는 크지만, 시리즈 전체를 보면 LG의 수비 안정감과 상황별 공격이 더 예측 가능합니다. 특히 접전에서 실책을 줄이고 한 점을 만드는 능력은 LG가 앞서 보입니다." }
    ]
  },
  {
    id: "early-kia-samsung",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "kia",
    awayTeamId: "samsung",
    headline: "KIA 중심타선이 앞서지만 삼성 후반 집중력도 강점",
    picks: [
      { provider: "gpt", teamId: "kia", result: "KIA 위닝", note: "득점권 강세", oneLiner: "KIA는 중심타선의 득점 기대값이 가장 큰 무기입니다.", detailedAnalysis: "KIA는 주자가 쌓였을 때 해결할 수 있는 타자 구성이 좋습니다. 삼성도 후반 집중력은 강하지만, 초중반에 KIA가 리드를 잡으면 따라가는 흐름이 쉽지 않을 수 있습니다." },
      { provider: "gemini", teamId: "kia", result: "KIA 2승 1패", note: "타선 깊이", oneLiner: "타선 깊이에서 KIA가 시리즈 평균 득점을 더 만들 가능성이 큽니다.", detailedAnalysis: "KIA는 하위 타순까지 출루와 장타 기대값을 고르게 가져갈 수 있습니다. 삼성은 불펜 싸움으로 끌고 가면 기회가 있지만, 전체 화력에서는 KIA가 조금 앞섭니다." },
      { provider: "claude", teamId: "samsung", result: "삼성 위닝", note: "후반 승부", oneLiner: "삼성은 후반 접전으로 끌고 가면 시리즈를 가져갈 수 있습니다.", detailedAnalysis: "KIA가 공격 기대값은 높지만 삼성은 후반 집중력과 벤치 운영에서 장점이 있습니다. 초반 대량 실점만 피하면 삼성도 2승 1패 흐름을 만들 수 있습니다." }
    ]
  },
  {
    id: "early-ssg-nc",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "ssg",
    awayTeamId: "nc",
    headline: "장타 싸움으로 흐르면 SSG, 접전이면 NC가 유리",
    picks: [
      { provider: "gpt", teamId: "ssg", result: "SSG 2승 1패", note: "홈런 기대", oneLiner: "SSG는 장타 한 방으로 시리즈 흐름을 빠르게 가져올 수 있습니다.", detailedAnalysis: "SSG는 득점 루트가 단순해 보여도 홈런으로 경기 양상을 바꾸는 힘이 있습니다. NC가 세밀한 운영으로 접전을 만들 수 있지만, SSG가 초반 장타를 터뜨리면 주도권을 잡을 가능성이 높습니다." },
      { provider: "gemini", teamId: "nc", result: "NC 위닝", note: "접전 운영", oneLiner: "NC는 접전 운영에서 더 안정적인 선택지가 있습니다.", detailedAnalysis: "SSG 장타는 부담스럽지만 NC는 경기 후반 운영과 불펜 분배에서 안정적인 편입니다. 대량 득점전보다 1-2점 차 승부가 많아지면 NC 쪽으로 기울 수 있습니다." },
      { provider: "claude", teamId: "ssg", result: "SSG 위닝", note: "초반 득점", oneLiner: "SSG가 초반에 점수를 내면 NC의 운영 장점이 줄어듭니다.", detailedAnalysis: "NC가 원하는 흐름은 접전이지만, SSG가 1-3회에 리드를 잡으면 이야기가 달라집니다. 초반 득점과 장타 생산 여부가 시리즈 전체의 핵심입니다." }
    ]
  },
  {
    id: "early-kt-kiwoom",
    label: "주중 3연전",
    range: "6.9 - 6.11",
    homeTeamId: "kt",
    awayTeamId: "kiwoom",
    headline: "KT 마운드 운영과 키움 젊은 타선의 흐름 대결",
    picks: [
      { provider: "gpt", teamId: "kt", result: "KT 위닝", note: "마운드 우위", oneLiner: "KT는 마운드 계산이 더 서는 시리즈입니다.", detailedAnalysis: "KT는 선발과 불펜 운영에서 예측 가능한 구간이 많습니다. 키움은 젊은 타선의 폭발력이 있지만, 시리즈 내내 꾸준한 득점으로 이어질지는 변수입니다." },
      { provider: "gemini", teamId: "kiwoom", result: "키움 2승 1패", note: "타선 활력", oneLiner: "키움은 타선 리듬이 살아나면 업셋이 가능한 매치업입니다.", detailedAnalysis: "KT가 안정적인 팀이지만 키움은 예측을 흔드는 공격 리듬이 있습니다. 초반 출루가 많아지면 KT 마운드를 흔들 수 있고, 한 경기 이상은 키움 페이스로 갈 수 있습니다." },
      { provider: "claude", teamId: "kt", result: "KT 2승 1패", note: "불펜 안정", oneLiner: "후반까지 보면 KT의 불펜 안정감이 시리즈를 결정할 수 있습니다.", detailedAnalysis: "키움의 활력은 무시하기 어렵지만 후반 리드를 지키는 힘은 KT 쪽이 낫습니다. 접전이 반복되면 KT가 2승 1패로 앞설 가능성이 큽니다." }
    ]
  },
  {
    id: "weekend-doosan-kia",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "doosan",
    awayTeamId: "kia",
    headline: "상위권 분위기를 가를 수 있는 주말 핵심 시리즈",
    picks: [
      { provider: "gpt", teamId: "kia", result: "KIA 위닝", note: "공격 기대값", oneLiner: "KIA의 공격 기대값이 주말 시리즈에서 더 높게 잡힙니다.", detailedAnalysis: "두산의 선발 안정감은 강점이지만 KIA는 중심타선과 하위 연결력이 모두 위협적입니다. 경기당 득점 기대값을 보면 KIA가 근소하게 앞섭니다." },
      { provider: "gemini", teamId: "doosan", result: "두산 2승 1패", note: "선발 매치업", oneLiner: "두산은 선발 매치업으로 시리즈 균형을 가져올 수 있습니다.", detailedAnalysis: "KIA 타선이 강하지만 두산은 선발이 초반 흐름을 막아낼 수 있는 팀입니다. 타격전이 아니라 투수전으로 끌고 가면 두산 위닝 가능성이 있습니다." },
      { provider: "claude", teamId: "kia", result: "KIA 2승 1패", note: "중심타선", oneLiner: "승부처 해결 능력은 KIA 쪽에 조금 더 무게가 실립니다.", detailedAnalysis: "상위권 맞대결답게 큰 차이는 없지만, 득점권에서 해결할 수 있는 타자 구성은 KIA가 더 좋아 보입니다. 한 경기 정도는 접전으로 내줄 수 있어도 시리즈는 KIA 쪽입니다." }
    ]
  },
  {
    id: "weekend-lotte-lg",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "lotte",
    awayTeamId: "lg",
    headline: "롯데의 홈 분위기와 LG의 출루 야구가 맞붙는 시리즈",
    picks: [
      { provider: "gpt", teamId: "lg", result: "LG 위닝", note: "출루율 우세", oneLiner: "LG는 출루 기반 공격으로 안정적인 시리즈를 만들 수 있습니다.", detailedAnalysis: "롯데 홈 분위기는 변수지만 LG는 출루율과 주루 압박으로 꾸준히 찬스를 만들 수 있습니다. 시리즈 전체 안정감은 LG가 앞섭니다." },
      { provider: "gemini", teamId: "lotte", result: "롯데 위닝", note: "홈 강세", oneLiner: "롯데는 홈에서 흐름을 타면 예측보다 강하게 밀어붙일 수 있습니다.", detailedAnalysis: "LG가 전력상 안정적이지만 롯데는 홈에서 타선 분위기가 살아나는 경우가 많습니다. 초반 득점과 관중 분위기가 맞물리면 롯데가 시리즈를 가져갈 수 있습니다." },
      { provider: "claude", teamId: "lg", result: "LG 2승 1패", note: "작전 수행", oneLiner: "LG의 작전 수행 능력이 접전에서 차이를 만들 수 있습니다.", detailedAnalysis: "롯데의 폭발력은 경계해야 하지만, 접전에서 한 점을 만드는 능력은 LG가 더 예측 가능합니다. 도루, 희생번트, 진루타 같은 작은 플레이가 시리즈를 좌우할 수 있습니다." }
    ]
  },
  {
    id: "weekend-hanwha-ssg",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "hanwha",
    awayTeamId: "ssg",
    headline: "한화의 장타와 SSG의 한 방이 정면으로 붙는 매치업",
    picks: [
      { provider: "gpt", teamId: "ssg", result: "SSG 위닝", note: "장타 생산", oneLiner: "SSG는 장타 생산력에서 시리즈 우위를 만들 수 있습니다.", detailedAnalysis: "한화도 장타력이 있지만 SSG는 한 방으로 경기 흐름을 바꾸는 타자 구성이 좋습니다. 선발이 최소 실점으로 버티면 SSG의 위닝 가능성이 높습니다." },
      { provider: "gemini", teamId: "hanwha", result: "한화 2승 1패", note: "선발 호투", oneLiner: "한화 선발이 버텨주면 시리즈는 한화 쪽으로 기울 수 있습니다.", detailedAnalysis: "SSG의 장타를 막는 핵심은 선발의 초반 제구입니다. 한화가 5회까지 리드를 잡는 경기를 만들면 불펜 운영도 훨씬 편해지고 위닝 가능성이 열립니다." },
      { provider: "claude", teamId: "ssg", result: "SSG 2승 1패", note: "득점 루트", oneLiner: "득점 루트 다양성은 SSG가 조금 더 낫습니다.", detailedAnalysis: "한화의 장타도 위협적이지만 SSG는 중심타선뿐 아니라 하위 타순에서도 득점 루트를 만들 수 있습니다. 전체 시리즈 기대값은 SSG 쪽입니다." }
    ]
  },
  {
    id: "weekend-samsung-kt",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "samsung",
    awayTeamId: "kt",
    headline: "삼성의 후반 응집력과 KT의 마운드 계산이 관건",
    picks: [
      { provider: "gpt", teamId: "kt", result: "KT 2승 1패", note: "선발 안정", oneLiner: "KT는 선발 안정감으로 시리즈 기본 흐름을 잡을 수 있습니다.", detailedAnalysis: "삼성은 후반 집중력이 있지만 KT 선발진이 초반 실점을 줄이면 경기 흐름을 편하게 가져갈 수 있습니다. 전체적으로 KT 2승 1패가 가장 현실적인 예측입니다." },
      { provider: "gemini", teamId: "samsung", result: "삼성 위닝", note: "후반 집중", oneLiner: "삼성은 후반 접전에서 강하게 치고 올라올 수 있습니다.", detailedAnalysis: "KT가 안정적이지만 삼성은 후반에 한 번 흐름을 잡으면 몰아치는 힘이 있습니다. 시리즈 중 불펜 싸움이 반복되면 삼성에게 기회가 생깁니다." },
      { provider: "claude", teamId: "kt", result: "KT 위닝", note: "불펜 우세", oneLiner: "불펜 계산까지 포함하면 KT가 더 안정적입니다.", detailedAnalysis: "삼성의 집중력은 변수지만 KT는 리드를 잡았을 때 지키는 카드가 더 명확합니다. 큰 점수 차보다 접전에서 KT 우세가 예상됩니다." }
    ]
  },
  {
    id: "weekend-nc-kiwoom",
    label: "주말 3연전",
    range: "6.12 - 6.14",
    homeTeamId: "nc",
    awayTeamId: "kiwoom",
    headline: "NC의 경기 운영이 앞서지만 키움의 업셋 가능성도 있는 시리즈",
    picks: [
      { provider: "gpt", teamId: "nc", result: "NC 위닝", note: "운영 우세", oneLiner: "NC는 시리즈 운영 능력에서 키움보다 안정적입니다.", detailedAnalysis: "키움의 젊은 타선은 변수가 있지만 NC는 경기 운영과 불펜 분배가 더 안정적입니다. 시리즈 전체로 보면 NC 위닝 가능성이 높습니다." },
      { provider: "gemini", teamId: "nc", result: "NC 2승 1패", note: "투타 균형", oneLiner: "투타 균형을 기준으로 보면 NC가 근소하게 앞섭니다.", detailedAnalysis: "NC는 특정 한 부분에만 의존하지 않고 선발, 불펜, 타선이 비교적 균형 잡혀 있습니다. 키움이 한 경기를 가져갈 수는 있어도 시리즈는 NC 쪽입니다." },
      { provider: "claude", teamId: "kiwoom", result: "키움 위닝", note: "젊은 타선", oneLiner: "키움의 젊은 타선이 흐름을 타면 업셋도 가능합니다.", detailedAnalysis: "NC가 안정적인 팀인 것은 맞지만 키움은 예측하기 어려운 공격 리듬을 만들 수 있습니다. 초반부터 출루가 이어지고 장타가 섞이면 키움 위닝도 충분히 가능한 그림입니다." }
    ]
  }
];

function getSeries(id: string): WeeklySeriesDetail | null {
  return WEEKLY_SERIES_DETAILS.find((series) => series.id === id) ?? null;
}

export function AiWeeklySeriesRevealScreen({ seriesId }: { seriesId: string }) {
  const series = getSeries(seriesId);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const orderedPicks = useMemo(() => {
    if (!series) return [];
    return [...series.picks].sort((a, b) => AI_ORDER_RANK[a.provider] - AI_ORDER_RANK[b.provider]);
  }, [series]);

  if (!series) {
    return (
      <AppShell activeTab="home" title="시리즈 예측" theme="light" backHref="/predict/ai-winner?date=2026-06-08">
        <section className="ai-weekly-detail-screen">
          <div className="ai-reveal-empty">
            <p>시리즈 예측을 찾을 수 없어요.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  const home = getTeam(series.homeTeamId);
  const away = getTeam(series.awayTeamId);
  const voteMap = new Map<string, number>();
  for (const pick of orderedPicks) {
    voteMap.set(pick.teamId, (voteMap.get(pick.teamId) ?? 0) + 1);
  }
  const majorityTeamId = Array.from(voteMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <AppShell activeTab="home" title="시리즈 예측" theme="light" backHref="/predict/ai-winner?date=2026-06-08">
      <section className="ai-weekly-detail-screen">
        <header className="ai-weekly-detail-hero">
          <div className="ai-weekly-detail-meta">
            <span>{series.label}</span>
            <span>{series.range}</span>
          </div>
          <div className="ai-weekly-detail-matchup">
            <div className="ai-weekly-detail-team">
              <TeamBadge teamId={series.homeTeamId} size="md" />
              <strong>{home.shortName}</strong>
            </div>
            <span>VS</span>
            <div className="ai-weekly-detail-team">
              <strong>{away.shortName}</strong>
              <TeamBadge teamId={series.awayTeamId} size="md" />
            </div>
          </div>
          <p>{series.headline}</p>
          {majorityTeamId ? (
            <div className="ai-weekly-detail-summary">
              <Trophy size={13} strokeWidth={2.5} />
              AI 종합: {getTeam(majorityTeamId).shortName} 우세
            </div>
          ) : null}
        </header>

        <ul className="ai-weekly-detail-cards">
          {orderedPicks.map((pick, idx) => {
            const expanded = expandedIdx === idx;
            return (
              <li key={pick.provider} className={`ai-weekly-detail-card ai-weekly-detail-card-${pick.provider}`}>
                <header className="ai-weekly-detail-card-head">
                  <span>{AI_LABEL[pick.provider]}</span>
                  <strong>{pick.result}</strong>
                </header>
                <div className="ai-weekly-detail-pick">
                  <TeamBadge teamId={pick.teamId} size="sm" />
                  <span className="ai-weekly-detail-pick-team">{getTeam(pick.teamId).shortName}</span>
                  <em>{pick.note}</em>
                </div>
                <p className="ai-weekly-detail-oneliner">{pick.oneLiner}</p>
                <button
                  type="button"
                  className="ai-reveal-card-toggle"
                  onClick={() => setExpandedIdx(expanded ? null : idx)}
                  aria-expanded={expanded}
                >
                  {expanded ? "상세 닫기" : "상세 설명"}
                  {expanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
                </button>
                {expanded ? <p className="ai-weekly-detail-analysis">{pick.detailedAnalysis}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
    </AppShell>
  );
}
