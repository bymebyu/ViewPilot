import {
  saveKnownModelIds, loadKnownModelIds,
  saveModelMultiplierCache, loadModelMultiplierCache,
  loadIncompatibleModelIds,
} from "./storage";
import { debugLog } from "./browser-api";

// GitHub 공식 배율 데이터 (YAML)
const MULTIPLIERS_YAML_URL = "https://raw.githubusercontent.com/github/docs/main/data/tables/copilot/model-multipliers.yml";

/** GitHub docs YAML에서 display name → 배율 맵 반환 */
async function fetchMultipliersFromDocs(): Promise<Record<string, number>> {
  try {
    const res = await fetch(MULTIPLIERS_YAML_URL);
    if (!res.ok) {
      debugLog(`[모델] 배율 YAML fetch 실패: ${res.status}`);
      return {};
    }
    const yaml = await res.text();
    const result = parseMultipliersYaml(yaml);
    debugLog(`[모델] 배율 파싱 성공: ${Object.keys(result).length}개`);
    return result;
  } catch (e) {
    debugLog(`[모델] 배율 fetch 에러: ${e}`);
    return {};
  }
}

/** 간단 YAML 파서: - name: / multiplier_paid: 패턴 추출 */
function parseMultipliersYaml(yaml: string): Record<string, number> {
  const result: Record<string, number> = {};
  const lines = yaml.split("\n");
  let currentName = "";

  for (const line of lines) {
    const nameMatch = /^-\s*name:\s*(.+)/.exec(line);
    if (nameMatch) {
      currentName = nameMatch[1].trim();
      continue;
    }
    const multMatch = /^\s+multiplier_paid:\s*(.+)/.exec(line);
    if (multMatch && currentName) {
      const raw = multMatch[1].trim();
      let mult: number;
      if (raw === "0") {
        mult = 0;
      } else if (/not\s*applicable/i.test(raw)) {
        currentName = "";
        continue;
      } else {
        mult = parseFloat(raw);
        if (isNaN(mult)) { currentName = ""; continue; }
      }
      const id = currentName.toLowerCase().replace(/\s+/g, "-");
      result[id] = mult;
      currentName = "";
    }
  }
  return result;
}

/** docs 파싱 결과의 키와 모델 ID를 여러 변환으로 매칭 시도 */
function matchDocsMultiplier(id: string, docsMap: Record<string, number>): number | undefined {
  const lower = id.toLowerCase();
  // 직접 매칭
  if (docsMap[lower] !== undefined) return docsMap[lower];
  // 점↔하이픈 변환: "claude-sonnet-4.5" ↔ "claude-sonnet-4-5"
  const alt1 = lower.replace(/\./g, "-");
  if (docsMap[alt1] !== undefined) return docsMap[alt1];
  const alt2 = lower.replace(/-(\d)/g, ".$1");
  if (docsMap[alt2] !== undefined) return docsMap[alt2];
  // preview 접미사 제거: "gemini-3-flash-preview" → "gemini-3-flash"
  const noPreview = lower.replace(/-preview$/, "");
  if (docsMap[noPreview] !== undefined) return docsMap[noPreview];
  return undefined;
}

export interface CopilotModel {
  id: string;
  name: string;
  vendor: string;
  isPremium: boolean;
  multiplier?: number;
  preview?: boolean;
  isDefault?: boolean;
  supportedEndpoints?: string[];
  maxPromptTokens?: number;
}

/** 모델 ID prefix로 벤더 자동 추론 */
function inferVendor(id: string): string {
  const lower = id.toLowerCase();
  if (lower.startsWith("claude-")) return "Anthropic";
  if (lower.startsWith("gpt-") || lower.startsWith("o1-") || lower.startsWith("o3-") || lower.startsWith("o4-")) return "OpenAI";
  if (lower.startsWith("gemini-")) return "Google";
  if (lower.startsWith("grok-")) return "xAI";
  return "Other";
}

interface RawCopilotModel {
  id: string;
  name?: string;
  version?: string;
  vendor?: string;
  model_picker_enabled?: boolean;
  model_picker_category?: string;
  preview?: boolean;
  is_chat_default?: boolean;
  is_chat_fallback?: boolean;
  capabilities?: {
    type?: string;
    supports_streaming?: boolean;
    limits?: {
      max_context_window_tokens?: number;
      max_prompt_tokens?: number;
      max_output_tokens?: number;
    };
  };
  policy?: { state?: string; premium_requests_per_use?: number; multiplier?: number };
  billing?: { multiplier?: number };
  supported_endpoints?: string[];
}

