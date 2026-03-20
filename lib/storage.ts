import { storageLocalGet, storageLocalSet, storageLocalRemove } from "./browser-api";

interface AuthData {
  githubToken: string;
  copilotToken: string;
  copilotTokenExpiry: number;
  vsCodeVersion: string;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: { id: string; type: "image" | "text"; name: string; text?: string; mimeType: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: StoredMessage[];
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

const MAX_CONVERSATIONS = 50;

export const storage = {
  async get(): Promise<AuthData | null> {
    const result = await storageLocalGet("auth");
    return result.auth ?? null;
  },
  async set(data: Partial<AuthData>): Promise<void> {
    const current = await this.get();
    await storageLocalSet({ auth: { ...current, ...data } });
  },
  async clear(): Promise<void> {
    await storageLocalRemove("auth");
  },
};

export async function saveLastModel(modelId: string): Promise<void> {
  await storageLocalSet({ lastModel: modelId });
}

export async function loadLastModel(): Promise<string | null> {
  const result = await storageLocalGet("lastModel");
  return result.lastModel ?? null;
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const trimmed = sorted.slice(0, MAX_CONVERSATIONS);
  await storageLocalSet({ conversations: trimmed });
}

export async function loadConversations(): Promise<Conversation[]> {
  const result = await storageLocalGet("conversations");
  return result.conversations ?? [];
}

export async function saveKnownModelIds(ids: string[]): Promise<void> {
  await storageLocalSet({ knownModelIds: ids });
}

export async function loadKnownModelIds(): Promise<string[]> {
  const r = await storageLocalGet("knownModelIds");
  return r.knownModelIds ?? [];
}

export async function saveIncompatibleModelIds(ids: string[]): Promise<void> {
  await storageLocalSet({ incompatibleModelIds: ids });
}

export async function loadIncompatibleModelIds(): Promise<string[]> {
  const r = await storageLocalGet("incompatibleModelIds");
  return r.incompatibleModelIds ?? [];
}

export async function saveInputHistory(history: string[]): Promise<void> {
  await storageLocalSet({ inputHistory: history.slice(0, 10) });
}

export async function loadInputHistory(): Promise<string[]> {
  const r = await storageLocalGet("inputHistory");
  return r.inputHistory ?? [];
}

export async function saveModelMultiplierCache(cache: Record<string, number>): Promise<void> {
  await storageLocalSet({ modelMultiplierCache: cache });
}

export async function loadModelMultiplierCache(): Promise<Record<string, number>> {
  const r = await storageLocalGet("modelMultiplierCache");
  return r.modelMultiplierCache ?? {};
}

export async function savePageContext(value: boolean): Promise<void> {
  await storageLocalSet({ usePageContext: value });
}

export async function loadPageContext(): Promise<boolean> {
  const r = await storageLocalGet("usePageContext");
  return r.usePageContext ?? true;
}

export async function saveWebSearchEnabled(value: boolean): Promise<void> {
  await storageLocalSet({ webSearchEnabled: value });
}

export async function loadWebSearchEnabled(): Promise<boolean> {
  const r = await storageLocalGet("webSearchEnabled");
  return r.webSearchEnabled ?? false;
}

export async function saveBraveApiKey(key: string): Promise<void> {
  await storageLocalSet({ braveApiKey: key });
}

export async function loadBraveApiKey(): Promise<string> {
  const r = await storageLocalGet("braveApiKey");
  return r.braveApiKey ?? "";
}

export async function saveSerperApiKey(key: string): Promise<void> {
  await storageLocalSet({ serperApiKey: key });
}

export async function loadSerperApiKey(): Promise<string> {
  const r = await storageLocalGet("serperApiKey");
  return r.serperApiKey ?? "";
}

export async function saveFontSize(level: number): Promise<void> {
  await storageLocalSet({ fontSize: level });
}

export async function loadFontSize(): Promise<number> {
  const r = await storageLocalGet("fontSize");
  return r.fontSize ?? 5;
}

// 모델별 엔드포인트 캐시: { "gpt-5.4": "/responses", "gpt-4o": "/chat/completions" }
export async function saveModelEndpointCache(cache: Record<string, string>): Promise<void> {
  await storageLocalSet({ modelEndpointCache: cache });
}

export async function loadModelEndpointCache(): Promise<Record<string, string>> {
  const r = await storageLocalGet("modelEndpointCache");
  return r.modelEndpointCache ?? {};
}
