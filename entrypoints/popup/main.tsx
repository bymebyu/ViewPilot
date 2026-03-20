import React from "react";
import ReactDOM from "react-dom/client";
import "../../assets/globals.css";
import CopilotIcon from "../../components/CopilotIcon";
import { useTranslation } from "../../hooks/useTranslation";

function PopupApp() {
  const { t } = useTranslation();
  return (
    <div className="p-4 bg-[#09090b] text-gray-100 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <CopilotIcon size={22} />
        <span className="font-semibold">Copilot Sidebar</span>
      </div>
      <p className="text-gray-400 text-xs">
        {t("popup.hint")}
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
