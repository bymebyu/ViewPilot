import type { BrowserAPI } from './types';
import { chromiumAPI } from './chromium';
import { firefoxAPI } from './firefox';

// import.meta.env.BROWSER는 WXT 빌드 시 문자열 상수로 치환됨.
// 트리 쉐이킹으로 미사용 브라우저 코드는 번들에서 제거.
const api: BrowserAPI = import.meta.env.BROWSER === 'firefox' ? firefoxAPI : chromiumAPI;

export default api;

// 디버그 로그 시스템 — DEBUG_LOGGING = false면 로깅 비활성화 (프로덕션 오버헤드 제거)
const DEBUG_LOGGING = false;
const _debugLogs: string[] = [];
const _listeners: Set<() => void> = new Set();

// Named exports — 기존 browser-compat.ts와 동일한 함수명으로 마이그레이션 용이
export const {
  isSidePanelSupported, isOffscreenCanvasSupported,
  openSidePanel, setSidePanelBehavior,
  getCaptureRateLimit,
  storageLocalGet, storageLocalSet, storageLocalRemove,
  storageSessionGet, storageSessionSet, storageSessionRemove,
  tabsQuery, tabsSendMessage, tabsCaptureVisibleTab, scriptingExecuteScript,
} = api;

// sendMessage는 제네릭 타입 파라미터 보존을 위해 별도 함수로 export
export function sendMessage<T = unknown>(message: Record<string, unknown>): Promise<T> {
  if (DEBUG_LOGGING) {
    debugLog(`→ ${message.type}`);
    return api.sendMessage<T>(message).then((response) => {
      debugLog(`← ${message.type}: ${JSON.stringify(response)?.slice(0, 200) ?? 'undefined'}`);
      return response;
    }).catch((err) => {
      debugLog(`✕ ${message.type}: ${err}`);
      throw err;
    });
  }
  return api.sendMessage<T>(message);
}

// getCaptureDelayMs는 this 컨텍스트 보존을 위해 별도 함수로 export
export function getCaptureDelayMs(): number {
  return api.getCaptureDelayMs();
}

export function debugLog(msg: string) {
  if (!DEBUG_LOGGING) return;
  const time = new Date().toLocaleTimeString();
  _debugLogs.push(`${time}: ${msg}`);
  if (_debugLogs.length > 50) _debugLogs.shift();
  _listeners.forEach((fn) => fn());
}

export function getDebugLogs(): string[] {
  return [..._debugLogs];
}

export function onDebugLogChange(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export type { BrowserAPI } from './types';
