import {
  extractViewportText,
  getScrollContainer,
} from "../lib/viewport-extractor";

export default defineContentScript({
  matches: ["<all_urls>"],
  main(ctx) {
    // event.preventDefault() alone doesn't suppress Chrome DevTools output;
    // window.onerror returning true is the only reliable suppression mechanism.
    const isContextInvalidated = (msg?: string) => msg === "Extension context invalidated.";
    const isExtRuntimeError = (msg?: string, source?: string) =>
      msg?.includes("Cannot read properties of undefined (reading 'id')") &&
      (source?.includes("content-scripts/") || source?.includes("chrome-extension://") || source?.includes("moz-extension://"));

    window.addEventListener("error", (event) => {
      if (isContextInvalidated(event.error?.message) || isExtRuntimeError(event.error?.message, event.error?.stack)) {
        event.preventDefault();
      }
    }, { capture: true });
    const _prevOnError = window.onerror;
    window.onerror = (msg, src, line, col, err) => {
      if (isContextInvalidated((err as Error)?.message)) return true;
      if (isExtRuntimeError((err as Error)?.message, src ?? (err as Error)?.stack)) return true;
      if (typeof _prevOnError === "function") return _prevOnError.call(window, msg, src, line, col, err) as boolean;
      return false;
    };
    window.addEventListener("unhandledrejection", (event) => {
      if (isContextInvalidated((event.reason as Error)?.message)) {
        event.preventDefault();
      }
    }, { capture: true });

    let debounceTimer: ReturnType<typeof setTimeout>;
    let isWatching = false;
    let scrollContainer: Element | null = null;

    const safeSendMessage = (msg: unknown) => {
      try {
        chrome.runtime.sendMessage(msg).catch(() => {});
      } catch {
        // Extension context invalidated (synchronous throw)
      }
    };

    const sendUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = ctx.setTimeout(() => {
        safeSendMessage({ type: "VIEWPORT_UPDATED", context: extractViewportText() });
      }, 500);
    };

    // 페이지 로드 완료 시 사이드패널에 context 자동 push (race condition 해결)
    ctx.setTimeout(() => {
      safeSendMessage({ type: "VIEWPORT_UPDATED", context: extractViewportText() });
    }, 600);

    // SPA 네비게이션 감지 (pushState/replaceState)
    ctx.addEventListener(window, "wxt:locationchange", () => {
      ctx.setTimeout(() => {
        safeSendMessage({ type: "VIEWPORT_UPDATED", context: extractViewportText() });
      }, 300);
    });

    const msgListener = (message: { type: string }, _sender: chrome.runtime.MessageSender, sendResponse: (r: unknown) => void) => {
      try {
        if (!ctx.isValid) return false;

        if (message.type === "GET_VIEWPORT_CONTEXT") {
          try {
            sendResponse({ success: true, context: extractViewportText() });
          } catch {
            try { sendResponse({ success: false, error: "context invalidated" }); } catch {}
          }
          return true;
        }

        if (message.type === "START_WATCHING") {
          if (!isWatching) {
            isWatching = true;
            window.addEventListener("scroll", sendUpdate);
            scrollContainer = getScrollContainer();
            if (scrollContainer) {
              scrollContainer.addEventListener("scroll", sendUpdate);
            }
          }
          sendUpdate();
          try { sendResponse({ success: true }); } catch {}
          return true;
        }

        if (message.type === "STOP_WATCHING") {
          clearTimeout(debounceTimer);
          isWatching = false;
          window.removeEventListener("scroll", sendUpdate);
          if (scrollContainer) {
            scrollContainer.removeEventListener("scroll", sendUpdate);
            scrollContainer = null;
          }
          try { sendResponse({ success: true }); } catch {}
          return true;
        }

        return false;
      } catch {
        return false;
      }
    };

    chrome.runtime.onMessage.addListener(msgListener);
    ctx.onInvalidated(() => {
      try {
        chrome.runtime.onMessage.removeListener(msgListener);
      } catch {
        // Extension context already fully invalidated
      }
      if (isWatching) {
        clearTimeout(debounceTimer);
        window.removeEventListener("scroll", sendUpdate);
        if (scrollContainer) {
          scrollContainer.removeEventListener("scroll", sendUpdate);
          scrollContainer = null;
        }
        isWatching = false;
      }
    });
  },
});
