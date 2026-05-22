# 시뮬레이션 엔진 스펙 (v1)

> 작성일: 2026-05-22
> 상태: v1 paper design
> 상위 문서: `docs/product-spec.md` §7

이 문서는 BallPlay 라인업 대결의 핵심인 **9이닝 야구 시뮬레이션 엔진**의 알고리즘·인터페이스·정책을 정의한다. v1엔 LLM 사용 없음. 결과는 100% 코드 로직과 시드 기반 RNG로 결정된다.

---

## 1. 설계 원칙

1. **결정론적** — 같은 입력 + 같은 시드 → 같은 결과. 디버깅·재현·캐싱의 기반.
2. **순수 함수** — `simulateGame(input, seed)` 외부 IO·전역 상태 X. 단위 테스트 용이.
3. **의존성 최소** — `seedrandom` 외 vanilla TS. KBO 평균값은 상수로 inline.
4. **확장 점 명확** — 좌우 상성·구장 보정·도루·번트 등은 인터페이스 자리만 두고 v1엔 단순 가중치만.
5. **재미 ≧ 정확성** — 60:40 우열에서 ±2~3점 변동을 목표. 베타 트래픽으로 튜닝.

---

## 2. 인터페이스 (top-level)

```ts
function simulateGame(input: SimGameInput, seed: number): SimGameResult;
```

### 2.1 입력 — `SimGameInput`

```ts
type SimGameInput = {
  home: SimTeamInput;   // 홈팀 (말 공격)
  away: SimTeamInput;   // 원정팀 (초 공격)
  context: GameContext; // 구장·날씨 등
};

type SimTeamInput = {
  teamId: TeamId;
  batters: SimBatter[];     // 정확히 9명, 타순 1~9 순서
  starter: SimPitcher;      // 선발 1명
  bullpen: SimPitcher[];    // 불펜 0~8명 (없어도 동작 — 선발이 9이닝 끝까지 던짐)
};

type GameContext = {
  parkId?: string;       // v1엔 사용 X, 자리만
  weather?: 'clear' | 'rain' | 'wind';  // v1엔 사용 X, 자리만
};
```

### 2.2 출력 — `SimGameResult`

```ts
type SimGameResult = {
  seed: number;                  // 입력 시드 그대로 보존
  finalScore: { home: number; away: number };
  innings: InningLog[];          // 길이 9 (연장 시 ≥9)
  events: GameEvent[];           // 결정적 순간(홈런·역전타·만루) 하이라이트
  mvp: { playerId: string; reason: string };
  boxScore: {
    batting: Record<string, BatterBoxLine>;  // playerId → 타석별 누적
    pitching: Record<string, PitcherBoxLine>;
  };
};

type InningLog = {
  inning: number;            // 1..9 (연장 10+)
  top: HalfInningLog;        // 원정팀 공격
  bottom: HalfInningLog;     // 홈팀 공격 (9회말 끝내기 시 단축 가능)
};

type HalfInningLog = {
  runs: number;
  hits: number;
  atBats: AtBatLog[];        // 이 하프이닝에서 발생한 모든 타석
};

type AtBatLog = {
  batterId: string;
  pitcherId: string;
  outcome: AtBatOutcome;
  baseStateBefore: BaseState;    // 0: 비어있음, 1/2/3: 주자
  baseStateAfter: BaseState;
  outsBefore: 0 | 1 | 2;
  outsAfter: 0 | 1 | 2 | 3;
  runsScored: number;            // 이 타석으로 들어온 점수
  rbi: number;                   // 타점
};

type BaseState = {
  first: string | null;   // playerId
  second: string | null;
  third: string | null;
};
```

---

## 3. 이벤트 enum — `AtBatOutcome`

v1에서 시뮬 엔진이 출력할 수 있는 타석 결과의 완전 목록. 각 결과는 베이스 상태 전이 룰이 명확히 정의돼야 한다 (§5 참조).

