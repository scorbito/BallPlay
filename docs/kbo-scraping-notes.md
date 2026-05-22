# KBO 공식 사이트 스크래핑 노하우

`koreabaseball.com` 시즌 통계 페이지를 스크래핑할 때 막혔던 지점과 해결법 정리. 2026-05-22 기준 실제로 동작하는 패턴.

관련 코드:
- [scripts/scrape-kbo-stats.mjs](../scripts/scrape-kbo-stats.mjs) — 시즌 스탯 (이 문서)
- [scripts/scrape-kbo-rosters.mjs](../scripts/scrape-kbo-rosters.mjs) — 선수 명단 (기존 동작 패턴 참고)

---

## TL;DR — 5줄 요약

1. KBO 사이트는 **ASP.NET WebForms**. 단순 GET은 일부만, 필터 적용은 POST 필요.
2. POST 시 `__VIEWSTATE`/`__EVENTVALIDATION`만 보내면 **에러 페이지 반환**. `hfPage`/`hfOrderByCol` 같은 hidden까지 **모든 form input을 함께 전송**해야 정상 응답.
3. 1군 통계: `/Record/Player/{Hitter,Pitcher}Basic/Basic{1,2}.aspx` — Basic1+Basic2 머지.
4. 2군 통계: `/Futures/Player/{Hitter,Pitcher}.aspx` — **단일 페이지에 통합** (Basic2 없음).
5. 1군 테이블 클래스 `tData01 tt`, 2군 테이블 클래스 `tbl tt mb30`. 선택자는 `table[class*="tData"], table.tbl`로 둘 다 매칭.

---

## 1. 사이트 특성

### ASP.NET WebForms postback

페이지의 모든 드롭다운/페이지네이션이 `__doPostBack('컨트롤이름', '')` 형태로 동작.
- 폼 필드 prefix: `ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$...`
- 1군 통계 페이지의 `ddlTeam` 실제 name: `...$ddlTeam$ddlTeam` (2번 중첩 — 사용자 컨트롤 안에 select가 또 있음)
- 2군 통계 페이지의 `ddlTeam` 실제 name: `...$ddlTeam` (1번 중첩)

### 페이지별 URL 정리

| 종류 | URL |
|---|---|
| 1군 타자 기본 | `/Record/Player/HitterBasic/Basic1.aspx` |
| 1군 타자 보조 | `/Record/Player/HitterBasic/Basic2.aspx` |
| 1군 투수 기본 | `/Record/Player/PitcherBasic/Basic1.aspx` |
| 1군 투수 보조 | `/Record/Player/PitcherBasic/Basic2.aspx` |
| 2군 타자 | `/Futures/Player/Hitter.aspx` ← URL 패턴 다름 |
| 2군 투수 | `/Futures/Player/Pitcher.aspx` |

처음엔 2군도 `/Futures/Record/Player/HitterBasic/Basic1.aspx`로 시도했는데 전부 302 redirect로 에러. 2군은 **단일 페이지에 모든 컬럼 통합**돼있어 한 번만 가져오면 됨.

### 팀 코드 매핑

| 우리 시스템 ID | KBO `ddlTeam` 값 | KBO 약칭 (td[2]) |
|---|---|---|
| lg | LG | LG |
| doosan | OB | 두산 |
| kt | KT | KT |
| samsung | SS | 삼성 |
| ssg | SK | SSG |
| nc | NC | NC |
| kia | HT | KIA |
| hanwha | HH | 한화 |
| kiwoom | WO | 키움 |
| lotte | LT | 롯데 |

두산 = OB (옛 OB 베어스), 삼성 = SS, SSG = SK (옛 SK 와이번스), KIA = HT (옛 해태 타이거즈), 한화 = HH, 키움 = WO (옛 우리 히어로즈) — KBO 시스템이 옛 코드를 유지 중.

---

## 2. 막혔던 지점과 해결

### 문제 1 — POST 응답이 에러 페이지

`__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`, `ddlTeam`, `ddlSeason`만 보냈더니 **3382 bytes 짜리 "에러 | KBO홈페이지" HTML** 반환.

**원인**: ASP.NET WebForms는 form 안의 모든 input/select 값을 전부 전송해야 정상 응답. 일부만 보내면 server-side validation에서 거부.

