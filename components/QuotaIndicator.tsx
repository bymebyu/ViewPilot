import { useChatStore } from "../store/chat-store";
import { useTranslation } from "../hooks/useTranslation";

export default function QuotaIndicator() {
  const premiumQuota = useChatStore((s) => s.premiumQuota);
  const { t } = useTranslation();

  if (!premiumQuota) return null;

  if (premiumQuota.unlimited) {
    return (
      <span className="text-[10px] text-gray-400 whitespace-nowrap" title={t("quota.unlimitedTooltip")}>
        {t("quota.unlimited")}
      </span>
    );
  }

  const { used, total, resetDate } = premiumQuota;
  const remaining = total - used;
  const pct = total > 0 ? (used / total) * 100 : 0;

  const barColor = pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-yellow-500" : "bg-blue-500";
  const textColor = pct >= 80 ? "text-red-400" : pct >= 50 ? "text-yellow-400" : "text-gray-400";

  const resetLabel = resetDate
    ? `${t("quota.resetPrefix")}${new Date(resetDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`
    : "";

  return (
    <div
      className="flex items-center gap-1.5"
      title={t("quota.premiumTooltip", { used, total }) + (resetLabel ? ` · ${resetLabel}` : "")}
    >
      <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-[10px] ${textColor} whitespace-nowrap`}>
        💎 {remaining}/{total}
      </span>
    </div>
  );
}