```ts
enum AtBatOutcome {
  // 아웃 계열
  STRIKEOUT = 'K',        // 삼진
  GROUNDOUT = 'GO',       // 땅볼아웃 (이중타 가능성은 §5에서 분기)
  FLYOUT = 'FO',          // 외야 플라이아웃
  POPOUT = 'PO',          // 내야 플라이아웃
  LINEOUT = 'LO',         // 직선타 아웃
  SAC_FLY = 'SF',         // 희생플라이 (외야 깊은 플라이 + 3루 주자 득점)
  DOUBLE_PLAY = 'DP',     // 병살타 (GO 중 일부가 발전된 결과)

  // 출루 계열
  WALK = 'BB',            // 볼넷
  HBP = 'HBP',            // 사구
  SINGLE = '1B',          // 1루타
  DOUBLE = '2B',          // 2루타
  TRIPLE = '3B',          // 3루타
  HOME_RUN = 'HR',        // 홈런

  // 보조
  ERROR = 'E',            // 실책 출루 (v1.1+, v1엔 사용 X)
}
```

**v1 핵심 셋**: K, GO, FO, BB, HBP, 1B, 2B, 3B, HR, DP, SF (총 11개)
**v1.1+ 확장**: POPOUT/LINEOUT 분리, ERROR, 도루 시도, 번트, 볼넷 후 폭투 등

---

## 4. 확률 모델

### 4.1 KBO 리그 평균 앵커 (anchor)

타석당 결과 확률 — KBO 2024~2025 시즌 평균을 기준으로 단순화. 베타에서 튜닝.

```ts
const KBO_ANCHOR: Record<AtBatOutcome, number> = {
  K:    0.220,   // 22.0%
  GO:   0.240,   // 24.0% (이 중 일부가 DP로 발전)
  FO:   0.130,
  PO:   0.050,
  LO:   0.030,
  SF:   0.010,
  DP:   0.020,   // GO 중 주자 1루 있을 때 일부가 DP로 승급 (§5.2)
  BB:   0.090,
  HBP:  0.010,
  '1B': 0.130,
  '2B': 0.040,
  '3B': 0.003,
  HR:   0.027,
  E:    0.000,   // v1엔 0
} as const;
// 합계 = 1.000
```

### 4.2 선수별 조정 (multiplicative adjust)

타자 stats와 투수 stats를 사용해 앵커를 **비율로 곱해 조정**한 뒤 정규화.

```
adjusted[outcome] = anchor[outcome]
                  * batterFactor[outcome]
                  * pitcherFactor[outcome]
                  * contextFactor[outcome]
```

마지막에 합이 1이 되도록 정규화(분포 normalize).

#### 타자 factor (v1)

| outcome | batter factor 산출 |
|---|---|
| K   | `1 / (batter.contactScore)` — contactScore가 클수록 삼진 감소 |
| BB  | `batter.bbRate / LEAGUE_BB_RATE` |
| HR  | `batter.iso / LEAGUE_ISO` |
| 1B, 2B, 3B | `batter.babip / LEAGUE_BABIP` (안타류 일괄 조정) |
| GO, FO, PO, LO, SF, DP | 잔여 분포로 결정 (정규화에서 자동 흡수) |

`contactScore`, `iso`, `babip`, `bbRate`는 §6의 `BatterStats`에서 파생되는 정규화 지표.

#### 투수 factor (v1)

| outcome | pitcher factor |
|---|---|
| K   | `pitcher.k9 / LEAGUE_K9` |
| BB  | `pitcher.bb9 / LEAGUE_BB9` |
| HR  | `pitcher.hr9 / LEAGUE_HR9` |
| 안타류 | `(pitcher.whip - pitcher.bb9/9) / LEAGUE_HIT_RATE` 근사 |
| 외야아웃류 | 잔여 분포 |

#### context factor

v1엔 모두 1.0. 자리만 둠.

### 4.3 변동성 통제

