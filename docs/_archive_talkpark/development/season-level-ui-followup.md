# 시즌 레벨 UI 후속 정리 기록

> 작성일: 2026-05-16
> 대상 브랜치: `feature/season-level`

시즌 레벨 실데이터 적용 이후 마이페이지와 프로필 모달에서 확인된 표시 밀도, 중복 정보, 레이어 충돌을 정리했습니다.

## 변경 내용

- 마이페이지 시즌 레벨 카드 우측 상단의 누적 XP 숫자를 제거하고 정보 아이콘으로 변경했습니다.
- 정보 아이콘 클릭 시 `경험치 획득 방법` 팝오버를 표시합니다.
  - 경기 결과 확인: +30 XP
  - 티켓 인증: +100 XP
  - 후기 작성: +70 XP
  - 사진 포함 후기: +20 XP
- 팝오버 닫기 `X` 버튼을 추가했습니다.
- 프로필 카드 안에서 팝오버가 승률 텍스트보다 아래 레이어로 깔리던 문제를 수정했습니다.
  - 원인: `.profile-card > *` 공통 `z-index`와 `.profile-card button` 공통 margin 스타일 충돌
  - 조치: 시즌 레벨 카드 전용 z-index override, 팝오버 닫기 버튼 margin reset
- 마이페이지 하단의 별도 `내 직관 통계` 카드를 제거했습니다.
- 동일 통계를 프로필 카드 내부의 3개 미니 통계로 통합했습니다.
  - 직관: 총 직관 수 + 인증 수
  - 승리: 승리 수 + 패/무
  - 승률: 현재 승률 + 시즌 기준
- 설정 페이지의 하단 로그아웃 버튼을 `연동계정 정보 > 계정 정보` 카드 오른쪽으로 이동했습니다.
- 프로필 모달의 레벨 칭호와 활동 지표 배치를 조정했습니다.
  - 레벨 칭호는 팀 정보 라인에 inline 배치
  - 활동 지표는 라벨을 위, 값을 아래로 표시
  - 모달 바깥 클릭/터치 시 닫히도록 `ModalShell.closeOnBackdrop` 옵션 추가

## 수정 파일

- `components/common/ModalShell.tsx`
- `components/domain/MyScreen.tsx`
- `components/domain/SeasonLevelCard.tsx`
- `components/domain/SettingsScreen.tsx`
- `components/domain/modals/ProfileModal.tsx`
- `styles/dark-my.css`
- `styles/dark-profile-popover.css`
- `styles/dark-season-level.css`

## 검증

- `npx.cmd tsc --noEmit --incremental false` 통과
- `npm.cmd run lint` 통과
- 기존 `lib/state/AppState.tsx` hook dependency warning은 별도 이슈로 유지
