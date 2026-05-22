# 시즌 레벨 백필 정책

> 시즌 레벨 기능을 시즌 중간에 도입할 때 기존 직관/티켓 인증/후기 데이터를 XP 이벤트로 소급 반영하는 정책입니다.
> 전체 시즌 레벨 기획은 [season-level.md](./season-level.md)를 기준으로 봅니다.

관련 문서:
- 시즌 레벨 기획: [season-level.md](./season-level.md)
- 작업 인덱스: [../WORKPLAN.md](../WORKPLAN.md)
- 버전 관리: [../VERSION.md](../VERSION.md)

## 1. 기본 원칙

시즌 레벨 기능은 시즌 중간에 도입될 수 있습니다. 이 경우 기존 사용자들이 손해를 보지 않도록 현재 시즌의 기존 직관/티켓 인증/후기 데이터를 기준으로 XP를 소급 반영합니다.

- 시즌 레벨 기능 도입 시 현재 시즌의 기존 유효 데이터를 대상으로 XP 이벤트를 백필한다.
- 삭제된 직관/후기처럼 현재 DB에 남아 있지 않은 기록은 백필하지 않는다.
- 백필은 멱등하게 동작해야 한다.
- 같은 백필을 여러 번 실행해도 동일 XP 이벤트가 중복 생성되면 안 된다.

## 2. 백필 대상

현재 시즌 기준으로 아래 데이터를 확인합니다. 시즌은 `games.game_date`의 연도 기준으로 판단합니다.

| 기존 데이터 | 생성할 XP 이벤트 |
|---|---|
| 결과 확인이 완료된 직관 | `attendance_result_acknowledged +30` |
| 티켓 인증된 직관 | `ticket_verified +100` |
| 직관에 연결된 후기 | `review_created +70` |
| 사용자 업로드 사진이 1장 이상 있는 후기 | `review_photo_bonus +20` |

직관 등록 XP는 단순 등록이 아니라 결과 확인 완료 기준으로 백필합니다.

```text
attendances.result_acknowledged_at IS NOT NULL
→ attendance_result_acknowledged +30
```

티켓 인증 XP는 인증 상태를 기준으로 백필합니다.

```text
attendances.verified = true
→ ticket_verified +100
```

후기 XP는 직관과 연결된 후기 기준으로 백필합니다.

```text
reviews.attendance_id IS NOT NULL
→ review_created +70
```

사진 포함 후기 XP는 `reviews.photos`에 사진이 있는지 기준으로 백필합니다. 시스템 기본 이미지를 사용하지 않으므로 `photos.length > 0`이면 모두 사용자 업로드입니다.

```text
reviews.photos 배열 길이 > 0
→ review_photo_bonus +20
```

## 3. 전체 1회 백필

기능 배포 직후 운영자가 현재 시즌 전체 데이터를 대상으로 1회 백필을 실행합니다.

목적:

- 기존 사용자들이 바로 시즌 레벨을 볼 수 있게 한다.
- 첫 로그인/첫 진입 시 계산 지연을 줄인다.
- 운영자가 전체 레벨 분포를 확인할 수 있게 한다.

운영 방식 초안:

```text
1. 시즌 레벨 기능 배포
2. 현재 시즌 전체 attendances/reviews 조회
3. 조건에 맞는 xp_events upsert
4. 전체 XP/레벨 분포 확인
5. 이상 데이터가 있으면 재실행 가능
```

## 4. 로그인/앱 진입 시 유저별 보정 백필

전체 백필 이후에도 누락 이벤트가 생길 수 있으므로, 사용자가 로그인하거나 앱에 진입할 때 해당 유저 기준 보정 백필을 수행할 수 있습니다.

보정이 필요한 경우:

- 전체 백필 중 일부 실패
- 배포 직전/직후 사용자가 기록을 추가
- 운영자가 전체 백필을 아직 실행하지 못함
- 추후 XP 정책이 일부 추가됨

보정 함수 초안:

```text
ensureSeasonXpBackfilled(userId, season)
```

이 함수는 해당 유저의 현재 시즌 기록을 확인하고, 누락된 XP 이벤트만 생성합니다.

성능 보호:

- 매 진입마다 무겁게 전체 계산하지 않는다.
- `season_level_states.last_xp_backfilled_at` 같은 값을 저장해 최근 보정 여부를 확인한다.
- 이미 보정된 유저는 빠르게 스킵한다.

## 5. 중복 방지와 멱등성

백필과 실시간 XP 지급은 모두 같은 중복 방지 기준을 사용합니다.

권장 unique key:

```text
user_id + season + type + source_id
```

예시:

```text
ticket_verified / source_id = attendance_id
attendance_result_acknowledged / source_id = attendance_id
review_created / source_id = attendance_id
review_photo_bonus / source_id = attendance_id
```

후기 XP는 `review_id`보다 `attendance_id` 기준이 안전합니다. 후기를 삭제하고 다시 써도 같은 직관에 대한 후기 XP가 중복 지급되지 않게 하기 위함입니다.

백필 생성 방식:

```text
insert ... on conflict do nothing
```

또는 동등한 upsert 방식으로 처리합니다.

## 6. 추천 운영 정책

최종 추천은 전체 백필과 유저별 보정 백필을 함께 사용하는 방식입니다.

```text
시즌 레벨 기능 배포 시 전체 기존 데이터를 대상으로 1회 XP 백필을 실행한다.
이후 사용자 로그인 또는 앱 진입 시 유저 단위 보정 백필을 수행해 누락 이벤트를 보완한다.
모든 백필은 멱등하게 동작해야 하며, 동일 user_id + season + type + source_id 조합은 중복 생성하지 않는다.
```
