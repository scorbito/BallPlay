"use client";

import Link from "next/link";
import Image from "next/image";
import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AiChatAction = {
  label: string;
  href: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: AiChatAction[];
};

type AiChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SUGGESTIONS = [
  "오늘 삼성 예측 어때?",
  "오늘 경기 일정 알려줘",
  "일일 리포트 요약해줘",
  "김도영 최근 성적은?"
];

export function AiChatSheet({ open, onOpenChange }: AiChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "궁금한 팀, 경기, 선수 이름을 물어보세요. 야구놀이터 데이터 기준으로 답변해드릴게요."
    }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  const sendMessage = async (text: string) => {
    const question = text.trim();
    if (!question || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: messages.slice(-6).map((message) => ({
            role: message.role,
            text: message.text
          }))
        }),
        signal: controller.signal
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "답변을 가져오지 못했습니다.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: json.answer,
          actions: Array.isArray(json.actions) ? json.actions : []
        }
      ]);
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "응답 시간이 길어지고 있습니다. 잠시 후 다시 질문해 주세요."
        : (err as Error).message || "답변을 준비하는 중 문제가 발생했습니다.";
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: message
        }
      ]);
    } finally {
      window.clearTimeout(timer);
      setIsSending(false);
    }
  };

  return (
    <div className="ai-chat-backdrop" role="dialog" aria-modal="true" aria-label="AI 챗봇">
      <button className="ai-chat-dim" type="button" aria-label="AI 챗봇 닫기" onClick={() => onOpenChange(false)} />
      <section className="ai-chat-sheet">
        <header className="ai-chat-header">
          <span className="ai-chat-handle" aria-hidden="true" />
          <div className="ai-chat-title-row">
            <span className="ai-chat-title-icon">
              <Image src="/icons/menu/chatbot.png" alt="" width={44} height={44} priority />
            </span>
            <div>
              <h2>AI 챗봇</h2>
              <p>예측, 결과, 선수 정보를 찾아드려요</p>
            </div>
          </div>
          <button className="ai-chat-close" type="button" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="ai-chat-suggestions" aria-label="추천 질문">
          {SUGGESTIONS.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => sendMessage(suggestion)} disabled={isSending}>
              <Sparkles size={13} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>

        <div className="ai-chat-messages" ref={listRef}>
          {messages.map((message) => (
            <article key={message.id} className={`ai-chat-message ai-chat-message-${message.role}`}>
              <p>{formatChatText(message.text)}</p>
              {message.actions && message.actions.length > 0 ? (
                <div className="ai-chat-actions">
                  {message.actions.map((action) => (
                    <Link key={`${message.id}-${action.href}`} href={action.href} onClick={() => onOpenChange(false)}>
                      {action.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {isSending ? (
            <article className="ai-chat-message ai-chat-message-assistant ai-chat-message-loading">
              <span />
              <span />
              <span />
            </article>
          ) : null}
        </div>

        <form
          className="ai-chat-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            maxLength={500}
            placeholder="궁금한 내용을 입력하세요"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <button type="submit" disabled={!input.trim() || isSending} aria-label="전송">
            <Send size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}

function formatChatText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
