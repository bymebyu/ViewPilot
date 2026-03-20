import { useTranslation } from "../hooks/useTranslation";

export default function DeviceCodeScreen({
  userCode,
  verificationUri,
  autoOpening = false,
}: {
  userCode: string;
  verificationUri: string;
  autoOpening?: boolean;
}) {
  const { t } = useTranslation();

  const openGitHub = () => {
    const url = `${verificationUri}?user_code=${encodeURIComponent(userCode)}`;
    chrome.tabs.create({ url });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#09090b] text-gray-100 p-8 gap-6">
      <div className="text-center">
        <p className="text-3xl mb-3">{autoOpening ? "✨" : "🔑"}</p>
        <h2 className="text-lg font-bold mb-1">{t("auth.title")}</h2>
        {autoOpening ? (
          <p className="text-green-400 text-sm font-medium">
            {t("auth.autoOpened")}
          </p>
        ) : (
          <p className="text-gray-400 text-sm">{t("auth.enterCode")}</p>
        )}
      </div>

      {autoOpening ? (
        <div className="w-full bg-green-950/30 rounded-xl border border-green-800 p-4 text-center space-y-2">
          <p className="text-green-300 text-sm">
            {t("auth.clickAuthorize", { buttonName: "Authorize GitHub Copilot" })}
          </p>
          <p className="text-gray-500 text-xs">{t("auth.codeAutoFilled")}</p>
        </div>
      ) : (
        <div className="w-full bg-gray-900 rounded-xl border border-gray-700 p-4 text-center">
          <p className="text-3xl font-mono font-bold tracking-widest text-blue-400 select-all">
            {userCode}
          </p>
        </div>
      )}

      {!autoOpening && (
        <button
          onClick={openGitHub}
          className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg
                     font-medium transition"
        >
          {t("auth.openPage")}
        </button>
      )}

      {autoOpening && (
        <button
          onClick={openGitHub}
          className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg
                     text-sm transition border border-gray-700"
        >
          {t("auth.reopenPage")}
        </button>
      )}

      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <div className="animate-spin w-4 h-4 border-2 border-gray-500 border-t-blue-400 rounded-full" />
        <span>{t("auth.waiting")}</span>
      </div>
    </div>
  );
}
