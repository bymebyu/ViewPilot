import { useState, useRef, useCallback, useEffect } from "react";
import ModelSelector from "./ModelSelector";
import { useChatStore } from "../store/chat-store";
import type { Attachment } from "../store/chat-store";
import { saveInputHistory, loadInputHistory } from "../lib/storage";
import { sendMessage, getDebugLogs, onDebugLogChange } from "../lib/browser-api";
import { useTranslation, LOCALE_NAMES, SUPPORTED_LOCALES } from "../hooks/useTranslation";
import { htmlToMarkdown } from "../lib/clipboard-converter";

async function readFileAsAttachment(file: File, fileReadFailedMsg: string): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = () =>
        resolve({
          id: crypto.randomUUID(),
          type: "image",
          name: file.name,
          dataUrl: reader.result as string,
          mimeType: file.type,
        });
      reader.readAsDataURL(file);
    } else {
      reader.onload = () =>
        resolve({
          id: crypto.randomUUID(),
          type: "text",
          name: file.name,
          text: reader.result as string,
          mimeType: file.type,
        });
      reader.readAsText(file);
    }
    reader.onerror = () => reject(new Error(fileReadFailedMsg));
  });
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1
                      bg-gray-800 border border-gray-700 text-gray-200 text-[10px] rounded
                      whitespace-nowrap pointer-events-none shadow-lg
                      opacity-0 group-hover/tip:opacity-100 transition-opacity duration-75 z-50">
        {label}
      </div>
    </div>
  );
}

