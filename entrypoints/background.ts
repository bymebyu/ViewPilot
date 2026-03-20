import { requestDeviceCode, pollForGitHubToken, getCopilotToken, getLatestVSCodeVersion, openDeviceAuthTab, checkGitHubLogin } from "../lib/auth";
import { storage } from "../lib/storage";
import { devLogger, DEV_MODE } from "../lib/dev-logger";
import { setSidePanelBehavior, openSidePanel, getCaptureDelayMs, isOffscreenCanvasSupported, storageSessionGet, storageSessionSet, storageLocalSet, tabsQuery, tabsCaptureVisibleTab, scriptingExecuteScript } from "../lib/browser-api";

let captureAbortRequested = false;

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    setSidePanelBehavior({ openPanelOnActionClick: true });

    chrome.contextMenus.create({
      id: "ask-copilot-selection",
      title: chrome.i18n.getMessage("contextMenuSelection", ["%s"]),
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "ask-copilot-page",
      title: chrome.i18n.getMessage("contextMenuPage"),
      contexts: ["page"],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const text =
      info.menuItemId === "ask-copilot-selection"
        ? info.selectionText
        : "Tell me about this page";
    // openSidePanel은 user gesture 컨텍스트에서 즉시 호출해야 함 — await 전에 실행
    if (tab?.id && tab.id > 0) openSidePanel(tab.id);
    storageLocalSet({ pendingAction: { type: "PREFILL_QUESTION", text } });
  });

  const HANDLED_MESSAGES = new Set([
    "START_LOGIN", "CHECK_AUTH", "GET_COPILOT_TOKEN", "COMPLETE_GITHUB_AUTH",
    "LOGOUT", "GET_QUOTA", "CAPTURE_SCREENSHOT", "GET_FULL_PAGE_TEXT", "CAPTURE_FULL_PAGE_SCREENSHOT",
    "CANCEL_FULL_PAGE_SCREENSHOT", "REINJECT_CONTENT_SCRIPT", "GET_DEV_LOG",
  ]);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!HANDLED_MESSAGES.has(message.type)) return false;
    (async () => {
      switch (message.type) {
        case "START_LOGIN":           await handleStartLogin(sendResponse); break;
        case "CHECK_AUTH":            await handleCheckAuth(sendResponse); break;
        case "GET_COPILOT_TOKEN":     await handleGetCopilotToken(sendResponse); break;
        case "COMPLETE_GITHUB_AUTH":  await handleCompleteGithubAuth(sendResponse, message.githubToken); break;
        case "LOGOUT":                await handleLogout(sendResponse); break;
        case "GET_QUOTA":             await handleGetQuota(sendResponse); break;
        case "CAPTURE_SCREENSHOT":           await handleCaptureScreenshot(sendResponse); break;
        case "GET_FULL_PAGE_TEXT":            await handleGetFullPageText(sendResponse); break;
        case "CAPTURE_FULL_PAGE_SCREENSHOT":  await handleCaptureFullPageScreenshot(sendResponse); break;
        case "CANCEL_FULL_PAGE_SCREENSHOT":  captureAbortRequested = true; sendResponse({ success: true }); break;
        case "REINJECT_CONTENT_SCRIPT": await handleReinjectContentScript(sendResponse); break;
        case "GET_DEV_LOG": {
          const mem = devLogger.get();
          if (mem) {
            sendResponse({ success: true, log: mem });
          } else {
            const stored = await storageSessionGet("devlog");
            sendResponse({ success: true, log: stored.devlog ?? "" });
          }
          break;
        }
      }
    })();
    return true;
  });
});

