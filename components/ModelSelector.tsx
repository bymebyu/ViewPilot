import { useEffect, useMemo } from "react";
import { useChatStore } from "../store/chat-store";
import { fetchAvailableModels, pickDefaultModel } from "../lib/models";
import type { CopilotModel } from "../lib/models";
import { saveLastModel } from "../lib/storage";
import { useTranslation } from "../hooks/useTranslation";

function formatModelLabel(m: CopilotModel): string {
  const preview = m.preview && !m.name.includes("Preview") ? " (Preview)" : "";
  const ctx = m.maxPromptTokens ? ` ${Math.round(m.maxPromptTokens / 1000)}K` : "";
  const mult = m.multiplier === undefined ? ""
    : m.multiplier === 0 ? " · Free"
    : ` · ${m.multiplier}x`;
  return `${m.name}${preview}${ctx ? ` (${ctx.trim()})` : ""}${mult}`;
}

function tierLabel(multiplier: number | undefined): string {
  if (multiplier === undefined) return "── Other ──";
  if (multiplier === 0) return "── Free ──";
  if (multiplier < 1) return `── Premium ${multiplier}x ──`;
  if (multiplier === 1) return "── Premium 1x ──";
  return `── Premium ${multiplier}x ──`;
}

export default function ModelSelector() {
  const { availableModels, selectedModel, setAvailableModels, setSelectedModel } = useChatStore();
  const { t } = useTranslation();

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_COPILOT_TOKEN" }, async (res) => {
      if (chrome.runtime.lastError || !res?.success) return;
      const models = await fetchAvailableModels(res.token, res.vsCodeVersion);
      setAvailableModels(models);
      if (models.length > 0 && !models.find((m) => m.id === selectedModel)) {
        const fallback = pickDefaultModel(models);
        if (fallback) setSelectedModel(fallback.id);
      }
    });
  }, []);

  // 비용 티어별 구분선 삽입
  const optionsWithSeparators = useMemo(() => {
    const items: { type: "separator"; label: string }[] | { type: "model"; model: CopilotModel }[] = [];
    let lastTier: number | undefined | null = null;

    for (const m of availableModels) {
      const tier = m.multiplier;
      if (tier !== lastTier) {
        (items as { type: string; label?: string; model?: CopilotModel }[]).push({ type: "separator", label: tierLabel(tier) });
        lastTier = tier;
      }
      (items as { type: string; label?: string; model?: CopilotModel }[]).push({ type: "model", model: m });
    }
    return items as ({ type: "separator"; label: string } | { type: "model"; model: CopilotModel })[];
  }, [availableModels]);

  return (
    <div className="flex items-center gap-1">
      <select
        value={selectedModel}
        onChange={(e) => {
          setSelectedModel(e.target.value);
          saveLastModel(e.target.value);
        }}
        className="text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1
                   focus:outline-none focus:border-blue-500 cursor-pointer max-w-[220px]"
        title={t("model.select")}
      >
        {optionsWithSeparators.map((item, i) =>
          item.type === "separator" ? (
            <option key={`sep-${i}`} disabled value="">
              {item.label}
            </option>
          ) : (
            <option key={item.model.id} value={item.model.id}>
              {formatModelLabel(item.model)}
            </option>
          )
        )}
      </select>
      {(() => {
        const current = availableModels.find((m) => m.id === selectedModel);
        if (!current) return null;
        if (current.multiplier === undefined) return null;
        return current.multiplier > 0 ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 whitespace-nowrap"
                title={t("model.premiumTooltip", { multiplier: current.multiplier })}>
            {t("model.premium", { multiplier: current.multiplier })}
          </span>
        ) : (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 whitespace-nowrap"
                title={t("model.freeTooltip")}>
            {t("model.free")}
          </span>
        );
      })()}
    </div>
  );
}