export async function fetchAvailableModels(
  copilotToken: string,
  vsCodeVersion: string
): Promise<CopilotModel[]> {
  try {
    const response = await fetch("https://api.githubcopilot.com/models", {
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        "editor-version": `vscode/${vsCodeVersion}`,
        "Copilot-Integration-Id": "vscode-chat",
        "user-agent": "GitHubCopilotChat/0.22.4",
      },
    });
    const data = await response.json();
    const rawModels: RawCopilotModel[] = data.data ?? [];

    const [knownIds, multiplierCache, incompatibleIds] = await Promise.all([
      loadKnownModelIds(),
      loadModelMultiplierCache(),
      loadIncompatibleModelIds(),
    ]);

    const filtered = rawModels.filter((m) => {
      if (m.model_picker_enabled === false) return false;
      if (m.policy?.state === "disabled") return false;
      if (m.policy?.state === "unconfigured") return false;
      if (m.capabilities?.type && m.capabilities.type !== "chat") return false;
      if (incompatibleIds.includes(m.id)) return false;
      return true;
    });
    const currentIds = filtered.map((m) => m.id);

    // 1단계: API 응답에서 배율 추출
    for (const m of filtered.slice(0, 5)) {
      debugLog(`[모델] id=${m.id}, vendor=${m.vendor}, category=${m.model_picker_category}, caps=${JSON.stringify(m.capabilities)}`);
    }

    const models = filtered.map((m) => {
      const apiMultiplier = m.policy?.premium_requests_per_use ?? m.policy?.multiplier ?? m.billing?.multiplier;
      const multiplier = apiMultiplier ?? multiplierCache[m.id];
      return {
        raw: m,
        result: {
          id: m.id,
          name: m.name ?? m.id,
          vendor: m.vendor ?? inferVendor(m.id),
          isPremium: multiplier !== undefined ? multiplier > 0 : false,
          multiplier,
          preview: m.preview,
          isDefault: m.is_chat_default,
          supportedEndpoints: m.supported_endpoints,
          maxPromptTokens: m.capabilities?.limits?.max_prompt_tokens,
        },
      };
    });

    // 2단계: 배율이 없는 모델이 있으면 docs 파싱으로 채우기
    const missingMultiplier = models.filter((m) => m.result.multiplier === undefined);
    debugLog(`[모델] 배율 없는 모델: ${missingMultiplier.length}/${models.length}`);
    if (missingMultiplier.length > 0) {
      const docsMap = await fetchMultipliersFromDocs();
      debugLog(`[모델] docs 파싱: ${Object.keys(docsMap).length}개 항목, keys=${Object.keys(docsMap).join(",")}`);
      let cacheUpdated = false;
      for (const m of missingMultiplier) {
        // API id로 먼저 매칭, 실패 시 API name을 id로 변환해서 재시도
        let mult = matchDocsMultiplier(m.result.id, docsMap);
        if (mult === undefined) {
          const nameAsId = m.result.name.toLowerCase().replace(/\s+/g, "-").replace(/\(.*?\)/g, "").replace(/-+$/, "").trim();
          mult = matchDocsMultiplier(nameAsId, docsMap);
        }
        if (mult !== undefined) {
          m.result.multiplier = mult;
          m.result.isPremium = mult > 0;
          multiplierCache[m.result.id] = mult;
          cacheUpdated = true;
        }
      }
      if (cacheUpdated) {
        await saveModelMultiplierCache(multiplierCache);
      }
    }

    // 3단계: 알려진 모델 ID 업데이트
    const newIds = currentIds.filter((id) => !knownIds.includes(id));
    if (newIds.length > 0 || knownIds.length === 0) {
      await saveKnownModelIds(currentIds);
    }

    return sortModels(models.map((m) => m.result));
  } catch {
    return [];
  }
}

// GPT → Gemini → Claude → Grok → 기타
const VENDOR_SORT_ORDER: Record<string, number> = {
  OpenAI: 0,
  Google: 1,
  Anthropic: 2,
  xAI: 3,
};

/** 모델 이름/ID에서 버전 숫자 추출 (높을수록 최신) */
function extractVersion(id: string): number {
  const m = /(\d+)[\.\-]?(\d+)?/.exec(id);
  if (!m) return 0;
  return parseFloat(`${m[1]}.${m[2] ?? 0}`);
}

/** 정렬: 1. 배율 오름차순 → 2. 컨텍스트 내림차순 → 3. 벤더 우선순위 → 4. 버전 내림차순 */
export function sortModels(models: CopilotModel[]): CopilotModel[] {
  return [...models].sort((a, b) => {
    // 1. 배율 오름차순 (비용 적은 것 우선, undefined는 맨 뒤)
    const multA = a.multiplier ?? 999;
    const multB = b.multiplier ?? 999;
    if (multA !== multB) return multA - multB;

    // 2. 컨텍스트 크기 내림차순 (큰 것 우선, undefined는 맨 뒤)
    const ctxA = a.maxPromptTokens ?? 0;
    const ctxB = b.maxPromptTokens ?? 0;
    if (ctxA !== ctxB) return ctxB - ctxA;

    // 3. 벤더 우선순위 (GPT → Gemini → Claude → Grok → 기타)
    const vendorA = VENDOR_SORT_ORDER[a.vendor] ?? 99;
    const vendorB = VENDOR_SORT_ORDER[b.vendor] ?? 99;
    if (vendorA !== vendorB) return vendorA - vendorB;

    // 4. 같은 벤더 내에서 버전 내림차순 (최신이 위)
    const verA = extractVersion(a.id);
    const verB = extractVersion(b.id);
    if (verA !== verB) return verB - verA;

    return a.name.localeCompare(b.name);
  });
}

export function groupModelsByVendor(models: CopilotModel[]): Record<string, CopilotModel[]> {
  return models.reduce((acc, model) => {
    if (!acc[model.vendor]) acc[model.vendor] = [];
    acc[model.vendor].push(model);
    return acc;
  }, {} as Record<string, CopilotModel[]>);
}

/** 기본 모델: 서버 지정 → 무료 GPT 최상위 버전 → 첫 번째 무료 모델 → 첫 번째 모델 */
export function pickDefaultModel(models: CopilotModel[]): CopilotModel | undefined {
  const serverDefault = models.find((m) => m.isDefault);
  if (serverDefault) return serverDefault;

  // 무료 GPT 모델 중 버전 가장 높은 것
  const freeGpt = models
    .filter((m) => m.multiplier === 0 && m.id.startsWith("gpt-"))
    .sort((a, b) => extractVersion(b.id) - extractVersion(a.id));
  if (freeGpt.length > 0) return freeGpt[0];

  return models.find((m) => m.multiplier === 0) ?? models[0];
}