- 강팀 vs 약팀 시뮬 100회 시 강팀 승률 **65~70%** 목표.
- 평균 득점은 양 팀 합산 **8~12점** 범위.
- 한 경기에서 9점 이상 격차는 5% 이하.
- 베타 트래픽에서 위 지표 모니터링 후 anchor·factor 튜닝.

---

## 5. 상태 전이 룰 (베이스러닝)

타석 결과 → 베이스 상태 변화는 코드에서 명확히 분기한다. v1엔 단순화 모델 사용 (실전의 모든 작전·송구 디테일은 v1.1+).

### 5.1 일반 안타류

| outcome | 1루 주자 | 2루 주자 | 3루 주자 | 타자 |
|---|---|---|---|---|
| 1B  | → 2루 | → 3루 (50%) / 득점 (50%) | 득점 | 1루 |
| 2B  | → 3루 (60%) / 득점 (40%) | 득점 | 득점 | 2루 |
| 3B  | 득점 | 득점 | 득점 | 3루 |
| HR  | 득점 | 득점 | 득점 | 득점 |
| BB / HBP | 1루(밀어내기 시 득점) | 2루(밀어내기 시) | 3루(밀어내기 시) | 1루 |

확률 분기는 시드 RNG로 결정.

### 5.2 아웃 계열

| outcome | 처리 |
|---|---|
| K   | 타자만 아웃. 주자 유지. |
| FO/PO/LO | 타자 아웃. 주자 유지 (희생플라이 조건 아닌 한). |
| GO  | 1루 주자 있고 아웃 < 2 → 30% 확률로 DP 승급. 아니면 타자 아웃 + 1루 주자 → 2루 강제진루(아웃 위험 50%). |
| DP  | 타자 + 1루 주자 둘 다 아웃. 다른 주자 유지. |
| SF  | 타자 아웃. 3루 주자 득점. (3루 주자 없으면 SF 대신 FO로 강등) |

### 5.3 이닝 종료

`outs === 3` 즉시 종료. 잔루는 다음 이닝으로 이어지지 않음(이닝마다 리셋).

### 5.4 9회 끝내기 (walk-off)

홈팀이 9회말 시작 시 이미 리드 중이면 9회말 미실시.
9회말 도중 홈팀 득점이 원정팀 합산을 넘는 순간 즉시 종료.

### 5.5 연장

9회 종료 시 동점 → 10회 연장. **KBO 정규시즌은 11회까지** 진행하고 이후 동점이면 무승부 처리.

---

## 6. 선수 데이터 모델

엔진 입력에 필요한 **선수당 필드**. Statiz 시드 스크립트(§8)가 이 모양을 채워야 한다.

### 6.1 `SimBatter`

```ts
type SimBatter = {
  playerId: string;
  name: string;
  battingHand: 'L' | 'R' | 'S';

  // 누적 (Statiz 시즌 통계)
  pa: number;          // 타석
  ab: number;          // 타수
  hits: number;
  doubles: number;
  triples: number;
  homers: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  sb: number;          // v1.1+ (도루)

  // 파생 지표 (엔진이 내부에서 계산해도 되지만 미리 계산해두면 빠름)
  avg: number;         // hits/ab
  obp: number;
  slg: number;
  iso: number;         // slg - avg
  babip: number;       // (hits-HR) / (ab-K-HR+SF)
  bbRate: number;      // walks/pa
  kRate: number;       // strikeouts/pa
  contactScore: number;// 1 - kRate (단순 근사)

  // 세이버 (가산점, v1.1+ 활용)
  wrcPlus?: number;
};
```

### 6.2 `SimPitcher`

```ts
type SimPitcher = {
  playerId: string;
  name: string;
  throwingHand: 'L' | 'R';
  role: 'SP' | 'RP' | 'CL';  // 선발/불펜/마무리

  // 누적
  ip: number;          // 이닝
  k: number;
  bb: number;
  hr: number;
  hitsAllowed: number;
  earnedRuns: number;
  saves: number;       // 세이브 — 마무리 자동 식별에 사용 (§12.3)
  holds?: number;      // 홀드 (셋업맨 식별, v1.1+)

  // 파생
  era: number;
  whip: number;
  k9: number;          // k * 9 / ip
  bb9: number;
  hr9: number;
  fip?: number;        // v1.1+

  // 스태미나 (v1엔 단순 — IP 한계만)
  staminaPitches: number;  // 예상 던질 수 있는 투구수. 선발 100, 불펜 25 기본.
};
```