async function handleStartLogin(sendResponse: (r: unknown) => void) {
  try {
    const { device_code, user_code, verification_uri, interval, expires_in } = await requestDeviceCode();
    const isGitHubLoggedIn = await checkGitHubLogin();

    // device_code + interval을 사이드패널로 전달 — 폴링은 사이드패널에서 수행
    // (Service Worker는 30초 후 종료되므로 setInterval 폴링 불가)
    sendResponse({
      success: true,
      device_code,
      user_code,
      verification_uri,
      interval,
      expires_in,
      autoOpening: isGitHubLoggedIn,
    });

    if (isGitHubLoggedIn) {
      await openDeviceAuthTab(user_code, verification_uri);
    }
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

// 사이드패널 폴링 성공 후 GitHub 토큰 전달 → Copilot 토큰 발급 + 저장
async function handleCompleteGithubAuth(sendResponse: (r: unknown) => void, githubToken: string) {
  try {
    const vsCodeVersion = await getLatestVSCodeVersion();
    // githubToken을 먼저 저장 — 사이드바 리로드 시 CHECK_AUTH가 인증 상태를 유지할 수 있도록
    await storage.set({ githubToken, vsCodeVersion });
    for (let i = 0; i < 3; i++) {
      try {
        const { token: copilotToken, expiresAt } = await getCopilotToken(githubToken, vsCodeVersion);
        await storage.set({ githubToken, copilotToken, copilotTokenExpiry: expiresAt, vsCodeVersion });
        break;
      } catch {
        if (i < 2) await new Promise((r) => setTimeout(r, [1000, 2000][i]));
        // 최종 실패해도 로그인 성공 처리 — GET_COPILOT_TOKEN에서 lazy 재시도
      }
    }
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleGetCopilotToken(sendResponse: (r: unknown) => void) {
  const auth = await storage.get();
  if (!auth?.githubToken) { sendResponse({ success: false, error: "LOGIN_REQUIRED" }); return; }
  const now = Date.now();
  if (!auth.copilotToken || auth.copilotTokenExpiry - now < 5 * 60 * 1000) {
    const RETRIES = 3;
    const BACKOFF = [1000, 2000, 4000];
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        const { token, expiresAt } = await getCopilotToken(auth.githubToken, auth.vsCodeVersion);
        await storage.set({ ...auth, copilotToken: token, copilotTokenExpiry: expiresAt });
        sendResponse({ success: true, token, vsCodeVersion: auth.vsCodeVersion });
        return;
      } catch (err) {
        const status = (err as Error & { statusCode?: number }).statusCode;
        if (status === 401 || status === 403) {
          await storage.clear();
          sendResponse({ success: false, error: "NO_SUBSCRIPTION" });
          return;
        }
        if (attempt < RETRIES - 1) {
          await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
        }
      }
    }
    sendResponse({ success: false, error: "TOKEN_REFRESH_FAILED" });
  } else {
    sendResponse({ success: true, token: auth.copilotToken, vsCodeVersion: auth.vsCodeVersion });
  }
}

async function handleCheckAuth(sendResponse: (r: unknown) => void) {
  const auth = await storage.get();
  const isGitHubLoggedIn = await checkGitHubLogin();
  sendResponse({ isLoggedIn: !!auth?.githubToken, isGitHubLoggedIn });
}

async function handleLogout(sendResponse: (r: unknown) => void) {
  await storage.clear();
  sendResponse({ success: true });
}

async function handleGetQuota(sendResponse: (r: unknown) => void) {
  const auth = await storage.get();
  if (!auth?.githubToken) { sendResponse({ success: false }); return; }
  try {
    const response = await fetch("https://api.github.com/copilot_internal/user", {
      headers: {
        Authorization: `token ${auth.githubToken}`,
        Accept: "application/json",
        "editor-version": `vscode/${auth.vsCodeVersion}`,
        "editor-plugin-version": "copilot-chat/0.22.4",
        "Copilot-Integration-Id": "vscode-chat",
        "user-agent": "GitHubCopilotChat/0.22.4",
      },
    });
    if (!response.ok) { sendResponse({ success: false }); return; }
    const data = await response.json();
    const pi = data.quota_snapshots?.premium_interactions;
    if (!pi) { sendResponse({ success: false }); return; }
    sendResponse({
      success: true,
      used: pi.entitlement - pi.remaining,
      total: pi.entitlement,
      unlimited: pi.unlimited ?? false,
      resetDate: data.quota_reset_date_utc ?? data.quota_reset_date,
    });
  } catch {
    sendResponse({ success: false });
  }
}

async function handleGetFullPageText(sendResponse: (r: unknown) => void) {
  try {
    devLogger.reset("GET_FULL_PAGE_TEXT");
    if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
    const [tab] = await tabsQuery({ active: true, currentWindow: true });
    if (!tab?.id) { sendResponse({ success: false, error: "NO_TAB" }); return; }
    const [result] = await scriptingExecuteScript({
      target: { tabId: tab.id },
      func: () => {
        const url = window.location.href;
        const title = document.title;

        // Google Workspace: Canvas 렌더링(kix) 감지 → 텍스트 추출 불가 → screenshot 폴백
        if (/^https?:\/\/(docs|sheets|slides)\.google\.com\//.test(url)) {
          const hasKixCanvas = document.querySelector(".kix-canvas-tile-content") !== null;
          if (hasKixCanvas) {
            return { text: null, title, url, isGoogleWorkspace: true };
          }
          // kix-canvas 없으면 DOM 렌더링일 수 있으므로 계속 진행
        }

        // TreeWalker로 전체 페이지 텍스트 추출 (viewport 범위 제한 없음)
        const SKIP_TAGS = ["script", "style", "noscript", "head", "svg", "canvas"];
        const SKIP_BLOCK_TAGS = ["nav", "header", "footer"];
        const SKIP_ROLES = ["navigation", "toolbar", "menubar", "menu", "menuitem", "dialog", "alertdialog", "banner"];

        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode(node) {
              const el = node as Element;
              const tag = el.tagName.toLowerCase();
              if (SKIP_TAGS.includes(tag) || SKIP_BLOCK_TAGS.includes(tag)) return NodeFilter.FILTER_REJECT;
              const role = el.getAttribute("role") ?? "";
              if (SKIP_ROLES.includes(role)) return NodeFilter.FILTER_REJECT;
              if (el.getAttribute("aria-hidden") === "true") return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          }
        );

        const texts: string[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const el = node as Element;
          const directText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent?.trim())
            .filter(Boolean)
            .join(" ");
          if (directText) texts.push(directText as string);
        }

        const deduped: string[] = [];
        for (const t of texts) {
          if (t !== deduped[deduped.length - 1]) deduped.push(t);
        }

        const text = deduped.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 500000);
        return { text: text || null, title, url, isGoogleWorkspace: false };
      },
    });

    const data = result?.result;
    devLogger.log(`executeScript done: isGoogleWorkspace=${data?.isGoogleWorkspace}, textLen=${data?.text?.length ?? 0}`);
    if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
    if (data?.isGoogleWorkspace) {
      // Google Docs/Sheets: background SW에서 직접 fetch (페이지 CSP 우회, 사용자 쿠키 포함)
      const pageUrl = data.url as string;
      let exportUrl: string | null = null;

      const docId = pageUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (docId) {
        exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      } else {
        const sheetId = pageUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
        if (sheetId) exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      }

      if (!exportUrl) {
        devLogger.log("google_workspace export: slides_no_export");
        if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
        sendResponse({ success: false, error: "google_workspace", title: data.title, url: data.url });
        return;
      }

      try {
        const exportRes = await fetch(exportUrl, { credentials: "include" });
        const exportText = exportRes.ok ? (await exportRes.text()).trim().slice(0, 500000) : null;
        devLogger.log(`google_workspace export: textLen=${exportText?.length ?? 0}, status=${exportRes.status}`);
        if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });

        if (exportText) {
          sendResponse({ success: true, text: exportText, title: data.title, url: data.url });
        } else {
          sendResponse({ success: false, error: "google_workspace", title: data.title, url: data.url });
        }
      } catch (e) {
        const errMsg = (e as Error).message;
        devLogger.log(`google_workspace export: error=${errMsg}`);
        if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
        sendResponse({ success: false, error: "google_workspace", title: data.title, url: data.url });
      }
    } else if (data?.text) {
      sendResponse({ success: true, text: data.text, title: data.title, url: data.url });
    } else {
      sendResponse({ success: false, error: "NO_TEXT" });
    }
  } catch (error) {
    devLogger.log(`ERROR: ${(error as Error).message}`);
    if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function handleCaptureFullPageScreenshot(sendResponse: (r: unknown) => void) {
  devLogger.reset("CAPTURE_FULL_PAGE_SCREENSHOT");
  if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
  try {
    captureAbortRequested = false;
    const [tab] = await tabsQuery({ active: true, currentWindow: true });
    if (!tab?.id || !tab.windowId) { sendResponse({ success: false, error: "NO_TAB" }); return; }
    const { id: tabId, windowId } = tab;

    const [infoResult] = await scriptingExecuteScript({
      target: { tabId },
      func: () => {
        // 내부 스크롤 컨테이너 감지 (SPA 페이지 대응)
        const candidates: Element[] = [];
        for (const el of document.querySelectorAll("*")) {
          if (el === document.body || el === document.documentElement) continue;
          const style = window.getComputedStyle(el);
          const ov = style.overflowY;
          if (ov !== "auto" && ov !== "scroll") continue;
          if (el.scrollHeight <= el.clientHeight + 10) continue;
          if (el.clientHeight <= window.innerHeight * 0.3) continue;
          candidates.push(el);
        }
        candidates.sort((a, b) => b.clientHeight - a.clientHeight);
        const container = candidates[0] ?? null;

        const actualScrollHeight = container
          ? container.scrollHeight
          : Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
        const scrollHeight = actualScrollHeight;
        const viewportHeight = container ? container.clientHeight : window.innerHeight;
        const savedScrollTop = container ? container.scrollTop : window.scrollY;

        return {
          scrollHeight,
          actualScrollHeight,
          viewportHeight,
          viewportWidth: window.innerWidth,
          dpr: Math.min(window.devicePixelRatio || 1, 2),
          savedScrollTop,
          savedScrollX: window.scrollX,
          hasContainer: container !== null,
        };
      },
    });
    const info = infoResult?.result;
    if (!info) { sendResponse({ success: false, error: "NO_PAGE_INFO" }); return; }
    devLogger.log(`pageInfo: scrollHeight=${info.scrollHeight}, viewportHeight=${info.viewportHeight}, viewportWidth=${info.viewportWidth}, dpr=${info.dpr}, hasContainer=${info.hasContainer}`);

    if (!isOffscreenCanvasSupported) {
      sendResponse({ success: false, error: "NOT_SUPPORTED_ON_FIREFOX" });
      return;
    }

    const canvasW = info.viewportWidth;
    const canvasH = info.scrollHeight;
    const canvas = new OffscreenCanvas(canvasW, canvasH);
    devLogger.log(`canvas created: ${canvasW}x${canvasH}`);
    const ctx = canvas.getContext("2d");
    if (!ctx) { sendResponse({ success: false, error: "NO_CANVAS" }); return; }

    for (let y = 0; y < info.scrollHeight; y += info.viewportHeight) {
      devLogger.log(`ITER start: y=${y}`);
      const scrollTo = Math.min(y, info.scrollHeight - info.viewportHeight);
      await scriptingExecuteScript({
        target: { tabId },
        func: (sy: number, useContainer: boolean) => {
          if (useContainer) {
            const candidates: Element[] = [];
            for (const el of document.querySelectorAll("*")) {
              if (el === document.body || el === document.documentElement) continue;
              const style = window.getComputedStyle(el);
              const ov = style.overflowY;
              if (ov !== "auto" && ov !== "scroll") continue;
              if (el.scrollHeight <= el.clientHeight + 10) continue;
              if (el.clientHeight <= window.innerHeight * 0.3) continue;
              candidates.push(el);
            }
            candidates.sort((a, b) => b.clientHeight - a.clientHeight);
            const container = candidates[0];
            if (container) { (container as HTMLElement).scrollTop = sy; return; }
          }
          window.scrollTo(0, sy);
        },
        args: [scrollTo, info.hasContainer],
      });
      await new Promise((r) => setTimeout(r, getCaptureDelayMs()));
      devLogger.log(`  sleep done`);

      const dataUrl = await tabsCaptureVisibleTab(windowId, { format: "jpeg", quality: 90 });
      devLogger.log(`  captured: dataUrl.length=${dataUrl.length}`);
      const blob = await fetch(dataUrl).then((r) => r.blob());
      devLogger.log(`  blob.size=${blob.size}`);
      const bitmap = await createImageBitmap(blob);
      devLogger.log(`  bitmap: ${bitmap.width}x${bitmap.height}`);
      ctx.drawImage(bitmap, 0, scrollTo, info.viewportWidth, info.viewportHeight);
      devLogger.log(`  drawImage done at scrollTo=${scrollTo}`);
      bitmap.close();
      if (captureAbortRequested) {
        devLogger.log(`  capture aborted by user`);
        break;
      }
    }
    devLogger.log(`loop complete`);

    // 스크롤 위치 복원
    await scriptingExecuteScript({
      target: { tabId },
      func: (savedTop: number, savedX: number, useContainer: boolean) => {
        if (useContainer) {
          const candidates: Element[] = [];
          for (const el of document.querySelectorAll("*")) {
            if (el === document.body || el === document.documentElement) continue;
            const style = window.getComputedStyle(el);
            const ov = style.overflowY;
            if (ov !== "auto" && ov !== "scroll") continue;
            if (el.scrollHeight <= el.clientHeight + 10) continue;
            if (el.clientHeight <= window.innerHeight * 0.3) continue;
            candidates.push(el);
          }
          candidates.sort((a, b) => b.clientHeight - a.clientHeight);
          const container = candidates[0];
          if (container) { (container as HTMLElement).scrollTop = savedTop; return; }
        }
        window.scrollTo(savedX, savedTop);
      },
      args: [info.savedScrollTop, info.savedScrollX, info.hasContainer],
    });

    if (captureAbortRequested) {
      if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
      sendResponse({ success: false, error: "cancelled" });
      return;
    }
    const resultBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
    devLogger.log(`resultBlob.size=${resultBlob.size}`);
    if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
    sendResponse({ success: true, dataUrl: await blobToDataUrl(resultBlob) });
  } catch (error) {
    devLogger.log(`ERROR: ${(error as Error).message}\nStack: ${(error as Error).stack ?? "none"}`);
    if (DEV_MODE) await storageSessionSet({ devlog: devLogger.get() });
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleCaptureScreenshot(sendResponse: (r: unknown) => void) {
  try {
    const [tab] = await tabsQuery({ active: true, currentWindow: true });
    if (!tab?.windowId) { sendResponse({ success: false, error: "NO_TAB" }); return; }
    const dataUrl = await tabsCaptureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 });
    sendResponse({ success: true, dataUrl });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}

async function handleReinjectContentScript(sendResponse: (r: unknown) => void) {
  try {
    const [tab] = await tabsQuery({ active: true, currentWindow: true });
    if (!tab?.id) { sendResponse({ success: false, error: "NO_TAB" }); return; }
    await scriptingExecuteScript({
      target: { tabId: tab.id },
      files: ["content-scripts/content.js"],
    });
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: (error as Error).message });
  }
}
