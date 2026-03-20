import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useChatStore } from "../store/chat-store";
import { streamChatCompletion } from "../lib/copilot-api";
import type { ChatMessage } from "../lib/copilot-api";
import { loadIncompatibleModelIds, saveIncompatibleModelIds } from "../lib/storage";
import { buildSystemPrompt } from "../lib/viewport-extractor";
import MessageBubble, { copyOrDownload } from "./MessageBubble";
import InputBar from "./InputBar";
import ContextPanel from "./ContextPanel";
import WebSearchStatusBar from "./WebSearchStatusBar";
import QuotaIndicator from "./QuotaIndicator";
import CopilotIcon from "./CopilotIcon";
import ChatHistory from "./ChatHistory";
import { useTranslation } from "../hooks/useTranslation";
import { sendMessage, storageLocalGet, storageLocalRemove, tabsQuery, tabsSendMessage } from "../lib/browser-api";
import { VSCODE_CLIENT_ID } from "../lib/auth";
import { pickDefaultModel } from "../lib/models";

// 글꼴 크기 배율 — 레벨 5(기본)=100%, 각 단계 ±10%씩 변화
const FONT_SCALE_MAP: Record<number, number> = {
  1: 60, 2: 70, 3: 80, 4: 90, 5: 100, 6: 110, 7: 125, 8: 140, 9: 160, 10: 180,
};

type ReloginPhase = "idle" | "button" | "device-code";

function ReloginDeviceCodePanel({
  userCode, deviceCode, verificationUri, interval, autoOpening,
  onSuccess, onFail,
}: {
  userCode: string; deviceCode: string; verificationUri: string;
  interval: number; autoOpening: boolean;
  onSuccess: () => void; onFail: () => void;
}) {
  const { t } = useTranslation();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let currentInterval = (interval || 5) * 1000;
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
              device_code: deviceCode,
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            }),
          });
          const data = await res.json();
          if (data.access_token) {
            clearInterval(pollRef.current!);
            const r = await sendMessage<{ success: boolean }>({ type: "COMPLETE_GITHUB_AUTH", githubToken: data.access_token });
            if (r?.success) onSuccess(); else onFail();
          } else if (data.error === "access_denied" || data.error === "expired_token") {
            clearInterval(pollRef.current!);
            onFail();
          } else if (data.error === "slow_down") {
            clearInterval(pollRef.current!);
            currentInterval += 5000;
            startPoll();
          }
        } catch { /* network error, keep polling */ }
      }, currentInterval);
    };
    startPoll();
    return () => { unmounted = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [deviceCode, interval]);

  const openGitHub = () => {
    const url = `${verificationUri}?user_code=${encodeURIComponent(userCode)}`;
    chrome.tabs.create({ url });
  };

  return (
    <div className="border-t border-gray-800 px-3 py-3 shrink-0 space-y-2.5 bg-gray-950">
      {autoOpening ? (
        <p className="text-green-400 text-xs text-center">{t("auth.autoOpened")}</p>
      ) : (
        <p className="text-gray-400 text-xs text-center">{t("auth.enterCode")}</p>
      )}
      <div className="bg-gray-900 rounded-lg border border-gray-700 py-2 text-center">
        <p className="text-xl font-mono font-bold tracking-widest text-blue-400 select-all">{userCode}</p>
      </div>
      <button
        onClick={openGitHub}
        className="w-full py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg
                   text-xs transition border border-gray-700"
      >
        {autoOpening ? t("auth.reopenPage") : t("auth.openPage")}
      </button>
      <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
        <div className="animate-spin w-3 h-3 border-2 border-gray-500 border-t-blue-400 rounded-full" />
        <span>{t("auth.waiting")}</span>
      </div>
    </div>
  );
}