### 6.3 KBO 리그 평균 상수 (v1)

```ts
// 베타에서 갱신
const LEAGUE_AVG = {
  AVG: 0.270,
  OBP: 0.345,
  SLG: 0.395,
  ISO: 0.125,
  BABIP: 0.310,
  BB_RATE: 0.090,
  K_RATE: 0.220,
  K9: 7.5,
  BB9: 3.5,
  HR9: 1.0,
  HIT_RATE: 0.270,
} as const;
```

---

## 7. 시드 정책

### 7.1 시드 생성

- 사용자가 직접 시드 입력 X. 매치 생성 시 서버(또는 클라이언트)가 자동 발급.
- 발급 방식: `Math.floor(Date.now() * Math.random() * 1e6) % 2**31`
- 매치 결과 저장 시 시드를 함께 저장 → 재현 가능.

### 7.2 RNG 구현

- `seedrandom` 라이브러리 사용 (12kB, 검증됨).
- 하나의 매치 = 하나의 `seedrandom(seed)` 인스턴스. 모든 무작위 추첨은 이 RNG에서만 뽑는다.
- 추첨 순서가 결과에 영향을 주므로, 코드 변경 시 추첨 순서가 바뀌면 같은 시드라도 다른 결과가 나올 수 있다 → **엔진 코드 변경 시 시드 호환성 깨짐**을 명시 (DB 캐시는 엔진 버전 키 포함).

### 7.3 캐싱 키

```
cacheKey = sha256(`${engineVersion}|${lineupA_id}|${lineupB_id}|${dataSnapshot}|${seed}`)
```

- `engineVersion`: `lib/sim/version.ts`의 상수. 엔진 코드 변경 시 bump.
- `dataSnapshot`: 선수 스탯 시드 일자 (ex `2026-05-21`).
- 동일 key 재시뮬 시 DB 조회만, 엔진 호출 X.

### 7.4 "다시 대결"

새 시드 발급 → 새 cacheKey → 새 엔진 호출. 의도된 변동.

---

## 8. 데이터 시드 (v1)

선수 스탯은 Statiz에서 1회 수동 시드. 자세한 스크래핑 정책은 product-spec §8.3 참조.

**v1 산출물**: `data/kbo_players_2026.json`
```json
{
  "snapshotDate": "2026-05-21",
  "source": "Statiz",
  "teams": {
    "lg": {
      "batters": [/* SimBatter[] */],
      "pitchers": [/* SimPitcher[] */]
    },
    "...": "10팀 동일"
  }
}
```

총 ~400명 × 선수당 ~20필드 ≈ 8,000 필드 = 200~400KB JSON. 클라이언트 번들에 포함하기엔 큼 → API route로 서빙 또는 빌드 타임 split.

---

## 9. MVP 산정 (v1)

경기 결과 후 MVP 1명 선정.

- 후보: 승리팀 선수만.
- 점수 = `타점*2 + 득점*1 + 홈런*3 + 안타*1` (타자) / `이닝*2 + 삼진*1 - 실점*2` (투수).
- 동점 시: 결정적 순간(역전타 등) 가산.
- v1.1+ LLM이 짧은 한 줄 코멘트("결정적인 7회 역전 3루타") 생성.

---

## 10. 디렉토리 구조 (제안)

```
lib/sim/
  version.ts          # 엔진 버전 상수
  types.ts            # 위 §2, §3, §6 타입 정의
  constants.ts        # KBO_ANCHOR, LEAGUE_AVG
  engine.ts           # simulateGame() 메인 진입점
  atBat.ts            # drawAtBatOutcome() — 한 타석 추첨
  baseRunning.ts      # applyOutcome() — 베이스 전이
  mvp.ts              # selectMvp()
  __tests__/
    engine.test.ts    # 시드 결정성, 강팀 승률, 평균 득점 분포
```