**해결**: GET 응답에서 `<form>` 안의 모든 input/select를 자동 수집해서 그대로 POST.

```js
function collectFormFields($) {
  const form = new URLSearchParams();
  $("form input").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const type = ($(el).attr("type") || "").toLowerCase();
    if (type === "submit" || type === "button" || type === "image") return;
    if (type === "checkbox" || type === "radio") {
      if ($(el).attr("checked") != null) form.set(name, $(el).attr("value") ?? "");
      return;
    }
    form.set(name, $(el).attr("value") ?? "");
  });
  $("form select").each((_, el) => {
    const name = $(el).attr("name");
    if (!name) return;
    const selected =
      $(el).find("option[selected]").attr("value") ??
      $(el).find("option").first().attr("value") ??
      "";
    form.set(name, selected);
  });
  return form;
}
```

수집되는 hidden field 예시 (15개):
- `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`, `__LASTFOCUS`
- `hfPage` = "1"
- `hfOrderByCol` = "HRA_RT"
- `hfOrderBy` = "DESC"
- `ddlSeason$ddlSeason` = "2026"
- `ddlSeries$ddlSeries` = "0"
- `ddlTeam$ddlTeam` = (override해서 팀 코드 set)
- `ddlPos$ddlPos`, `ddlSituation$ddlSituation`, `ddlSituationDetail$ddlSituationDetail` = ""

이걸 그대로 보낸 뒤 `__EVENTTARGET`만 `ddlTeam$ddlTeam`으로 override하면 정상 응답.

### 문제 2 — 테이블 클래스 추측 오류

처음엔 `table.tData`로 선택했으나 0행 매칭. 실제 클래스는:
- 1군: `class="tData01 tt"`
- 2군: `class="tbl tt mb30"`

**해결**: `table[class*="tData"], table.tbl`로 부분 매칭.

```js
$('table[class*="tData"] tbody tr, table.tEx tbody tr, table.tbl tbody tr')
```

### 문제 3 — 2군 페이지 ddlTeam 위치 차이

1군은 select name이 `$ddlTeam$ddlTeam`, 2군은 `$ddlTeam`로 한 단계 짧음.

**해결**: 후보 배열로 fallback 매칭.

```js
const teamSelectName = findFormFieldName($init, ["ddlTeam$ddlTeam", "ddlTeam"]);
```

`endsWith` 매칭이라 prefix가 길어도 자동으로 잡힘.

---

## 3. 컬럼 구조

### 1군 타자 Basic1 (16 컬럼)
순위 / 선수명 / 팀명 / AVG / G / PA / AB / R / H / 2B / 3B / HR / TB / RBI / SAC / SF

### 1군 타자 Basic2 (보조 — BB/HBP/SO/SLG/OBP)
순위 / 선수명 / 팀명 / AVG / BB / IBB / HBP / SO / GDP / SLG / OBP

→ Basic1+Basic2를 `(이름, 팀명)` 키로 머지해서 한 행으로 합침.

### 1군 투수 Basic1 (19 컬럼)
순위 / 선수명 / 팀명 / ERA / G / W / L / SV / HLD / WPCT / IP / H / HR / BB / HBP / SO / R / ER / WHIP

### 2군 타자 (단일 페이지, 19 컬럼)
순위 / 선수명 / 팀명 / AVG / G / PA / AB / R / H / 2B / 3B / HR / RBI / **SB** / BB / HBP / SO / SLG / OBP

⚠️ 1군 Basic1엔 SB가 없는데 2군엔 있음. 컬럼 순서가 다르니 **2군 전용 row 파서 필수**.

### 2군 투수 (단일 페이지, 18 컬럼)
순위 / 선수명 / 팀명 / ERA / G / W / L / SV / HLD / WPCT / IP / H / HR / BB / HBP / SO / R / ER

⚠️ WHIP 컬럼 없음. IP·H·BB로 계산해서 보강.

### IP 파싱 주의

KBO 사이트는 IP를 `"123 2/3"` 형태로 표시. 소수 변환 필요:

```js
function parseIp(s) {
  if (!s) return 0;
  const m = String(s).trim().match(/^(\d+)(?:\s+(\d)\/3)?$/);
  if (!m) return Number(s) || 0;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2], 10) / 3 : 0;
  return Math.round((whole + frac) * 10) / 10;
}
```