export default function ChatWindow() {
  const { t, locale } = useTranslation();
  const {
    messages, isLoading, selectedModel,
    viewportContext, usePageContext,
    addMessage, appendToLastMessage, setLoading, clearMessages, popLastMessage,
    pendingAttachments, clearAttachments, setQuota,
    availableModels, setAvailableModels, setSelectedModel,
    initFromStorage, startNewConversation, saveCurrentConversation,
    setLoggedIn,
    fontSize, setFontSize,
  } = useChatStore();
  const [showHistory, setShowHistory] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const [sessionCopied, setSessionCopied] = useState(false);
  const [reloginPhase, setReloginPhase] = useState<ReloginPhase>("idle");
  const [reloginCode, setReloginCode] = useState<{ userCode: string; deviceCode: string; verificationUri: string; interval: number; autoOpening: boolean } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunkBufferRef = useRef("");
  const rafIdRef = useRef<number | null>(null);

  const matchingIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.reduce<number[]>((acc, msg, i) => {
      if (msg.content.toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [messages, searchQuery]);

  useEffect(() => {
    if (showSearch) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      setSearchQuery("");
      setCurrentMatchIdx(0);
    }
  }, [showSearch]);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchQuery]);

  useEffect(() => {
    if (matchingIndices.length === 0) return;
    const idx = matchingIndices[currentMatchIdx];
    const msgId = messages[idx]?.id;
    if (!msgId) return;
    const msgEl = document.getElementById(`msg-${msgId}`);
    if (!msgEl) return;
    const mark = msgEl.querySelector("mark");
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentMatchIdx, matchingIndices, messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 글꼴 크기 → <html> 루트 font-size 조절 (rem 기반 Tailwind 전체 반영, Chrome+Firefox 호환)
  useEffect(() => {
    const scale = FONT_SCALE_MAP[fontSize] ?? 100;
    document.documentElement.style.fontSize = `${scale}%`;
    return () => { document.documentElement.style.fontSize = ""; };
  }, [fontSize]);

  useEffect(() => {
    if (!showFontSize) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) {
        setShowFontSize(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFontSize]);

  const handleCopySession = async () => {
    const date = new Date().toLocaleString("ko-KR");
    const parts = [t("chat.sessionHeader") + `\n${date}\n`];
    for (const m of messages) {
      parts.push("---");
      parts.push(m.role === "user" ? `**User**\n\n${m.content}` : `**Copilot**\n\n${m.content}`);
    }
    const text = parts.join("\n\n");
    const ok = await copyOrDownload(text, `copilot-session-${Date.now()}.md`, t("bubble.clipboardFull"));
    if (ok) {
      setSessionCopied(true);
      setTimeout(() => setSessionCopied(false), 2000);
    }
  };
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const lastWatchingTabIdRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    programmaticScrollRef.current = true;
    if (isStreamingRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    requestAnimationFrame(() => { programmaticScrollRef.current = false; });
  }, []);

  const handleScroll = useCallback(() => {
    // scrollToBottom()에 의한 스크롤 이벤트는 무시 — 사용자 스크롤만 추적
    if (programmaticScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distFromBottom > 80;
  }, []);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // 스트리밍 중 자동 스크롤 — 사용자가 위로 스크롤했으면 무시
  const lastMsgContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (isStreamingRef.current && !userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [lastMsgContent, scrollToBottom]);

  // ESC 키로 스트리밍/검색 중단
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLoading) {
        e.preventDefault();
        abortControllerRef.current?.abort();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading]);

  useEffect(() => {
    refreshViewportContext(3, 600, true);
    startWatchingActiveTab();

    // 탭 전환 시 새 탭 컨텍스트로 갱신
    const handleTabActivated = () => {
      refreshViewportContext(3, 600, true);
      startWatchingActiveTab();
    };

    // 동일 탭에서 페이지 이동 완료 시 갱신
    const handleTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (tab.active && changeInfo.status === "complete") {
        refreshViewportContext(3, 600, true);
        startWatchingActiveTab();
      }
    };

    const msgListener = (
      msg: { type: string; context: unknown },
      sender: chrome.runtime.MessageSender
    ) => {
      if (msg.type === "VIEWPORT_UPDATED" && sender.tab?.id) {
        chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
          if (chrome.runtime.lastError) return;
          if (activeTab?.id === sender.tab!.id) {
            useChatStore.getState().setViewportContext(msg.context as never);
          }
        });
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.runtime.onMessage.addListener(msgListener);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.runtime.onMessage.removeListener(msgListener);
    };
  }, []);

  useEffect(() => {
    const checkPendingAction = () => {
      storageLocalGet("pendingAction").then((result) => {
        if (result.pendingAction?.type === "PREFILL_QUESTION") {
          const text = result.pendingAction.text;
          storageLocalRemove("pendingAction");
          if (text) useChatStore.getState().setPrefillText(`"${text}"\n`);
        }
      });
    };
    checkPendingAction();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes.pendingAction?.newValue) checkPendingAction();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function refreshQuota() {
    const res = await sendMessage<{ success: boolean; used: number; total: number; unlimited: boolean; resetDate: string }>({ type: "GET_QUOTA" });
    if (res?.success) {
      setQuota({ used: res.used, total: res.total, unlimited: res.unlimited, resetDate: res.resetDate });
    }
  }

  useEffect(() => { refreshQuota(); }, []);
  useEffect(() => { initFromStorage(); }, []);

  async function refreshViewportContext(retries = 3, retryDelayMs = 600, reinject = false): Promise<import("../lib/viewport-extractor").ViewportContext | null> {
    const [tab] = await tabsQuery({ active: true, currentWindow: true });
    if (!tab?.id) return null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelayMs));
      const result = await new Promise<import("../lib/viewport-extractor").ViewportContext | null>((resolve) => {
        chrome.tabs.sendMessage(tab.id!, { type: "GET_VIEWPORT_CONTEXT" }, (res) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          if (res?.success) {
            useChatStore.getState().setViewportContext(res.context);
            resolve(res.context);
          } else {
            resolve(null);
          }
        });
      });
      if (result !== null) return result;
    }

    if (reinject) {
      const reinjectRes = await sendMessage<{ success: boolean }>({ type: "REINJECT_CONTENT_SCRIPT" });
      if (reinjectRes?.success) {
        await new Promise((r) => setTimeout(r, 800));
        return refreshViewportContext(1, 300, false);
      }
    }
    return null;
  }

  function startWatchingActiveTab() {
    tabsQuery({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab) return;
      if (lastWatchingTabIdRef.current !== null && lastWatchingTabIdRef.current !== tab?.id) {
        tabsSendMessage(lastWatchingTabIdRef.current, { type: "STOP_WATCHING" }).catch(() => {});
      }
      if (tab?.id) {
        tabsSendMessage(tab.id, { type: "START_WATCHING" }).catch(() => {});
        lastWatchingTabIdRef.current = tab.id;
      }
    });
  }

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleSend = async (userInput: string): Promise<boolean> => {
    if (!userInput.trim() && pendingAttachments.length === 0) return false;
    if (isLoading) return false;

    userScrolledUpRef.current = false;

    let latestCtx = await refreshViewportContext(0);

    const atts = useChatStore.getState().pendingAttachments;

    // Google Docs: Canvas 렌더링 모드 — DOM 텍스트가 없으면 자동 스크린샷으로 Vision 컨텍스트 제공
    // 단, 명시적 첨부파일이 있으면 스크린샷 생략 (첨부파일 우선)
    let googleDocsScreenshot: string | undefined;
    if (atts.length === 0 && usePageContext && latestCtx?.url.includes("docs.google.com") && latestCtx.visibleText.length < 300) {
      const ssRes = await sendMessage<{ success: boolean; dataUrl?: string }>({ type: "CAPTURE_SCREENSHOT" });
      if (ssRes?.success && ssRes.dataUrl) {
        googleDocsScreenshot = ssRes.dataUrl;
        latestCtx = { ...latestCtx, visibleText: "[Document content is in the attached screenshot image. Answer based on the visible text in the image.]" };
      }
    }

    // 메시지 저장 (첨부파일 포함)
    addMessage({ role: "user", content: userInput, attachments: atts.length > 0 ? [...atts] : undefined });
    setLoading(true);

    // 토큰 획득 — 실패 시 자동 재시도 (사용자에게 보이지 않음)
    async function getToken(): Promise<{ token: string; vsCodeVersion: string } | null> {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await sendMessage<{ success: boolean; token: string; vsCodeVersion: string; error?: string }>({ type: "GET_COPILOT_TOKEN" });
        if (r?.success) return { token: r.token, vsCodeVersion: r.vsCodeVersion };
        if (r?.error === "LOGIN_REQUIRED") {
          addMessage({ role: "assistant", content: `⚠️ ${t("error.LOGIN_REQUIRED")}` });
          setReloginPhase("button");
          return null;
        }
        if (attempt === 0) await new Promise((w) => setTimeout(w, 1000));
      }
      addMessage({ role: "assistant", content: `⚠️ ${t("error.TOKEN_REFRESH_FAILED")}` });
      return null;
    }

    const tokenData = await getToken();
    if (!tokenData) { setLoading(false); return; }

    const { webSearchEnabled: wsEnabledForPrompt } = useChatStore.getState();
    const webSearchPrompt = wsEnabledForPrompt
      ? "\nYou have access to a web_search tool. Use it when: (1) the user explicitly asks to search the web, (2) current/real-time information would improve the answer, (3) you're unsure and web results would help, or (4) the user asks for links or references. When web search results are provided, combine them with any visible page context to give a comprehensive answer."
      : "";

    const langMap: Record<string, string> = { ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese", es: "Spanish" };
    const langInstruction = langMap[locale] ? `You MUST respond in ${langMap[locale]}.` : "Respond in the same language as the user.";

    const basePrompt = usePageContext && latestCtx
      ? buildSystemPrompt(latestCtx, locale)
      : `You are an adaptive expert assistant. Automatically identify the domain of the user's question and context (e.g., software engineering, system architecture, data science, medicine, law, finance, writing, design, etc.) and respond as a seasoned expert in that domain. If the question spans multiple domains, cover each with the appropriate expertise. Be helpful and concise. ${langInstruction}`;

    const formatRules = " Always format your response in Markdown. When including tables, use standard Markdown (GFM) pipe-table syntax with pipe delimiters and a separator row (|---|---|). When including multi-line diagrams, flowcharts, or ASCII art, always wrap them in a fenced code block (```text or ```). Single-line inline notation (e.g., A → B) does not need a code block. When including code, follow these rules without exception: (1) Always use fenced code blocks with the correct language identifier (e.g., ```python, ```typescript, ```cpp). (2) Before outputting any code, perform a strict character-level check on these high-error punctuation marks — Quotes: every ' or \" must be matched; Parentheses: every ( must have a ); Brackets: every [ must have a ]; Braces: every { must have a }; Semicolons: every statement requiring ; must have one. (3) Also verify: no truncated lines, no missing operators, no broken string literals, consistent indentation. (4) Never output syntactically broken or incomplete code — if uncertain, fix it first or omit it and explain in text instead.";

    const nowTime = `\n\nNOW_TIME: ${new Date().toISOString()} (user's local: ${new Date().toLocaleString()})`;
    const systemContent = basePrompt + webSearchPrompt + formatRules + nowTime;

    // 현재 유저 메시지의 content 빌드 (멀티모달)
    let userContent: ChatMessage["content"];
    if (atts.length > 0 || googleDocsScreenshot) {
      const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
      let textContent = userInput;
      for (const att of atts) {
        if (att.type === "text" && att.text) {
          textContent += `\n\n[Attached file: ${att.name}]\n\`\`\`\n${att.text.slice(0, 8000)}\n\`\`\``;
        }
      }
      parts.push({ type: "text", text: textContent });
      for (const att of atts) {
        if (att.type === "image" && att.dataUrl) {
          parts.push({ type: "image_url", image_url: { url: att.dataUrl } });
        }
      }
      if (googleDocsScreenshot) {
        parts.push({ type: "image_url", image_url: { url: googleDocsScreenshot } });
      }
      userContent = parts;
    } else {
      userContent = userInput;
    }

    const apiMessages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userContent },
    ];

    // 스트리밍 — 401 시 자동으로 토큰 갱신 후 재시도
    async function tryStream(token: string, vsCodeVersion: string): Promise<boolean> {
      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // 청크 배칭: requestAnimationFrame으로 묶어서 렌더링 횟수 감소
        const flushBuffer = () => {
          if (chunkBufferRef.current) {
            appendToLastMessage(chunkBufferRef.current);
            chunkBufferRef.current = "";
          }
          rafIdRef.current = null;
        };
        const scheduleFlush = () => {
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(flushBuffer);
          }
        };

        const { webSearchEnabled: wsEnabled, braveApiKey: wsApiKey, serperApiKey: wsSerperKey } = useChatStore.getState();
        const webSearchConfig = wsEnabled ? {
          enabled: true,
          apiKey: wsSerperKey || wsApiKey || undefined,
          engine: (wsSerperKey ? 'serper' : wsApiKey ? 'brave' : 'duckduckgo') as 'brave' | 'serper' | 'duckduckgo',
        } : undefined;

        const currentModel = availableModels.find((m) => m.id === selectedModel);
        for await (const chunk of streamChatCompletion(apiMessages, token, vsCodeVersion, selectedModel, controller.signal, webSearchConfig, currentModel?.supportedEndpoints)) {
          chunkBufferRef.current += chunk;
          scheduleFlush();
        }
        // 잔여 버퍼 최종 플러시
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
        flushBuffer();
        abortControllerRef.current = null;
        return true;
      } catch (err) {
        // 잔여 버퍼 플러시
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
        if (chunkBufferRef.current) { appendToLastMessage(chunkBufferRef.current); chunkBufferRef.current = ""; }
        abortControllerRef.current = null;

        const error = err as Error & { incompatibleModelId?: string; statusCode?: number };
        if (error.name === "AbortError") return true; // 사용자 취소 — 성공 취급
        if (error.incompatibleModelId) {
          popLastMessage();
          const modelId = error.incompatibleModelId;
          const existing = await loadIncompatibleModelIds();
          if (!existing.includes(modelId)) {
            await saveIncompatibleModelIds([...existing, modelId]);
          }
          const nextModels = availableModels.filter((m) => m.id !== modelId);
          setAvailableModels(nextModels);
          const fallback = pickDefaultModel(nextModels);
          if (fallback) setSelectedModel(fallback.id);
          return false;
        }
        if (error.statusCode === 401) throw error; // 401은 상위에서 처리
        const msg = error.statusCode
          ? t("error.apiError", { status: error.statusCode })
          : error.message;
        appendToLastMessage(`\n\n⚠️ ${msg}`);
        return false;
      }
    }

    isStreamingRef.current = true;
    addMessage({ role: "assistant", content: "" });

    let sendSuccess: boolean;
    try {
      sendSuccess = await tryStream(tokenData.token, tokenData.vsCodeVersion);
    } catch (err) {
      // 401: 토큰 만료 → 자동 갱신 후 재시도 (사용자에게 보이지 않음)
      const freshToken = await getToken();
      if (freshToken) {
        popLastMessage();
        addMessage({ role: "assistant", content: "" });
        sendSuccess = await tryStream(freshToken.token, freshToken.vsCodeVersion);
      } else {
        sendSuccess = false;
      }
    }

    if (sendSuccess) clearAttachments();
    isStreamingRef.current = false;
    setLoading(false);
    refreshQuota();
    saveCurrentConversation();
    return sendSuccess;
  };

  const lastMsg = messages[messages.length - 1];
  const showTypingDots = isLoading && lastMsg?.role === "user";

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-gray-100 font-sans">
      <div className="flex items-center px-3 py-2 border-b border-gray-800 bg-gray-900 shrink-0">
        <CopilotIcon size={20} />
        <span className="text-sm font-semibold ml-1">ViewPilot</span>
        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full ml-2">Ask</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowSearch((v) => !v)}
          className={`p-1 rounded transition-colors text-sm mr-1
            ${showSearch ? "text-blue-400 bg-gray-700" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"}`}
          title={t("chat.searchTitle")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <div className="relative" ref={fontSizeRef}>
          <button
            onClick={() => setShowFontSize((v) => !v)}
            className={`p-1 rounded transition-colors text-sm mr-1 font-bold
              ${showFontSize ? "text-blue-400 bg-gray-700" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"}`}
            title={t("chat.fontSize")}
            style={{ fontSize: "12px", lineHeight: 1, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            T
          </button>
          {showFontSize && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-3 w-48">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{t("chat.fontSize")}</span>
                <span className="text-xs text-gray-300 font-mono">{fontSize}/10</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize(fontSize - 1)}
                  disabled={fontSize <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                >
                  −
                </button>
                <div className="flex-1 relative h-1.5 bg-gray-700 rounded-full">
                  <div
                    className="absolute h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${((fontSize - 1) / 9) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => setFontSize(fontSize + 1)}
                  disabled={fontSize >= 10}
                  className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold"
                >
                  +
                </button>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                <span style={{ fontSize: "9px" }}>A</span>
                <span style={{ fontSize: "13px" }}>A</span>
              </div>
            </div>
          )}
        </div>
        <QuotaIndicator />
      </div>

      {showSearch && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matchingIndices.length > 0)
                  setCurrentMatchIdx((i) => (i + 1) % matchingIndices.length);
              }
              if (e.key === "Escape") setShowSearch(false);
            }}
            placeholder={t("chat.searchPlaceholder")}
            className="flex-1 bg-gray-800 text-gray-100 text-xs rounded px-2 py-1 outline-none
                       border border-gray-700 focus:border-blue-500 placeholder-gray-600 min-w-0"
          />
          <span className="text-[10px] text-gray-500 shrink-0 w-12 text-center">
            {searchQuery.trim()
              ? matchingIndices.length > 0
                ? `${currentMatchIdx + 1}/${matchingIndices.length}`
                : t("chat.noResults")
              : ""}
          </span>
          <button
            onClick={() => matchingIndices.length > 0 && setCurrentMatchIdx((i) => (i - 1 + matchingIndices.length) % matchingIndices.length)}
            disabled={matchingIndices.length === 0}
            className="p-0.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
            title={t("common.prev")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            onClick={() => matchingIndices.length > 0 && setCurrentMatchIdx((i) => (i + 1) % matchingIndices.length)}
            disabled={matchingIndices.length === 0}
            className="p-0.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
            title={t("common.next")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-0.5 text-gray-500 hover:text-gray-200 transition-colors"
            title={t("common.close")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <ChatHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />

      <ContextPanel />
      <WebSearchStatusBar />

      <div className="flex-1 overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-3 space-y-3 select-text"
        >
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-12 text-sm select-none">
              <CopilotIcon size={52} className="mx-auto mb-3" />
              <p className="font-medium text-gray-400">{t("chat.emptyTitle")}</p>
              <p className="mt-1 text-xs">{t("chat.emptySubtitle")}</p>
              <a
                href="https://ko-fi.com/giljun"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 text-xs text-gray-400 hover:text-yellow-400 bg-gray-800/50 hover:bg-gray-800 rounded-full transition-colors"
              >
                ☕ {t("chat.supportKofi")}
              </a>
              <p className="mt-3 text-[10px] text-gray-600">{t("chat.disclaimer")}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={msg.id} id={`msg-${msg.id}`}>
              <MessageBubble
                message={msg}
                isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                searchQuery={searchQuery.trim() || undefined}
                isCurrentMatch={matchingIndices[currentMatchIdx] === i}
              />
            </div>
          ))}
          {showTypingDots && (
            <div className="flex items-end gap-1.5 pl-2 pb-1">
              {[0, 0.2, 0.4].map((delay, i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-gray-500 animate-typing-dot"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleCopySession}
            className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded
                       bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-gray-400 hover:text-white transition-all opacity-60 hover:opacity-100"
            title={t("chat.copySession")}
          >
            {sessionCopied ? t("common.copied") : t("chat.copySessionBtn")}
          </button>
        )}
      </div>

      {reloginPhase === "button" && (
        <div className="border-t border-gray-800 px-3 py-2.5 shrink-0 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 text-xs">
            <span>⚠️</span>
            <span>{t("error.LOGIN_REQUIRED")}</span>
          </div>
          <button
            onClick={async () => {
              const res = await sendMessage<{ success: boolean; device_code: string; user_code: string; verification_uri: string; interval: number; autoOpening?: boolean }>({ type: "START_LOGIN" });
              if (!res?.success) return;
              setReloginCode({
                userCode: res.user_code,
                deviceCode: res.device_code,
                verificationUri: res.verification_uri,
                interval: res.interval,
                autoOpening: res.autoOpening ?? false,
              });
              setReloginPhase("device-code");
              if (res.autoOpening) {
                const url = `${res.verification_uri}?user_code=${encodeURIComponent(res.user_code)}`;
                chrome.tabs.create({ url });
              }
            }}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg
                       font-medium text-sm transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
            {t("login.button")}
          </button>
        </div>
      )}
      {reloginPhase === "device-code" && reloginCode && (
        <ReloginDeviceCodePanel
          userCode={reloginCode.userCode}
          deviceCode={reloginCode.deviceCode}
          verificationUri={reloginCode.verificationUri}
          interval={reloginCode.interval}
          autoOpening={reloginCode.autoOpening}
          onSuccess={() => {
            setReloginPhase("idle");
            setReloginCode(null);
            setLoggedIn(true);
          }}
          onFail={() => {
            setReloginPhase("button");
            setReloginCode(null);
          }}
        />
      )}
      {reloginPhase === "idle" && (
        <InputBar
          onSend={handleSend}
          disabled={isLoading}
          onClear={startNewConversation}
          onToggleHistory={() => setShowHistory((v) => !v)}
          onCancel={handleCancel}
          isStreaming={isLoading}
        />
      )}
    </div>
  );
}
