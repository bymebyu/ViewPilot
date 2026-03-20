import {
  WEB_SEARCH_TOOL,
  braveSearch,
  serperSearch,
  duckduckgoSearch,
  formatSearchResults,
  performSearch,
} from "./web-search";
import { debugLog } from "./browser-api";
import { loadModelEndpointCache, saveModelEndpointCache } from "./storage";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | ContentPart[] | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface WebSearchConfig {
  enabled: boolean;
  apiKey?: string;
  engine: "brave" | "serper" | "duckduckgo";
}

const ENDPOINT_CHAT = "/chat/completions";
const ENDPOINT_RESPONSES = "/responses";

const COPILOT_HEADERS = (copilotToken: string, vsCodeVersion: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${copilotToken}`,
  "editor-version": `vscode/${vsCodeVersion}`,
  "editor-plugin-version": "copilot-chat/0.22.4",
  "Copilot-Integration-Id": "vscode-chat",
  "openai-intent": "conversation-panel",
  "user-agent": "GitHubCopilotChat/0.22.4",
});

/** 모델의 엔드포인트를 결정: 캐시 → supportedEndpoints → 기본값 */
async function resolveEndpoint(model: string, supportedEndpoints?: string[]): Promise<string> {
  // 1. 캐시에서 먼저 확인
  const cache = await loadModelEndpointCache();
  if (cache[model]) {
    debugLog(`엔드포인트 캐시 히트: ${model} → ${cache[model]}`);
    return cache[model];
  }

  // 2. API supportedEndpoints 기반 결정
  if (supportedEndpoints && supportedEndpoints.length > 0) {
    if (!supportedEndpoints.includes(ENDPOINT_CHAT) && supportedEndpoints.includes(ENDPOINT_RESPONSES)) {
      return ENDPOINT_RESPONSES;
    }
    if (supportedEndpoints.includes(ENDPOINT_CHAT)) {
      return ENDPOINT_CHAT;
    }
  }

  // 3. 기본값
  return ENDPOINT_CHAT;
}

/** 성공한 엔드포인트를 캐시에 저장 */
async function cacheEndpoint(model: string, endpoint: string): Promise<void> {
  const cache = await loadModelEndpointCache();
  if (cache[model] !== endpoint) {
    cache[model] = endpoint;
    await saveModelEndpointCache(cache);
    debugLog(`엔드포인트 캐시 저장: ${model} → ${endpoint}`);
  }
}

/** 캐시된 엔드포인트가 잘못된 경우 삭제 */
async function invalidateEndpointCache(model: string): Promise<void> {
  const cache = await loadModelEndpointCache();
  if (cache[model]) {
    delete cache[model];
    await saveModelEndpointCache(cache);
    debugLog(`엔드포인트 캐시 삭제: ${model}`);
  }
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  copilotToken: string,
  vsCodeVersion: string,
  model: string,
  signal?: AbortSignal,
  webSearch?: WebSearchConfig,
  supportedEndpoints?: string[]
): AsyncGenerator<string> {
  const endpoint = await resolveEndpoint(model, supportedEndpoints);
  debugLog(`모델 라우팅: model=${model}, endpoint=${endpoint}`);

  if (endpoint === ENDPOINT_RESPONSES) {
    try {
      yield* streamResponsesCompletion(messages, copilotToken, vsCodeVersion, model, signal, webSearch);
      await cacheEndpoint(model, ENDPOINT_RESPONSES);
      return;
    } catch (err) {
      // 캐시가 잘못된 경우: 캐시 삭제 후 /chat/completions로 재시도
      await invalidateEndpointCache(model);
      debugLog(`/responses 실패, /chat/completions 재시도: ${err}`);
      yield* streamChatCompletionsFlow(messages, copilotToken, vsCodeVersion, model, signal, webSearch);
      await cacheEndpoint(model, ENDPOINT_CHAT);
      return;
    }
  }

  // /chat/completions 시도
  try {
    yield* streamChatCompletionsFlow(messages, copilotToken, vsCodeVersion, model, signal, webSearch);
    await cacheEndpoint(model, ENDPOINT_CHAT);
  } catch (err) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode;
    const isUnsupported = (err as Error).message === "unsupported_api_for_model";

    // /chat/completions 실패 → /responses fallback
    if (isUnsupported || statusCode === 400) {
      await invalidateEndpointCache(model);
      debugLog(`/chat/completions 실패 → /responses fallback (model=${model})`);
      try {
        yield* streamResponsesCompletion(messages, copilotToken, vsCodeVersion, model, signal, webSearch);
        await cacheEndpoint(model, ENDPOINT_RESPONSES);
        return;
      } catch (fallbackErr) {
        debugLog(`/responses fallback도 실패: ${fallbackErr}`);
      }
    }
    throw err;
  }
}

// --- /chat/completions 엔드포인트 ---

async function* streamChatCompletionsFlow(
  messages: ChatMessage[],
  copilotToken: string,
  vsCodeVersion: string,
  model: string,
  signal?: AbortSignal,
  webSearch?: WebSearchConfig
): AsyncGenerator<string> {
  const useTools = webSearch?.enabled === true;
  const headers = COPILOT_HEADERS(copilotToken, vsCodeVersion);

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    temperature: 0.1,
  };

  if (useTools) {
    body.tools = [WEB_SEARCH_TOOL];
    body.tool_choice = "auto";
  }

  debugLog(`API 요청 (/chat/completions): tools=${useTools}, model=${model}`);

  let response = await fetch("https://api.githubcopilot.com/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  // Tool calling이 422로 거부되면 → 프롬프트 주입 방식으로 fallback
  if (!response.ok && response.status === 422 && useTools) {
    const errorBody = await response.text();
    debugLog(`Tool calling 422 거부: ${errorBody.slice(0, 300)}`);

    const userQuery = extractLastUserQuery(messages);
    let fallbackMessages = messages;
    if (userQuery) {
      try {
        const results = await performSearch(userQuery, webSearch!.engine, webSearch!.apiKey, 5);
        if (results.length > 0) {
          fallbackMessages = injectSearchContext(messages, formatSearchResults(results));
        }
      } catch { /* 검색 실패 시 검색 없이 진행 */ }
    }

    response = await fetch("https://api.githubcopilot.com/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages: fallbackMessages, stream: true, temperature: 0.1 }),
      signal,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    debugLog(`API 에러 (/chat/completions) ${response.status}: ${text.slice(0, 300)}`);
    let code: string | undefined;
    try { code = JSON.parse(text)?.error?.code; } catch { /* ignore */ }
    if (code === "unsupported_api_for_model") {
      const err = new Error("unsupported_api_for_model");
      (err as Error & { incompatibleModelId?: string }).incompatibleModelId = model;
      (err as Error & { statusCode?: number }).statusCode = response.status;
      throw err;
    }
    const err = new Error(`${response.status}: ${text}`);
    (err as Error & { statusCode?: number }).statusCode = response.status;
    throw err;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";

  let toolCalls: { id: string; name: string; arguments: string }[] = [];
  let hasToolCalls = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) yield delta.content;

        if (delta.tool_calls) {
          hasToolCalls = true;
          for (const tc of delta.tool_calls) {
            if (tc.id) toolCalls.push({ id: tc.id, name: tc.function?.name ?? "", arguments: "" });
            if (tc.function?.arguments && toolCalls.length > 0) {
              toolCalls[toolCalls.length - 1].arguments += tc.function.arguments;
            }
          }
        }
      } catch { /* 파싱 실패 무시 */ }
    }
  }

  // Tool calling 성공 시: 검색 실행 → 결과를 시스템 프롬프트에 주입 후 재요청
  if (hasToolCalls && toolCalls.length > 0 && webSearch) {
    const searchCall = toolCalls.find((tc) => tc.name === "web_search");
    if (searchCall) {
      debugLog(`Tool call 감지: web_search(${searchCall.arguments})`);
      let args: { query: string; count?: number };
      try {
        args = JSON.parse(searchCall.arguments);
      } catch {
        debugLog(`Tool call arguments parse failed: ${searchCall.arguments}`);
        yield "\n\n⚠️ Web search request failed. Please try again.";
        return;
      }

      yield `\n\n🔍 Searching "${args.query}"...\n`;

      try {
        const results = await performSearch(args.query, webSearch.engine, webSearch.apiKey, args.count);
        debugLog(`검색 결과: ${results.length}건`);

        if (results.length === 0) {
          yield "No results found. Answering from general knowledge.\n\n";
          yield* streamChatCompletionsFlow(messages, copilotToken, vsCodeVersion, model, signal, undefined);
          return;
        }

        yield `Found ${results.length} results. Generating answer...\n\n`;

        const searchContext = formatSearchResults(results);
        const contextMessages = injectSearchContext(messages, searchContext);

        // 검색 결과 주입 후 재요청 — tools 없이 전송 (재검색 방지)
        yield* streamChatCompletionsFlow(contextMessages, copilotToken, vsCodeVersion, model, signal, undefined);
      } catch (searchErr) {
        debugLog(`검색 에러: ${searchErr}`);
        yield "⚠️ Search error. Answering from general knowledge.\n\n";
        yield* streamChatCompletionsFlow(messages, copilotToken, vsCodeVersion, model, signal, undefined);
      }
    }
  }
}

// --- /responses 엔드포인트 (Codex, GPT-5.4 등) ---

function extractForResponsesApi(messages: ChatMessage[]): {
  instructions: string | undefined;
  input: { role: string; content: string | ContentPart[] | null }[];
} {
  const systemMessages: string[] = [];
  const input: { role: string; content: string | ContentPart[] | null }[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string") {
        systemMessages.push(m.content);
      }
    } else {
      input.push({
        role: m.role === "tool" ? "user" : m.role,
        content: m.content,
      });
    }
  }

  return {
    instructions: systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined,
    input,
  };
}

async function* streamResponsesCompletion(
  messages: ChatMessage[],
  copilotToken: string,
  vsCodeVersion: string,
  model: string,
  signal?: AbortSignal,
  webSearch?: WebSearchConfig
): AsyncGenerator<string> {
  let finalMessages = messages;
  if (webSearch?.enabled) {
    const userQuery = extractLastUserQuery(messages);
    if (userQuery) {
      try {
        const results = await performSearch(userQuery, webSearch.engine, webSearch.apiKey, 5);
        if (results.length > 0) {
          finalMessages = injectSearchContext(messages, formatSearchResults(results));
        }
      } catch { /* 검색 실패 시 검색 없이 진행 */ }
    }
  }

  const { instructions, input } = extractForResponsesApi(finalMessages);

  const body: Record<string, unknown> = { model, input, stream: true };
  if (instructions) body.instructions = instructions;

  debugLog(`API 요청 (/responses): model=${model}, instructions=${!!instructions}, inputCount=${input.length}`);

  const response = await fetch("https://api.githubcopilot.com/responses", {
    method: "POST",
    headers: COPILOT_HEADERS(copilotToken, vsCodeVersion),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    debugLog(`API 에러 (/responses) ${response.status}: ${text.slice(0, 300)}`);
    let code: string | undefined;
    try { code = JSON.parse(text)?.error?.code; } catch { /* ignore */ }
    if (code === "unsupported_api_for_model") {
      const err = new Error("unsupported_api_for_model");
      (err as Error & { incompatibleModelId?: string }).incompatibleModelId = model;
      throw err;
    }
    const err = new Error(`${response.status}: ${text}`);
    (err as Error & { statusCode?: number }).statusCode = response.status;
    throw err;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "response.output_text.delta" && parsed.delta) {
          yield parsed.delta;
        }
      } catch { /* 파싱 실패 무시 */ }
    }
  }
}

function extractLastUserQuery(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const content = messages[i].content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const text = content.find((p) => p.type === "text");
        if (text && "text" in text) return text.text;
      }
    }
  }
  return null;
}

function injectSearchContext(messages: ChatMessage[], searchContext: string): ChatMessage[] {
  const result = [...messages];
  const systemIdx = result.findIndex((m) => m.role === "system");
  const searchNote = `\n\n---\n[Web Search Results]\n${searchContext}\n---\nIMPORTANT INSTRUCTIONS FOR SEARCH RESULTS:
- Answer IMMEDIATELY using ONLY the search results above. Do NOT say you will "investigate further", "check the webpage", or "please wait".
- You CANNOT browse URLs, visit websites, or perform any additional research. You can ONLY use the text provided above.
- Provide your complete answer NOW in a single response. Never promise future actions you cannot perform.
- Cite sources with URLs from the search results when relevant.`;
  if (systemIdx >= 0) {
    const sys = result[systemIdx];
    result[systemIdx] = { ...sys, content: (typeof sys.content === "string" ? sys.content : "") + searchNote };
  } else {
    result.unshift({ role: "system", content: searchNote.trim() });
  }
  return result;
}
