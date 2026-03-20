import { useRef } from "react";
import { useChatStore } from "../store/chat-store";
import type { Conversation } from "../lib/storage";
import { useTranslation } from "../hooks/useTranslation";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getFirstAssistantPreview(conv: Conversation): string {
  const first = conv.messages?.find(m => m.role === "assistant");
  if (!first?.content) return "";
  return first.content
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/`[^`]+`/g, "`code`")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "[image]")
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

export default function ChatHistory({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    conversations,
    currentConversationId,
    loadConversation,
    deleteConversation,
    startNewConversation,
    importConversations,
  } = useChatStore();

  const importRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = JSON.stringify({ version: 1, exportedAt: Date.now(), conversations }, null, 2);
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `copilot-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const list: Conversation[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.conversations)
          ? parsed.conversations
          : [];
        if (list.length === 0) { alert(t("history.invalidFile")); return; }
        importConversations(list);
        alert(t("history.importSuccess", { count: list.length }));
      } catch {
        alert(t("history.importError"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div className="bg-gray-900 border-b border-gray-800 shrink-0">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-gray-300">{t("history.title")}</span>
        <div className="flex items-center gap-2">
          {/* 내보내기 */}
          <button
            onClick={handleExport}
            disabled={conversations.length === 0}
            className="text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
            title={t("history.exportTooltip")}
          >
            {t("history.export")}
          </button>
          {/* 가져오기 */}
          <button
            onClick={() => importRef.current?.click()}
            className="text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
            title={t("history.importTooltip")}
          >
            {t("history.import")}
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => { startNewConversation(); onClose(); }}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t("history.newChat")}
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="text-center text-gray-600 text-xs py-6">
            {t("history.empty")}
          </div>
        ) : (
          conversations.map((conv: Conversation) => (
            <div
              key={conv.id}
              onClick={() => { loadConversation(conv.id); onClose(); }}
              className={`group flex items-start px-3 py-2 cursor-pointer transition-colors ${
                conv.id === currentConversationId
                  ? "bg-blue-900/30 hover:bg-blue-900/40"
                  : "hover:bg-gray-800"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 line-clamp-1">{conv.title}</p>
                <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                  {getFirstAssistantPreview(conv)}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {formatDate(conv.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs ml-2 shrink-0 transition-opacity"
                title={t("history.delete")}
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>
      <div className="px-3 py-2 border-t border-gray-800 text-center">
        <a
          href="https://ko-fi.com/giljun"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gray-500 hover:text-yellow-400 transition-colors"
        >
          ☕ {t("chat.supportKofi")}
        </a>
      </div>
    </div>
  );
}
