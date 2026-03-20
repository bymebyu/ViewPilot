import type { BrowserAPI } from './types';

export const chromiumAPI: BrowserAPI = {
  isSidePanelSupported: true,
  isOffscreenCanvasSupported: true,

  openSidePanel: async (tabId) => {
    if (tabId) await chrome.sidePanel.open({ tabId });
  },

  setSidePanelBehavior: (options) => {
    chrome.sidePanel.setPanelBehavior(options);
  },

  getCaptureRateLimit: () => chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND ?? 2,
  getCaptureDelayMs() { return Math.ceil(1000 / this.getCaptureRateLimit()) + 100; },

  sendMessage: <T = unknown>(message: Record<string, unknown>) =>
    new Promise<T>((resolve) => {
      chrome.runtime.sendMessage(message, (response: T) => resolve(response));
    }),

  // Chrome MV3: native Promise API
  storageLocalGet: (keys) => chrome.storage.local.get(keys),
  storageLocalSet: (data) => chrome.storage.local.set(data),
  storageLocalRemove: (keys) => chrome.storage.local.remove(keys),

  storageSessionGet: (keys) => chrome.storage.session.get(keys),
  storageSessionSet: (data) => chrome.storage.session.set(data),
  storageSessionRemove: (keys) => chrome.storage.session.remove(keys),

  // Chrome MV3: native Promise API
  tabsQuery: (queryInfo) => chrome.tabs.query(queryInfo),
  tabsSendMessage: (tabId, message) => chrome.tabs.sendMessage(tabId, message),
  tabsCaptureVisibleTab: (windowId, options) => chrome.tabs.captureVisibleTab(windowId, options),
  scriptingExecuteScript: (details) => chrome.scripting.executeScript(details),
};