---

## 11. v1 완료 정의 (DoD)

- [ ] `lib/sim/` 모듈 11개 파일 + 타입·상수
- [ ] `seedrandom` 의존성 추가
- [ ] 단위 테스트: 결정성(같은 시드 = 같은 결과) · 분포(1000회 시뮬 합계가 anchor에서 ±2% 이내)
- [ ] 6 vs 6 가상 라인업으로 데모 가능 (실 선수 데이터 없이 임시 stats로 동작)
- [ ] `data/kbo_players_2026.json` 1차 시드 (별도 작업, 본 스펙 외)

v1.1+ 항목은 본 문서에 산재 — 추후 별도 차터로 정리.

---

## 12. 투수 운용 / 스태미나 모델 (v1)

라인업 빌더가 **선발 1 + 불펜 8 = 9슬롯** 구조이므로 (lib/types/lineup.ts) v1부터 단순 스태미나 모델로 불펜·마무리를 등장시킨다.

### 12.1 투구수 예산

- 각 투수는 `staminaPitches` 값을 들고 등판 시작.
  - 기본값: SP=100, RP=25, CL=20
- 타석마다 결과별로 투구수 차감:

| outcome | 차감 |
|---|---|
| K, BB | 5 |
| HR, 1B/2B/3B, GO/FO/PO/LO, SF, DP | 3 |
| HBP | 2 |

### 12.2 교체 트리거

- 현재 투수의 잔여 스태미나가 `< 8`이 되는 순간 다음 타자 전에 교체.
- 교체 순서: `team.bullpen` 배열 순서대로 (`role !== "CL"` 인 투수만 일반 풀에 포함).
- 가능한 불펜이 0명이면 현재 투수가 계속 던짐 (스태미나 음수 가능 — 게임이 안 끝나는 사태 방지).

### 12.3 마무리 (CL) 식별 + 투입 룰

**식별 (lineupAdapter.ts)**
1. 불펜 8명 중 **세이브(saves) 최댓값** 보유 투수 → `role: "CL"`
2. 세이브가 모두 0이거나 동률이면 **slot[8] 컨벤션** 폴백 (`PITCHER_CLOSER_INDEX = 8`)
3. 동률 시에도 slot[8]에 위치한 후보 우선 선택

세이브가 KBO에서 마무리를 정의하는 표준 지표이므로 데이터가 자동으로 마무리를 골라낸다. 사용자가 라인업 짤 때 따로 "마무리" 토글을 누를 필요 없음.

**투입**
- 9회 이상 + 우리팀 리드(1~3점) + 마무리 미등판 → 자동 투입.
- 마무리는 일반 교체 풀에서 제외돼 9회까지 대기. 9회 전에 점수 차가 크게 벌어졌거나 동점이면 마무리 미투입(세이브 상황 아님).

### 12.4 v1엔 미반영 (v1.1+)

- 좌우 스플릿 매치업 (특정 타자에게 좌투 불펜 등판 등)
- 투수의 실시간 ERA 악화에 따른 빠른 교체
- 더블 스위치, 대타·대주자

---

## 13. 오픈 이슈

1. **좌우 상성** — 좌투 vs 좌타 등 가중치. v1엔 1.0, v1.1+에 도입.
2. **HBP 비율** — 0.010 너무 낮을 수 있음. KBO는 사구가 잦은 편.
3. **타자 contactScore 정의** — 단순 `1 - kRate`보단 swStr% 같은 컨택 지표가 정확. Statiz에서 잡히는지 확인 후 결정.
4. **데이터 변경 시 캐시 무효화** — `dataSnapshot` 일자 단위 변경. 일중 갱신은 v2+.
5. **스태미나 튜닝** — 평균 SP가 6이닝 ±1 정도 던지도록 베타 트래픽 보고 튜닝.
