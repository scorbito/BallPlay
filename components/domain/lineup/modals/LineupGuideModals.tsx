"use client";

import { ModalShell } from "@/components/common/ModalShell";

type GuideStep0ModalProps = {
  open: boolean;
  /** 자동 선택된 팀 이름 — "○○으로 빈 라인업을 만들어 뒀어요" 안내에 사용 */
  teamShortName?: string;
  onClose: () => void;
  /** "실제 경기 라인업 불러오기" — 처음 사용자가 직접 짜기 어려우므로 실제 경기 라인업을
   *  그대로 불러와 한 번에 완성하도록 유도. 누르면 최근 라인업 picker 를 연다. */
  onLoadRealLineup: () => void;
};

/** 라인업 빌더 첫 진입 안내 — 응원팀 개념이 없는 야구놀이터에서
 *  무작위 팀으로 빈 슬롯을 자동 생성한 직후 "여기서 시작하세요" 코치마크.
 *  처음 사용자는 직접 짜기 어려우니 "실제 경기 라인업 불러오기" 를 1순위로 유도. */
export function GuideStep0Modal({ open, teamShortName, onClose, onLoadRealLineup }: GuideStep0ModalProps) {
  return (
    <ModalShell
      open={open}
      title="라인업을 짜 볼까요?"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          {teamShortName ? (
            <>
              <strong>{teamShortName}</strong>으로 빈 라인업을 하나 만들어 뒀어요.<br />
              <br />
            </>
          ) : null}
          처음이라면 <strong>실제 경기 라인업 불러오기</strong>로 한 번에 완성해보세요.<br />
          물론 아래 <strong>대기</strong> 풀에서 선수를 탭해 직접 짜도 돼요.
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onClose}
          >
            직접 짤게요
          </button>
          <button
            type="button"
            className="lineup-confirm-primary"
            onClick={onLoadRealLineup}
          >
            실제 경기 라인업 불러오기
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type GuideStep1ModalProps = {
  open: boolean;
  onClose: () => void;
  /** "확인" 클릭 — 보통 모드를 투수로 전환 */
  onStartPicking: () => void;
};

/** 새 슬롯 onboarding step1 — 타순 9명 완성 직후, "다음은 필수 투수" 안내 */
export function GuideStep1Modal({ open, onClose, onStartPicking }: GuideStep1ModalProps) {
  return (
    <ModalShell
      open={open}
      title="타순 9명을 다 채웠습니다"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          이제 <strong>선발 투수</strong>만 선택하면 출전 등록할 수 있어요.<br />
          (마무리·불펜은 출전 등록 시 자동으로 채워집니다)
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="lineup-confirm-primary"
            onClick={onStartPicking}
          >
            확인
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type GuideStep2ModalProps = {
  open: boolean;
  needsAutoFillNotice: boolean;
  publishProcessing: boolean;
  onClose: () => void;
  /** "확인" 클릭 — 자동 채움(필요 시) + 출전 등록 */
  onAutoFillAndPublish: () => void;
};

/** 새 슬롯 onboarding step2 — 선발 투수까지 선택 직후, "이제 출전해서 가상경기" 안내 + 자동 출전 등록.
    마무리/불펜이 비어있으면 saves/era 기준으로 자동 채워서 함께 저장. */
export function GuideStep2Modal({
  open,
  needsAutoFillNotice,
  publishProcessing,
  onClose,
  onAutoFillAndPublish
}: GuideStep2ModalProps) {
  return (
    <ModalShell
      open={open}
      title="라인업 준비 완료!"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          이제 라인업을 <strong>출전 등록</strong>해서 경기장에서 다른 사람 라인업과 가상경기를 할 수 있어요.<br />
          {needsAutoFillNotice ? (
            <>
              <br />
              마무리·불펜 빈 자리는 자동으로 채워집니다.
            </>
          ) : null}
        </p>
        <div className="lineup-confirm-actions">
          <button
            type="button"
            className="lineup-confirm-cancel"
            onClick={onClose}
            disabled={publishProcessing}
          >
            닫기
          </button>
          <button
            type="button"
            className="lineup-confirm-primary"
            disabled={publishProcessing}
            onClick={onAutoFillAndPublish}
          >
            확인
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

type GuideGoStadiumModalProps = {
  open: boolean;
  onClose: () => void;
  /** "경기장 가기" — 출전 등록 직후 경기장(/stadium/lobby)으로 이동해 바로 대결 유도 */
  onGoStadium: () => void;
};

/** 출전 등록 성공 직후 — "이제 경기장에서 대결해볼까요?" 다음 행동 유도. */
export function GuideGoStadiumModal({ open, onClose, onGoStadium }: GuideGoStadiumModalProps) {
  return (
    <ModalShell
      open={open}
      title="출전 등록 완료!"
      onClose={onClose}
      panelClassName="lineup-confirm-modal-panel"
      closeOnBackdrop
    >
      <div className="lineup-confirm-body">
        <p className="lineup-confirm-msg">
          라인업이 출전 등록됐어요. 이제 <strong>경기장</strong>에서 다른 사람 라인업과 가상경기를 해볼까요?
        </p>
        <div className="lineup-confirm-actions">
          <button type="button" className="lineup-confirm-cancel" onClick={onClose}>
            나중에
          </button>
          <button type="button" className="lineup-confirm-primary" onClick={onGoStadium}>
            경기장 가기
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