---

## 4. 매너 / Rate Limiting

- **페이지 간 1.5초 딜레이** (`FETCH_DELAY_MS = 1500`) — KBO는 트래픽 여유 있는 사이트지만 보수적으로
- **User-Agent에 봇 식별자 + 연락처**:
  ```
  Mozilla/5.0 ... BallPlay-Seed/0.1 (contact: dev@ballplay.local)
  ```
- **시즌당 1회 시드 + 필요 시 수동 재실행**. cron으로 정기 호출 금지.
- 한 팀당 fetch 6번 (1군 H1, H2, P1, P2 + 2군 H, P). 10팀 = 60번 fetch + 60초 딜레이 = 약 2분.

---

## 5. 데이터 매칭

KBO 통계 페이지엔 **등번호가 없음** (`순위 / 선수명 / 팀명`으로 시작). 그래서 `data/rosters/{team}.json`의 `name` 필드로 매칭.

```js
function findPlayerInRoster(name, roster) {
  if (!roster) return null;
  const candidates = roster.players.filter((p) => p.name === name);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // 동명이인 — 1군 출장 우선
  const active = candidates.find((p) => (p.seasonGames ?? 0) > 0);
  return active ?? candidates[0];
}
```

**매칭 안 되는 경우** (실제 발생):
- 한 팀 내 동명이인 — KBO 통계엔 등번호가 없어 구분 불가 (드물지만 있음 — 김태훈/박준영/이주형 등)
- 외국인 선수 표기 차이 (예: "카메론" vs "Cameron" — 다행히 KBO는 한글로 통일)
- 한자명 vs 한글명 — KBO도 한글 사용해서 문제 없음
- 트레이드 직후 — roster는 옛 팀, 통계는 새 팀일 수 있음

평균 매칭률 약 82% (1군 활동 보유 미매칭은 전체에서 단 몇 명).

---

## 6. 디버깅 패턴

응답 이상하면 raw HTML 덤프해서 확인:

```js
const r = await fetch(URL, { headers: { 'User-Agent': UA } });
const text = await r.text();
console.log('len:', text.length);   // 3382 = 에러 페이지 (의심 신호)
console.log(text.slice(0, 500));    // <title>에러 | KBO홈페이지</title>면 폼 필드 누락
```

폼 필드 구조 빠른 점검:

```bash
npm run scrape:stats:probe
```

→ 모든 `<select>` 이름, 모든 `<table>` 클래스/행수, 첫 행의 td 내용, 페이지네이션 링크 출력.

---

## 7. 향후 확장 메모

이 스크래퍼로 못 가져오는 데이터:
- **최근 N경기** (hot/cold) → 선수 상세 페이지(`/HitterDetail/Daily.aspx?playerId=XXX`)를 일별 게임로그로 800번 fetch 필요
- **좌/우 split** → `/HitterDetail/Situation.aspx?playerId=XXX&handType=L`
- **구장별 split** → 같은 페이지의 ballpark 드롭다운
- **부상자 명단** → KBO 공시 PDF 또는 NAVER 스포츠 뉴스 (스크래핑 어려움)

전부 v1 미니게임엔 과잉. 추가하려면 위의 매너 기준대로 polite하게 + 캐싱 필수.

---

## 8. 보너스 — 최근 10경기 (hot/cold)

별도 스크립트 [scripts/scrape-kbo-recent10.mjs](../scripts/scrape-kbo-recent10.mjs)로 선수별 일자별 최근 10경기 기록을 수집할 수 있음. 시뮬에 hot/cold 효과 추가하고 싶을 때 사용.

### 출처 페이지
```
/Record/Player/HitterDetail/Basic.aspx?playerId=XXX
/Record/Player/PitcherDetail/Basic.aspx?playerId=XXX
```
선수 detail 페이지의 `<h6>최근 10경기</h6>` 다음에 등장하는 `<table>`이 일자별 기록.

### 컬럼 (타자, 17개)
일자 / 상대 / AVG / PA / AB / R / H / 2B / 3B / HR / RBI / SB / CS / BB / HBP / SO / GDP

마지막 행은 "합계" (10경기 누적). `is_summary` 플래그로 구분.

### 흐름

