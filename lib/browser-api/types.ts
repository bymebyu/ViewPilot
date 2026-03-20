/**
 * 브라우저 API 추상화 인터페이스
 * 각 브라우저(Chromium, Firefox)가 이 인터페이스를 구현.
 */
export interface BrowserAPI {
  // Side panel
  isSidePanelSupported: boolean;
  openSidePanel(tabId?: number): Promise<void>;
  setSidePanelBehavior(options: { openPanelOnActionClick: boolean }): void;

  // Capabilities
  isOffscreenCanvasSupported: boolean;

  // Capture
  getCaptureRateLimit(): number;
  getCaptureDelayMs(): number;

  // Messaging
  sendMessage<T = unknown>(message: Record<string, unknown>): Promise<T>;

  // Storage - local
  storageLocalGet(keys: string | string[]): Promise<Record<string, any>>;
  storageLocalSet(data: Record<string, any>): Promise<void>;
  storageLocalRemove(keys: string | string[]): Promise<void>;

  // Storage - session
  storageSessionGet(keys: string | string[]): Promise<Record<string, any>>;
  storageSessionSet(data: Record<string, any>): Promise<void>;
  storageSessionRemove(keys: string | string[]): Promise<void>;

  // Tabs
  tabsQuery(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  tabsSendMessage(tabId: number, message: any): Promise<any>;
  tabsCaptureVisibleTab(windowId: number, options?: chrome.tabs.CaptureVisibleTabOptions): Promise<string>;

  // Scripting
  scriptingExecuteScript(details: chrome.scripting.ScriptInjection<any[], any>): Promise<chrome.scripting.InjectionResult<any>[]>;
}
