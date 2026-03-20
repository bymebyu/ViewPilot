import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../../store/chat-store";
import { useLocaleStore } from "../../store/locale-store";
import { sendMessage, debugLog, getDebugLogs, onDebugLogChange } from "../../lib/browser-api";
import { VSCODE_CLIENT_ID } from "../../lib/auth";
import LoginScreen from "../../components/LoginScreen";
import DeviceCodeScreen from "../../components/DeviceCodeScreen";
import ChatWindow from "../../components/ChatWindow";

// 디버그 패널 표시 여부 — 문제 추적 시 true로 변경
const SHOW_DEBUG_PANEL = false;

function DebugPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    setLogs(getDebugLogs());
    return onDebugLogChange(() => setLogs(getDebugLogs()));
  }, []);
  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="fixed bottom-1 right-1 px-2 py-0.5 bg-gray-800 text-green-400 text-[9px] rounded z-50 opacity-60">LOG</button>
  );
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 text-[9px] text-green-400 font-mono p-2 max-h-40 overflow-y-auto z-50">
      <div className="flex gap-1 mb-1">
        <button onClick={() => navigator.clipboard.writeText(logs.join("\n"))}
          className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-[9px] hover:bg-gray-600">Copy</button>
        <button onClick={() => setOpen(false)}
          className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-[9px] hover:bg-gray-600">Close</button>
        <span className="text-gray-500 ml-1">browser: {import.meta.env.BROWSER}</span>
      </div>
      {logs.length === 0 ? <div className="text-gray-600">No logs</div> : logs.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}


type AppState = "checking" | "login" | "device-code" | "chat";

export default function App() {
  const [appState, setAppState] = useState<AppState>("checking");
  const [deviceCode, setDeviceCode] = useState<{
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    interval: number;
    autoOpening: boolean;
    expiresIn: number;
  } | null>(null);
  const { setLoggedIn } = useChatStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    debugLog(`App 마운트, browser=${import.meta.env.BROWSER}`);
    useLocaleStore.getState().initLocale();
    sendMessage<{ isLoggedIn: boolean }>({ type: "CHECK_AUTH" }).then((res) => {
      if (!res) {
        setAppState("login");
        return;
      }
      setLoggedIn(res.isLoggedIn);
      setAppState(res.isLoggedIn ? "chat" : "login");
    });
  }, []);

  // device-code 상태 진입 시 사이드패널에서 직접 폴링 시작
  useEffect(() => {
    if (appState !== "device-code" || !deviceCode) return;

    // device_code 만료 시 자동 중단 (expires_in 초 후)
    expiryRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      setAppState("login");
    }, (deviceCode.expiresIn || 900) * 1000);

    let currentInterval = (deviceCode.interval || 5) * 1000;
    let unmounted = false;

    const startPoll = () => {
      if (unmounted) return;
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: VSCODE_CLIENT_ID,
              device_code: deviceCode.deviceCode,
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            }),
          });
          const data = await res.json();

          if (data.access_token) {
            clearInterval(pollRef.current!);
            clearTimeout(expiryRef.current!);
            const r = await sendMessage<{ success: boolean; error?: string }>({ type: "COMPLETE_GITHUB_AUTH", githubToken: data.access_token });
            if (r?.success) { setLoggedIn(true); setAppState("chat"); }
            else { setAppState("login"); }
          } else if (data.error === "access_denied" || data.error === "expired_token") {
            clearInterval(pollRef.current!);
            clearTimeout(expiryRef.current!);
            setAppState("login");
          } else if (data.error === "slow_down") {
            // GitHub가 속도 줄이기 요청 → 인터벌 +5초로 재시작
            clearInterval(pollRef.current!);
            currentInterval += 5000;
            startPoll();
          }
          // "authorization_pending" → 계속 폴링
        } catch {
          // 네트워크 오류 → 무시하고 계속 폴링
        }
      }, currentInterval);
    };
    startPoll();

    return () => {
      unmounted = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (expiryRef.current) clearTimeout(expiryRef.current);
    };
  }, [appState, deviceCode]);

  const handleLoginStart = async () => {
    const res = await sendMessage<{ success: boolean; device_code: string; user_code: string; verification_uri: string; interval: number; autoOpening?: boolean; expires_in?: number }>({ type: "START_LOGIN" });
    if (res?.success) {
      setDeviceCode({
        deviceCode: res.device_code,
        userCode: res.user_code,
        verificationUri: res.verification_uri,
        interval: res.interval,
        autoOpening: res.autoOpening ?? false,
        expiresIn: res.expires_in ?? 900,
      });
      setAppState("device-code");
    }
  };

  let content;
  if (appState === "checking") {
    content = (
      <div className="flex items-center justify-center h-full bg-[#09090b]">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  } else if (appState === "login") {
    content = <LoginScreen onLoginStart={handleLoginStart} />;
  } else if (appState === "device-code" && deviceCode) {
    content = (
      <DeviceCodeScreen
        userCode={deviceCode.userCode}
        verificationUri={deviceCode.verificationUri}
        autoOpening={deviceCode.autoOpening}
      />
    );
  } else {
    content = <ChatWindow />;
  }

  return (
    <>
      {content}
      {SHOW_DEBUG_PANEL && <DebugPanel />}
    </>
  );
}
