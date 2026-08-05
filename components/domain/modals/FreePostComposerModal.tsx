"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ModalShell } from "@/components/common/ModalShell";
import { createFreePostAction } from "@/lib/actions/matchTalk";
import { useAppState } from "@/lib/state/AppState";
import { uploadUserFile } from "@/lib/supabase/storage-client";

const MAX_TITLE = 80;
const MAX_BODY = 1000;

type FreePostComposerModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (postId: string) => void;
};

export function FreePostComposerModal({ open, onClose, onCreated }: FreePostComposerModalProps) {
  const { showToast } = useAppState();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) return;
    setTitle("");
    setBody("");
    setPhotoUrl(null);
  }, [open]);

  const handlePhoto = async (file: File) => {
    setUploading(true);
    try {
      setPhotoUrl(await uploadUserFile("review-photos", file, "community-free"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "사진 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) return showToast("제목을 입력해주세요.");
    if (!body.trim()) return showToast("내용을 입력해주세요.");
    setSubmitting(true);
    try {
      const result = await createFreePostAction({ title, body, photoUrl });
      showToast("자유글을 올렸어요.");
      onCreated?.(result.id);
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "글 작성에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} title="자유글 작성" onClose={() => !submitting && onClose()} panelClassName="match-talk-modal-panel">
      <div className="match-talk-composer">
        <div className="composer-section">
          <label className="composer-label" htmlFor="free-post-title">제목</label>
          <input id="free-post-title" className="composer-input" value={title} maxLength={MAX_TITLE} onChange={(event) => setTitle(event.target.value)} placeholder="제목을 입력해주세요." />
          <span className="composer-count">{title.length}/{MAX_TITLE}</span>
        </div>
        <div className="composer-section">
          <label className="composer-label" htmlFor="free-post-body">내용</label>
          <textarea id="free-post-body" className="composer-textarea" value={body} maxLength={MAX_BODY} onChange={(event) => setBody(event.target.value)} placeholder="야구 이야기, 질문, 응원을 자유롭게 남겨보세요." />
          <span className="composer-count">{body.length}/{MAX_BODY}</span>
        </div>
        <div className="composer-section">
          <label className="composer-label">사진</label>
          {photoUrl ? <div className="composer-photo-preview"><Image src={photoUrl} alt="첨부 사진" fill sizes="320px" /><button type="button" onClick={() => setPhotoUrl(null)} aria-label="사진 삭제"><Trash2 size={16} /></button></div> : <label className="composer-photo-picker"><ImagePlus size={18} /><span>{uploading ? "업로드 중..." : "사진 추가"}</span><input type="file" accept="image/*" hidden disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handlePhoto(file); event.currentTarget.value = ""; }} /></label>}
        </div>
        <Button type="button" className="match-talk-submit" onClick={() => void submit()} disabled={submitting || uploading}>{submitting ? "등록 중..." : "등록하기"}</Button>
      </div>
    </ModalShell>
  );
}
