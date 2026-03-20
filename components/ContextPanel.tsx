import { useChatStore } from "../store/chat-store";
import { useTranslation } from "../hooks/useTranslation";

export default function ContextPanel() {
  const { viewportContext, usePageContext, togglePageContext } = useChatStore();
  const { t } = useTranslation();
  if (!viewportContext) return null;

  const { url, scrollPosition, pageType, selectedText } = viewportContext;
  const shortUrl = url.replace(/^https?:\/\//, "").slice(0, 45);
  const icons: Record<string, string> = {
    "github-pr": "🔀", "github-issue": "🐛", "github-code": "📝", "general": "🌐",
  };

  return (
    <div
      className={`mx-2 my-1 rounded-lg border text-xs transition-all duration-200
        ${usePageContext
          ? "bg-emerald-950/60 border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
          : "bg-gray-900/80 border-gray-700/60"}`}
    >
      <div className="flex items-center justify-between px-3 py-2 gap-3">
        {/* URL + scroll info */}
        <div className={`flex items-center gap-1.5 min-w-0 ${usePageContext ? "text-gray-200" : "text-gray-500"}`}>
          <span>{icons[pageType] ?? "🌐"}</span>
          <span className="truncate" title={url}>{shortUrl}</span>
          <span className={`shrink-0 ${usePageContext ? "text-gray-400" : "text-gray-600"}`}>
            ({scrollPosition}%)
          </span>
        </div>

        {/* Toggle button */}
        <button
          onClick={togglePageContext}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all duration-200
            ${usePageContext
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              : "bg-gray-700/80 hover:bg-gray-600 text-gray-400"}`}
        >
          {usePageContext ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
              </span>
              <span>👁️ {t("context.reading")}</span>
            </>
          ) : (
            <>
              <span className="inline-flex h-2 w-2 rounded-full bg-gray-500" />
              <span>OFF</span>
            </>
          )}
        </button>
      </div>

      {/* Selected text preview */}
      {selectedText && usePageContext && (
        <div className="px-3 pb-2 text-yellow-300/90 italic">
          {t("context.selectedPrefix")}"{selectedText.slice(0, 80)}{selectedText.length > 80 ? "…" : ""}"
        </div>
      )}
    </div>
  );
}