1. **선수 ID 수집** — 시즌 누적 시드와 동일한 패턴
   - `HitterBasic/Basic1.aspx`에서 팀 ddlTeam postback
   - `<a href="...playerId=XXX">선수명</a>`에서 KBO 고유 ID 추출

2. **선수별 detail GET** — `playerId`를 query string으로 (postback 불필요, 단순 GET)

3. **DOM 순회로 table 매칭** — `<h6>최근 10경기</h6>` 다음에 sibling이 아닌 wrapper div가 끼어있어 `nextAll("table")`로는 안 잡힘. 깊이 우선 walk로 "h6 anchor 발견 이후 등장하는 첫 table" 패턴.

```js
function findNextTable($, h6Text) {
  let foundH6 = false;
  let result = null;
  const walk = (node) => {
    if (result) return;
    const $node = $(node);
    if (node.type === "tag") {
      const tag = node.tagName?.toLowerCase();
      if (!foundH6 && tag === "h6" && $node.text().trim() === h6Text) {
        foundH6 = true;
        return;
      }
      if (foundH6 && tag === "table") {
        result = $node;
        return;
      }
    }
    $node.children().each((_, child) => walk(child));
  };
  walk($("body")[0]);
  return result;
}
```

### KBO playerId ↔ 우리 player.id 매칭

- KBO playerId: KBO 시스템 고유 숫자 (예: `67893`)
- 우리 player.id: `{teamId}-{jerseyNumber}` (예: `doosan-24`)
- 매칭 키: `(teamId, name)`. 동명이인은 1군 출장자 우선.
- 스모크 결과 두산 100% 매칭 (활성 선수는 우리 roster에 모두 있음).

### 비용

- 1군 선수 약 500명 × 1.5초 = **12~13분**
- 시즌 누적 시드보다 6배 비쌈. 정기 cron 절대 금지.
- 시뮬 hot/cold 효과 추가 시점에만 1회 시드.

### 출력 스키마 (`data/recent10_2026.json`)

```jsonc
{
  "snapshotDate": "2026-05-22",
  "source": "koreabaseball.com (HitterDetail/PitcherDetail Basic.aspx)",
  "hitters": {
    "doosan-52": [
      { "일자": "05.15", "상대": "롯데", "AVG": "0.200", "PA": "5", ..., "is_summary": false },
      { "일자": "05.14", "상대": "KIA", ..., "is_summary": false },
      ...
      { "일자": "합계", ..., "is_summary": true }
    ]
  },
  "pitchers": { "doosan-25": [ ... ] }
}
```

### 사용법

```bash
npm run scrape:recent10:probe        # h6 / table 구조 확인
npm run scrape:recent10:smoke        # 두산 5명만 (테스트, ~10초)
npm run scrape:recent10              # 전체 (1군 약 500명, ~13분)

node scripts/scrape-kbo-recent10.mjs --team=lg          # 한 팀만
node scripts/scrape-kbo-recent10.mjs --limit=20         # 상위 20명만
```

### 시뮬 통합 아이디어 (구현 안 함, 메모만)

`makeSimBatter()`에서 시즌 누적 + 최근 10 가중 평균:

```js
// 예시 — atBat.ts나 lineupAdapter.ts에서
const seasonAvg = season.hits / season.ab;
const recentAvg = recent.sumH / recent.sumAB;
const blendedAvg = 0.7 * seasonAvg + 0.3 * recentAvg;
// → 매 타석 확률에 반영
```

가중치(0.7/0.3)는 표본 부족 보정 — 최근 10경기 PA가 작은 백업 선수는 노이즈가 큼.

---

## 9. 빠른 체크리스트 (다음 시즌 갱신 시)

- [ ] `--probe`로 KBO가 폼 구조 안 바꿨는지 확인
- [ ] 테이블 클래스 (`tData01`, `tbl`) 그대로인지 확인
- [ ] 컬럼 순서 변동 없는지 첫 행 샘플로 확인
- [ ] `npm run scrape:stats:one`으로 한 팀 검증
- [ ] `npm run scrape:stats` 전체 실행
- [ ] 매칭률 80% 이상이면 통과, 아니면 roster 먼저 갱신 (`npm run scrape:rosters`)
- [ ] `data/kbo_players_2026.json`의 `snapshotDate`가 오늘 날짜로 갱신됐는지 확인
