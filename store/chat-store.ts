import { create } from "zustand";
import type { CopilotModel } from "../lib/models";
import type { ViewportContext } from "../lib/viewport-extractor";
import type { Conversation } from "../lib/storage";
import { saveConversations, loadConversations, loadLastModel, savePageContext, loadPageContext, saveWebSearchEnabled, loadWebSearchEnabled, saveBraveApiKey, loadBraveApiKey, saveSerperApiKey, loadSerperApiKey, saveFontSize, loadFontSize } from "../lib/storage";

export interface PremiumQuota {
  used: number;
  total: number;
  unlimited: boolean;
  resetDate?: string;
}

export interface Attachment {
  id: string;
  type: "image" | "text";
  name: string;
  dataUrl?: string;  // 이미지: data:image/...;base64,...
  text?: string;     // 텍스트 파일 내용
  mimeType: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isLoggedIn: boolean;
  availableModels: CopilotModel[];
  selectedModel: string;
  viewportContext: ViewportContext | null;
  usePageContext: boolean;
  pendingAttachments: Attachment[];
  premiumQuota: PremiumQuota | null;
  conversations: Conversation[];
  currentConversationId: string | null;
  webSearchEnabled: boolean;
  webSearchStatus: 'unconfigured' | 'ready';
  braveApiKey: string;
  serperApiKey: string;
  fontSize: number;
  prefillText: string;

  addMessage: (msg: Omit<Message, "id" | "timestamp">) => void;
  appendToLastMessage: (content: string) => void;
  setLoading: (v: boolean) => void;
  setLoggedIn: (v: boolean) => void;
  setAvailableModels: (models: CopilotModel[]) => void;
  setSelectedModel: (modelId: string) => void;
  setViewportContext: (ctx: ViewportContext | null) => void;
  togglePageContext: () => void;
  clearMessages: () => void;
  popLastMessage: () => void;
  addAttachment: (att: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setQuota: (q: PremiumQuota | null) => void;
  setConversations: (c: Conversation[]) => void;
  setCurrentConversationId: (id: string | null) => void;
  saveCurrentConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  startNewConversation: () => void;
  importConversations: (incoming: Conversation[]) => void;
  toggleWebSearch: () => void;
  setBraveApiKey: (key: string) => void;
  setSerperApiKey: (key: string) => void;
  setFontSize: (level: number) => void;
  setPrefillText: (text: string) => void;
  initFromStorage: () => void;
}

function messagesToStored(messages: Message[]) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    attachments: m.attachments?.map(({ id, type, name, text, mimeType }) => ({ id, type, name, text, mimeType })),
  }));
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isLoggedIn: false,
  availableModels: [],
  selectedModel: "",
  viewportContext: null,
  usePageContext: true,
  pendingAttachments: [],
  premiumQuota: null,
  conversations: [],
  currentConversationId: null,
  webSearchEnabled: false,
  webSearchStatus: 'unconfigured',
  braveApiKey: '',
  serperApiKey: '',
  fontSize: 5,
  prefillText: '',

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { ...msg, id: crypto.randomUUID(), timestamp: Date.now() }] })),

  appendToLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: last.content + content };
      return { messages: msgs };
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setAvailableModels: (availableModels) => set({ availableModels }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setViewportContext: (viewportContext) => set({ viewportContext }),
  togglePageContext: () => set((s) => {
    const next = !s.usePageContext;
    savePageContext(next);
    return { usePageContext: next };
  }),
  clearMessages: () => set({ messages: [] }),
  popLastMessage: () => set((s) => ({ messages: s.messages.slice(0, -1) })),
  addAttachment: (att) => set((s) => ({ pendingAttachments: [...s.pendingAttachments, att] })),
  removeAttachment: (id) => set((s) => ({ pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id) })),
  clearAttachments: () => set({ pendingAttachments: [] }),
  setQuota: (premiumQuota) => set({ premiumQuota }),

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversationId: (currentConversationId) => set({ currentConversationId }),

  saveCurrentConversation: () => {
    const { messages, currentConversationId, conversations, selectedModel } = get();
    if (messages.length === 0) return;

    const now = Date.now();
    const stored = messagesToStored(messages);
    let updated: Conversation[];

    if (currentConversationId) {
      updated = conversations.map((c) =>
        c.id === currentConversationId
          ? { ...c, messages: stored, modelId: selectedModel, updatedAt: now }
          : c,
      );
    } else {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : "New conversation";
      const newConv: Conversation = {
        id: crypto.randomUUID(),
        title,
        messages: stored,
        modelId: selectedModel,
        createdAt: now,
        updatedAt: now,
      };
      updated = [newConv, ...conversations];
      set({ currentConversationId: newConv.id });
    }

    updated.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ conversations: updated });
    saveConversations(updated);
  },

  loadConversation: (id) => {
    const { conversations } = get();
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    set({
      messages: conv.messages.map((m) => ({ ...m, attachments: m.attachments as Attachment[] | undefined })),
      currentConversationId: id,
      selectedModel: conv.modelId,
    });
  },

  deleteConversation: (id) => {
    const { conversations, currentConversationId } = get();
    const updated = conversations.filter((c) => c.id !== id);
    const patch: Partial<ChatState> = { conversations: updated };
    if (currentConversationId === id) {
      patch.currentConversationId = null;
      patch.messages = [];
    }
    set(patch as ChatState);
    saveConversations(updated);
  },

  startNewConversation: () => {
    get().saveCurrentConversation();
    set({ messages: [], currentConversationId: null });
  },

  importConversations: (incoming: Conversation[]) => {
    const { conversations } = get();
    const existingIds = new Set(conversations.map((c) => c.id));
    const merged = [
      ...incoming.filter((c) => !existingIds.has(c.id)),
      ...conversations,
    ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
    set({ conversations: merged });
    saveConversations(merged);
  },

  toggleWebSearch: () => set((s) => {
    const next = !s.webSearchEnabled;
    saveWebSearchEnabled(next);
    return { webSearchEnabled: next };
  }),

  setBraveApiKey: (key: string) => set((s) => {
    saveBraveApiKey(key);
    return {
      braveApiKey: key,
      webSearchStatus: key.trim() || s.serperApiKey.trim() ? 'ready' : 'unconfigured',
    };
  }),

  setSerperApiKey: (key: string) => set(() => {
    saveSerperApiKey(key);
    return {
      serperApiKey: key,
      webSearchStatus: key.trim() || get().braveApiKey.trim() ? 'ready' : 'unconfigured',
    };
  }),

  setFontSize: (level: number) => set(() => {
    const clamped = Math.max(1, Math.min(10, level));
    saveFontSize(clamped);
    return { fontSize: clamped };
  }),

  setPrefillText: (text: string) => set({ prefillText: text }),

  initFromStorage: () => {
    loadConversations().then((conversations) => set({ conversations }));
    loadLastModel().then((modelId) => {
      if (modelId) set({ selectedModel: modelId });
    });
    loadPageContext().then((value) => set({ usePageContext: value }));
    loadWebSearchEnabled().then((value) => set({ webSearchEnabled: value }));
    loadBraveApiKey().then((key) => set({
      braveApiKey: key,
      webSearchStatus: key ? 'ready' : 'unconfigured',
    }));
    loadSerperApiKey().then((key) => {
      const state = get();
      set({
        serperApiKey: key,
        webSearchStatus: key || state.braveApiKey ? 'ready' : 'unconfigured',
      });
    });
    loadFontSize().then((level) => set({ fontSize: level }));
  },
}));
