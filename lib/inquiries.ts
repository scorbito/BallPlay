// 문의게시판 공유 타입·상수 (서버 액션과 분리 — "use server" 파일은 async 함수만 export 가능).

export type InquiryCategory = "prize" | "general" | "bug" | "etc";

export type InquiryRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  category: string;
  content: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export const INQUIRY_CATEGORY_LABEL: Record<string, string> = {
  prize: "경품 수령",
  general: "일반 문의",
  bug: "오류 신고",
  etc: "기타",
};

export const VALID_INQUIRY_CATEGORIES: InquiryCategory[] = ["prize", "general", "bug", "etc"];
