"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Mail } from "lucide-react";
import { emailAuthAction } from "@/lib/actions/auth";

type LoginFormProps = {
  error?: string;
};

const errorMessages: Record<string, string> = {
  missing: "이메일과 비밀번호를 입력해주세요.",
  "short-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth-required": "로그인이 필요합니다."
};

function LoginSubmit({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { pending } = useFormStatus();
  return (
    <button className="login-submit" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="onboarding-submit-spinner" aria-hidden="true" />
          처리 중...
        </>
      ) : (
        <>
          <Mail size={16} />
          {mode === "sign-in" ? "이메일로 로그인" : "이메일로 가입"}
        </>
      )}
    </button>
  );
}

export function LoginForm({ error }: LoginFormProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [open, setOpen] = useState(Boolean(error));

  const message = error ? errorMessages[error] ?? error : "";

  if (!open) {
    return (
      <div className="login-form-collapsed">
        {message ? (
          <p className={error ? "login-message login-message-error" : "login-message"}>{message}</p>
        ) : null}
        <button className="oauth-button oauth-email" type="button" onClick={() => setOpen(true)}>
          <Mail size={16} />
          이메일로 계속하기
        </button>
      </div>
    );
  }

  return (
    <form action={emailAuthAction} className="login-form">
      <input name="mode" type="hidden" value={mode} />

      <div className="login-mode-tabs">
        <button
          className={mode === "sign-in" ? "login-mode-tab login-mode-tab-active" : "login-mode-tab"}
          type="button"
          onClick={() => setMode("sign-in")}
        >
          로그인
        </button>
        <button
          className={mode === "sign-up" ? "login-mode-tab login-mode-tab-active" : "login-mode-tab"}
          type="button"
          onClick={() => setMode("sign-up")}
        >
          가입
        </button>
      </div>

      <label className="login-field">
        <span>이메일</span>
        <input autoComplete="email" name="email" placeholder="you@example.com" type="email" />
      </label>

      <label className="login-field">
        <span>비밀번호</span>
        <input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          name="password"
          placeholder="6자 이상"
          type="password"
        />
      </label>

      {message ? (
        <p className={error ? "login-message login-message-error" : "login-message"}>{message}</p>
      ) : null}

      <LoginSubmit mode={mode} />
    </form>
  );
}
