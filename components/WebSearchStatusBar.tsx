import { useState } from "react";
import { useChatStore } from "../store/chat-store";
import { useTranslation } from "../hooks/useTranslation";

export default function WebSearchStatusBar() {
  const { webSearchEnabled, webSearchStatus, braveApiKey, setBraveApiKey, serperApiKey, setSerperApiKey } = useChatStore();
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput, setKeyInput] = useState(braveApiKey);
  const [serperKeyInput, setSerperKeyInput] = useState(serperApiKey);

  if (!webSearchEnabled) return null;

  const isReady = webSearchStatus === "ready";
  const activeEngine = serperApiKey ? "serper" : braveApiKey ? "brave" : "default";
  const statusText = activeEngine === "serper" ? t("webSearch.statusSerper")
    : activeEngine === "brave" ? t("webSearch.statusReady")
    : t("webSearch.statusDefault");

  return (
    <div className={`px-3 py-1.5 border-b border-gray-800 shrink-0 ${isReady ? "bg-blue-500/5" : "bg-yellow-500/5"}`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${isReady ? "bg-blue-400" : "bg-yellow-400"}`} />
          <span className={isReady ? "text-blue-300" : "text-yellow-300"}>
            {statusText}
          </span>
        </div>
        <button
          onClick={() => { setShowSettings((v) => !v); setKeyInput(braveApiKey); setSerperKeyInput(serperApiKey); }}
          className="text-gray-500 hover:text-gray-300 text-[10px] transition-colors"
        >
          {t("webSearch.settings")}
        </button>
      </div>

      {!isReady && !showSettings && (
        <p className="text-[10px] text-yellow-400/70 mt-0.5">{t("webSearch.configureKey")}</p>
      )}

      {showSettings && (
        <div className="mt-1.5 space-y-1.5">
          {/* Serper API Key */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-gray-500 shrink-0 w-16">Serper</label>
            <input
              type="password"
              value={serperKeyInput}
              onChange={(e) => setSerperKeyInput(e.target.value)}
              placeholder={t("webSearch.apiKeyPlaceholder")}
              className="flex-1 bg-gray-800 text-gray-100 text-[11px] rounded px-2 py-1 outline-none
                         border border-gray-700 focus:border-blue-500 placeholder-gray-600 min-w-0"
            />
            <button
              onClick={() => { setSerperApiKey(serperKeyInput); setShowSettings(false); }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded transition-colors shrink-0"
            >
              {t("webSearch.save")}
            </button>
            <a
              href="https://serper.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors shrink-0"
            >
              {t("webSearch.getFreeKey")}
            </a>
          </div>
          {/* Brave API Key */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-gray-500 shrink-0 w-16">Brave</label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={t("webSearch.apiKeyPlaceholder")}
              className="flex-1 bg-gray-800 text-gray-100 text-[11px] rounded px-2 py-1 outline-none
                         border border-gray-700 focus:border-blue-500 placeholder-gray-600 min-w-0"
            />
            <button
              onClick={() => { setBraveApiKey(keyInput); setShowSettings(false); }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded transition-colors shrink-0"
            >
              {t("webSearch.save")}
            </button>
            <a
              href="https://brave.com/search/api/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors shrink-0"
            >
              {t("webSearch.getFreeKey")}
            </a>
          </div>
          <p className="text-[10px] text-gray-600">{t("webSearch.noKeyHint")}</p>
        </div>
      )}
    </div>
  );
}
