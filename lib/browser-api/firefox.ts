import type { BrowserAPI } from './types';

// Firefox MV2: browser.* 네임스페이스가 네이티브 Promise를 반환.
// chrome.* 콜백 래핑 불필요 — browser.* 직접 사용.
const b = browser as any;

export const firefoxAPI: BrowserAPI = {
  isSidePanelSupported: false,
  isOffscreenCanvasSupported: true,

  openSidePanel: () => b.sidebarAction.open(),
  setSidePanelBehavior: () => {},

  getCaptureRateLimit: () => chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND ?? 2,
  getCaptureDelayMs() { return Math.ceil(1000 / this.getCaptureRateLimit()) + 100; },

  sendMessage: <T = unknown>(message: Record<string, unknown>) =>
    b.runtime.sendMessage(message) as Promise<T>,

  // Storage - local (browser.* 네이티브 Promise)
  storageLocalGet: (keys) => b.storage.local.get(keys),
  storageLocalSet: (data) => b.storage.local.set(data),
  storageLocalRemove: (keys) => b.storage.local.remove(keys),

  // Storage - session (Firefox 115+ MV3 지원, MV2에서는 없을 수 있음)
  storageSessionGet: (keys) =>
    b.storage.session ? b.storage.session.get(keys) : Promise.resolve({}),
  storageSessionSet: (data) =>
    b.storage.session ? b.storage.session.set(data) : Promise.resolve(),
  storageSessionRemove: (keys) =>
    b.storage.session ? b.storage.session.remove(keys) : Promise.resolve(),

  // Tabs (browser.* 네이티브 Promise)
  tabsQuery: (queryInfo) => b.tabs.query(queryInfo),
  tabsSendMessage: (tabId, message) => b.tabs.sendMessage(tabId, message),
  tabsCaptureVisibleTab: (windowId, options) => b.tabs.captureVisibleTab(windowId, options),

  // Scripting (browser.* 네이티브 Promise)
  scriptingExecuteScript: (details) => b.scripting.executeScript(details),
};