export default function InputBar({
  onSend,
  disabled,
  onClear,
  onToggleHistory,
  onCancel,
  isStreaming,
}: {
  onSend: (t: string) => Promise<boolean | void>;
  disabled: boolean;
  onClear?: () => void;
  onToggleHistory?: () => void;
  onCancel?: () => void;
  isStreaming?: boolean;
}) {
  const { t, locale, setLocale } = useTranslation();
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [isSavingText, setIsSavingText] = useState(false);
  const [isCapturingFull, setIsCapturingFull] = useState(false);
  const [showDebugLog, setShowDebugLog] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const debugLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDebugLog) return;
    setDebugLogs(getDebugLogs());
    const unsub = onDebugLogChange(() => {
      setDebugLogs(getDebugLogs());
      requestAnimationFrame(() => {
        if (debugLogRef.current) debugLogRef.current.scrollTop = debugLogRef.current.scrollHeight;
      });
    });
    return unsub;
  }, [showDebugLog]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pendingAttachments, addAttachment, removeAttachment, usePageContext, togglePageContext, webSearchEnabled, toggleWebSearch, webSearchStatus, prefillText, setPrefillText } = useChatStore();

  // 입력 히스토리 (전송된 메시지 목록, 0 = 가장 최근)
  const historyRef = useRef<string[]>([]);
  const draftRef = useRef(""); // 히스토리 팝업 열릴 때 현재 입력 임시 저장

  // prefillText가 설정되면 입력창에 채우고 포커스
  const [pendingFocus, setPendingFocus] = useState(false);
  useEffect(() => {
    if (!prefillText) return;
    setInput(prefillText);
    setPrefillText("");
    setPendingFocus(true);

    const ta = textareaRef.current;
    if (!ta) return;

    const doFocus = () => {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      ta.focus();
      setPendingFocus(false);
    };

    // Firefox: window.focus()가 동작하여 즉시 포커스 가능
    window.focus();

    if (document.hasFocus()) {
      requestAnimationFrame(doFocus);
    } else {
      // Chrome: 사이드패널 클릭 시 focus 이벤트 발생 → 그때 자동 포커스
      const onFocus = () => {
        window.removeEventListener("focus", onFocus);
        requestAnimationFrame(doFocus);
      };
      window.addEventListener("focus", onFocus);
      setTimeout(() => { window.removeEventListener("focus", onFocus); setPendingFocus(false); }, 5000);
    }
  }, [prefillText]);

  // 로컬 스토리지에서 입력 히스토리 로드
  useEffect(() => {
    loadInputHistory().then((h) => { historyRef.current = h; });
  }, []);

  // 응답 완료 후 포커스 복귀 (disabled: true → false)
  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    if (!showHistoryPopup) return;
    const close = () => {
      setShowHistoryPopup(false);
      setInput(draftRef.current);
      draftRef.current = "";
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showHistoryPopup]);

  useEffect(() => {
    if (!isCapturingFull) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { void handleCancelCapture(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isCapturingFull]);

  const applyHistoryItem = (item: string) => {
    setInput(item);
    setShowHistoryPopup(false);
    draftRef.current = "";
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
        ta.selectionStart = ta.selectionEnd = ta.value.length;
        ta.focus();
      }
    });
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || disabled) return;
    if (showHistoryPopup) {
      setShowHistoryPopup(false);
      draftRef.current = "";
    }
    // 히스토리: 동일 문자열 제거 후 최신으로 등록
    if (text) {
      historyRef.current = [text, ...historyRef.current.filter((h) => h !== text)].slice(0, 10);
      saveInputHistory(historyRef.current);
    }
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const result = await onSend(text);
    // 전송 실패 시 입력 복원
    if (result === false) {
      setInput(text);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = "auto";
          ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
        }
      });
    }
  };

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSavePageText = async () => {
    if (isSavingText) return;
    setIsSavingText(true);
    try {
      const res = await sendMessage<{ success: boolean; text?: string; title?: string; url?: string; error?: string }>({ type: "GET_FULL_PAGE_TEXT" });

      // Google Docs / Sheets / Slides: export 실패 시 에러 안내 (스크린샷 폴백 제거)
      if (!res?.success && res?.error === "google_workspace") {
        alert(t("error.googleWorkspaceExport"));
        return;
      }

      if (!res?.success || !res.text) {
        alert(t(`error.${res?.error ?? "NO_TEXT"}`));
        return;
      }
      const safe = (res.title || "page").replace(/[^\w가-힣\-_ ]/g, "_").slice(0, 60);
      const filename = `${safe}.txt`;
      const content = `URL: ${res.url}\n\n${res.text}`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      triggerDownload(blobUrl, filename);
      URL.revokeObjectURL(blobUrl);
      addAttachment({
        id: crypto.randomUUID(),
        type: "text",
        name: filename,
        text: res.text.slice(0, 100000),
        mimeType: "text/plain",
      });
    } catch {
      // background crash 또는 context invalidation 시 상태 정리
    } finally {
      setIsSavingText(false);
    }
  };

  const handleSaveFullPageScreenshot = async () => {
    if (isCapturingFull) return;
    setIsCapturingFull(true);
    try {
      const res = await sendMessage<{ success: boolean; dataUrl?: string; error?: string }>({ type: "CAPTURE_FULL_PAGE_SCREENSHOT" });
      if (!res?.success || !res.dataUrl) return;
      const filename = `fullpage-${Date.now()}.jpg`;
      triggerDownload(res.dataUrl, filename);
      addAttachment({
        id: crypto.randomUUID(),
        type: "image",
        name: filename,
        dataUrl: res.dataUrl,
        mimeType: "image/jpeg",
      });
    } catch {
      // background crash 또는 context invalidation 시 상태 정리
    } finally {
      setIsCapturingFull(false);
    }
  };

  const handleCancelCapture = async () => {
    if (!isCapturingFull) return;
    if (!window.confirm(t("input.cancelCaptureConfirm"))) return;
    await sendMessage({ type: "CANCEL_FULL_PAGE_SCREENSHOT" });
  };

  const handleDownloadDevLog = async () => {
    const res = await sendMessage<{ success: boolean; log?: string }>({ type: "GET_DEV_LOG" });
    if (!res?.success || !res.log) return;
    const filename = `copilot-debug-${Date.now()}.txt`;
    const blob = new Blob([res.log], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    URL.revokeObjectURL(blobUrl);
  };

  const handleScreenshot = async () => {
    const res = await sendMessage<{ success: boolean; dataUrl?: string; error?: string }>({ type: "CAPTURE_SCREENSHOT" });
    if (res?.success && res.dataUrl) {
      addAttachment({
        id: crypto.randomUUID(),
        type: "image",
        name: t("input.screenshotName"),
        dataUrl: res.dataUrl,
        mimeType: "image/png",
      });
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      try {
        const att = await readFileAsAttachment(file, t("error.fileReadFailed"));
        addAttachment(att);
      } catch { /* 무시 */ }
    }
  }, [addAttachment, t]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    if (!html) return;

    const hasRichContent = /<(h[1-6]|pre|code|table|ul|ol|li|blockquote|strong|em|del|span class)/i.test(html);
    if (!hasRichContent) return;

    e.preventDefault();

    const md = htmlToMarkdown(html);

    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = input.slice(0, start);
      const after = input.slice(end);
      const newValue = before + md + after;
      setInput(newValue);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const pos = start + md.length;
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pos;
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
      });
    } else {
      setInput(prev => prev + md);
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter: 전송 (팝업 선택 우선)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      if (showHistoryPopup) {
        e.preventDefault();
        applyHistoryItem(historyRef.current[selectedHistoryIndex]);
        return;
      }
      e.preventDefault();
      send();
      return;
    }

    // ArrowRight: 팝업에서 선택 확정
    if (e.key === "ArrowRight" && showHistoryPopup) {
      e.preventDefault();
      applyHistoryItem(historyRef.current[selectedHistoryIndex]);
      return;
    }

    // Escape: 스트리밍 중이면 취소, 아니면 팝업 닫기
    if (e.key === "Escape") {
      if (isStreaming && onCancel) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (showHistoryPopup) {
        e.preventDefault();
        setShowHistoryPopup(false);
        setInput(draftRef.current);
        draftRef.current = "";
        return;
      }
    }

    // ArrowUp: 팝업 열기 또는 위로 이동
    if (e.key === "ArrowUp") {
      const history = historyRef.current;
      if (history.length === 0) return;
      if (!showHistoryPopup) {
        // 싱글라인일 때만 팝업 열기
        if (input.includes("\n")) return;
        e.preventDefault();
        draftRef.current = input;
        setShowHistoryPopup(true);
        setSelectedHistoryIndex(0);
        return;
      }
      e.preventDefault();
      setSelectedHistoryIndex((i) => Math.min(i + 1, history.length - 1));
      return;
    }

    // ArrowDown: 팝업 내에서 아래로 이동 또는 닫기
    if (e.key === "ArrowDown" && showHistoryPopup) {
      e.preventDefault();
      const next = selectedHistoryIndex - 1;
      if (next < 0) {
        setShowHistoryPopup(false);
        setInput(draftRef.current);
        draftRef.current = "";
      } else {
        setSelectedHistoryIndex(next);
      }
    }
  };

  return (
    <div
      className={`border-t px-2 pt-2 pb-1.5 shrink-0 transition-colors
        ${isDragging
          ? "border-blue-500 bg-blue-950/30"
          : "border-gray-800"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-950/60 rounded-lg pointer-events-none z-10">
          <div className="text-blue-300 text-sm font-medium">{t("input.dropHint")}</div>
        </div>
      )}

      {/* 상단 행: ModelSelector + 기능 버튼 + 🗑 */}
      <div className="flex items-center gap-1.5 mb-1.5 px-1">
        <ModelSelector />
        <div className="flex items-center gap-1 ml-1">
          {/* 스크린샷 버튼 */}
          <Tip label={t("input.screenshot")}>
            <button
              onClick={handleScreenshot}
              disabled={disabled}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <circle cx="12" cy="12" r="3" />
                <path d="M8 4V2M16 4V2" />
              </svg>
            </button>
          </Tip>
          {/* 전체 페이지 텍스트 저장 버튼 */}
          <Tip label={t("input.savePageText")}>
            <button
              onClick={handleSavePageText}
              disabled={disabled || isSavingText}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSavingText ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="13" y2="17" />
                </svg>
              )}
            </button>
          </Tip>
          {/* 전체 페이지 스크롤 스크린샷 버튼 */}
          <Tip label={isCapturingFull ? t("input.cancelCaptureConfirm") : t("input.fullScreenshot")}>
            <button
              onClick={isCapturingFull ? handleCancelCapture : handleSaveFullPageScreenshot}
              disabled={!isCapturingFull && disabled}
              className={`p-1 rounded transition-colors
                ${isCapturingFull
                  ? "text-red-400 hover:text-red-300 hover:bg-gray-700"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"}`}
            >
              {isCapturingFull ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </Tip>
          {/* 파일 첨부 버튼 */}
          <Tip label={t("input.attachFile")}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
          </Tip>
          {/* 화면 읽기 토글 버튼 */}
          <Tip label={usePageContext ? t("context.reading") : t("context.ignoring")}>
          <button
            onClick={togglePageContext}
            className={`relative p-1 rounded transition-colors
              ${usePageContext
                ? "text-emerald-400 hover:text-emerald-300 hover:bg-gray-700"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-700"}`}
          >
            {usePageContext && (
              <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
            )}
            {usePageContext ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
          </Tip>
          {/* 웹검색 토글 버튼 */}
          <Tip label={webSearchEnabled ? t("webSearch.active") : t("webSearch.inactive")}>
          <button
            onClick={toggleWebSearch}
            className={`relative p-1 rounded transition-colors
              ${webSearchEnabled
                ? "text-blue-400 hover:text-blue-300 hover:bg-gray-700"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-700"}`}
          >
            {webSearchEnabled && (
              <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5">
                {webSearchStatus === 'ready' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-400" />
                )}
              </span>
            )}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
          </Tip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,text/*,.md,.json,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.cpp,.c,.h,.css,.html,.xml,.yaml,.yml"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {onToggleHistory && (
            <button
              onClick={onToggleHistory}
              className="text-gray-600 hover:text-gray-400 transition-colors"
              title={t("input.history")}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          {onClear && (
            <button
              onClick={onClear}
              className="text-gray-600 hover:text-gray-400 text-sm transition-colors"
              title={t("input.newChat")}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* 첨부파일 미리보기 */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5 px-1">
          {pendingAttachments.map((att) => {
            const openAttachment = () => {
              if (att.type === "image" && att.dataUrl) {
                fetch(att.dataUrl)
                  .then((r) => r.blob())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    window.open(url);
                    setTimeout(() => URL.revokeObjectURL(url), 3000);
                  });
              } else if (att.type === "text" && att.text) {
                const blob = new Blob([att.text], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                window.open(url);
                setTimeout(() => URL.revokeObjectURL(url), 3000);
              }
            };
            return (
              <div
                key={att.id}
                className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1
                           text-xs text-gray-300 max-w-[160px]"
              >
                <button
                  onClick={openAttachment}
                  title={t("input.openAttachment")}
                  className="flex items-center gap-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  {att.type === "image" && att.dataUrl ? (
                    <img src={att.dataUrl} alt={att.name} className="w-5 h-5 rounded object-cover shrink-0" />
                  ) : (
                    <span className="shrink-0">📄</span>
                  )}
                  <span className="truncate">{att.name}</span>
                </button>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="shrink-0 text-gray-500 hover:text-gray-200 ml-0.5 transition-colors"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 입력 히스토리 팝업 */}
      {showHistoryPopup && historyRef.current.length > 0 && (
        <div
          className="mb-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-20"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 border-b border-gray-800 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{t("input.historyGuide")}</span>
          </div>
          {[...historyRef.current].reverse().map((item, visualIdx) => {
            const actualIdx = historyRef.current.length - 1 - visualIdx;
            return (
            <div
              key={actualIdx}
              onMouseDown={(e) => { e.preventDefault(); applyHistoryItem(item); }}
              onMouseEnter={() => setSelectedHistoryIndex(actualIdx)}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors truncate
                ${actualIdx === selectedHistoryIndex
                  ? "bg-blue-700 text-white"
                  : "text-gray-300 hover:bg-gray-800"}`}
              title={item}
            >
              {item.length > 100 ? item.slice(0, 100) + "…" : item}
            </div>
            );
          })}
        </div>
      )}

      {/* 텍스트 입력 행 */}
      <div
        className={`flex items-end gap-2 bg-gray-900 rounded-xl border px-3 py-2
                   focus-within:border-blue-600 transition-colors
                   ${pendingFocus ? "border-blue-500 ring-1 ring-blue-500/50 animate-pulse" : "border-gray-700"}`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // 타이핑 시 팝업 닫기
            if (showHistoryPopup) {
              setShowHistoryPopup(false);
              draftRef.current = "";
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onInput={() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
            }
          }}
          placeholder={t("input.placeholder")}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-sm resize-none outline-none placeholder-gray-600
                     disabled:opacity-50 min-h-[24px] text-gray-100"
        />
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="shrink-0 p-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
            title="ESC"
          >
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={send}
            disabled={disabled || (!input.trim() && pendingAttachments.length === 0)}
            className="shrink-0 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        )}
      </div>
      {showDebugLog && (
        <div className="mx-1 mt-1 bg-gray-950 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-gray-900 border-b border-gray-800">
            <span className="text-[10px] text-gray-400 font-mono">Debug Log</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const text = debugLogs.join("\n");
                  navigator.clipboard.writeText(text).catch(() => {});
                }}
                className="text-[10px] text-gray-500 hover:text-gray-200 px-1"
              >
                Copy
              </button>
              <button
                onClick={() => setShowDebugLog(false)}
                className="text-[10px] text-gray-500 hover:text-gray-200 px-1"
              >
                ✕
              </button>
            </div>
          </div>
          <div ref={debugLogRef} className="max-h-[150px] overflow-y-auto p-2 text-[9px] font-mono text-gray-400 space-y-0.5">
            {debugLogs.length === 0 ? (
              <p className="text-gray-600">No logs yet</p>
            ) : debugLogs.map((log, i) => (
              <p key={i} className="break-all leading-tight">{log}</p>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] text-gray-600 text-center mt-1">
        {t("input.hint")}
        {" · "}
        <a href="https://ko-fi.com/giljun" target="_blank" rel="noopener noreferrer"
           className="text-gray-400 hover:text-yellow-400 transition-colors">
          ☕ Coffee
        </a>
        {" · "}
        <button
          onClick={() => setShowDebugLog((v) => !v)}
          className={`${showDebugLog ? "text-yellow-400" : "text-gray-500 hover:text-gray-300"} transition-colors`}
        >
          🐛 Log
        </button>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as any)}
          className="ml-2 bg-transparent text-gray-500 text-[10px] border-none outline-none cursor-pointer hover:text-gray-300"
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l} className="bg-[#09090b]">{LOCALE_NAMES[l]}</option>
          ))}
        </select>
      </p>
    </div>
  );
}
