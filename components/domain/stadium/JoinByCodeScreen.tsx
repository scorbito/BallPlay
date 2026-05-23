"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMatchByInviteCode } from "@/lib/supabase/query-parts/bpMatches";

// invite_code는 4자리 숫자. 공백/비숫자 제거 후 사용.
const INVITE_CODE_LENGTH = 4;
const INVITE_NUMERIC_RE = /^\d+$/;

function normalize(raw: string): string {
  return raw.replace(/\D+/g, "").slice(0, INVITE_CODE_LENGTH);
}

export function JoinByCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = normalize(code);

    if (trimmed.length !== INVITE_CODE_LENGTH) {
      setError(`초대 코드는 ${INVITE_CODE_LENGTH}자리 숫자입니다.`);
      return;
    }
    if (!INVITE_NUMERIC_RE.test(trimmed)) {
      setError("숫자만 입력해주세요.");
      return;
    }

    setError(null);
    setChecking(true);

    const client = createSupabaseBrowserClient();
    const row = await getMatchByInviteCode(client, trimmed);

    if (!row) {
      setError("해당 코드의 매치를 찾을 수 없습니다.");
      setChecking(false);
      return;
    }
    if (row.status === "finished" || row.status === "cancelled") {
      setError("이미 종료된 매치입니다.");
      setChecking(false);
      return;
    }

    router.replace(`/stadium/live/${trimmed}`);
  };

  return (
    <AppShell activeTab="stadium" title="코드로 참여" backHref="/stadium/lobby" theme="dark" wide>
      <section className="stadium-live-create">
        <header className="stadium-enter-head">
          <h1 className="stadium-h1">초대 코드 입력</h1>
          <p className="stadium-sub">친구에게 받은 4자리 숫자 코드를 입력하면 매치에 참여합니다.</p>
        </header>

        <form className="stadium-code-form" onSubmit={handleSubmit}>
          <label className="stadium-code-label" htmlFor="invite-code">
            <KeyRound size={14} />
            초대 코드
          </label>
          <input
            id="invite-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            spellCheck={false}
            maxLength={INVITE_CODE_LENGTH}
            value={code}
            onChange={(e) => setCode(normalize(e.target.value))}
            placeholder="예) 4821"
            className="stadium-code-input"
            aria-invalid={error ? "true" : "false"}
          />
          <p className="stadium-code-hint">숫자 4자리</p>

          {error ? <p className="stadium-error">{error}</p> : null}

          <button
            type="submit"
            className="stadium-cta-primary"
            disabled={checking || code.length === 0}
          >
            <KeyRound size={16} />
            <span>{checking ? "확인 중..." : "매치 입장"}</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
    </AppShell>
  );
}
