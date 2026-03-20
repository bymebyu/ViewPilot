export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCachedResults(query: string): SearchResult[] | null {
  const entry = searchCache.get(query.toLowerCase().trim());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    searchCache.delete(query.toLowerCase().trim());
    return null;
  }
  return entry.results;
}

function setCachedResults(query: string, results: SearchResult[]): void {
  // 캐시 크기 제한 (최대 50개)
  if (searchCache.size >= 50) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  searchCache.set(query.toLowerCase().trim(), { results, timestamp: Date.now() });
}

export const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description:
      "Search the web for information. Use this when: (1) the user explicitly asks to search the web, (2) the question involves recent events, current data, or real-time information, (3) the user asks about something you're unsure about and web results would help, or (4) the user asks for links, sources, or references.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        count: {
          type: "number",
          description: "Number of results to return (default 5, max 20)",
        },
      },
      required: ["query"],
    },
  },
};

export async function braveSearch(
  query: string,
  apiKey: string,
  count: number = 5
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, count: String(count) });
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Brave Search API error: ${response.status}`);
  }

  const data = await response.json();
  const results: SearchResult[] = (data.web?.results ?? []).map(
    (r: { title?: string; url?: string; description?: string }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      description: r.description ?? "",
    })
  );

  return results;
}

export async function duckduckgoSearch(
  query: string,
  count: number = 5
): Promise<SearchResult[]> {
  // DuckDuckGo HTML 검색 — 실제 웹검색 결과 반환
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!response.ok) throw new Error(`DuckDuckGo error: ${response.status}`);

  const html = await response.text();
  const results: SearchResult[] = [];

  // HTML 파싱: 각 검색 결과는 class="result" 안에 있음
  const resultBlocks = html.split('class="result results_links');
  for (let i = 1; i < resultBlocks.length && results.length < count; i++) {
    const block = resultBlocks[i];
    // URL 추출: class="result__a" href="..."
    const urlMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/);
    // 제목 추출: <a class="result__a">...</a>
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
    // 설명 추출: class="result__snippet"
    const descMatch = block.match(/class="result__snippet">([^<]+)</);

    if (urlMatch && titleMatch) {
      let url = urlMatch[1];
      // DuckDuckGo redirect URL 디코딩
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);

      results.push({
        title: titleMatch[1].trim(),
        url,
        description: descMatch ? descMatch[1].trim() : "",
      });
    }
  }

  return results;
}

export async function serperSearch(
  query: string,
  apiKey: string,
  count: number = 5
): Promise<SearchResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: Math.min(count, 20) }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();
  const results: SearchResult[] = (data.organic ?? []).slice(0, count).map(
    (r: { title?: string; link?: string; snippet?: string }) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      description: r.snippet ?? "",
    })
  );

  return results;
}

export async function performSearch(
  query: string,
  engine: "brave" | "serper" | "duckduckgo",
  apiKey?: string,
  count: number = 5
): Promise<SearchResult[]> {
  // 캐시 확인
  const cached = getCachedResults(query);
  if (cached) return cached.slice(0, count);

  let results: SearchResult[];
  if (engine === "serper" && apiKey) {
    results = await serperSearch(query, apiKey, count);
  } else if (engine === "brave" && apiKey) {
    results = await braveSearch(query, apiKey, count);
  } else {
    results = await duckduckgoSearch(query, count);
  }

  // 캐시 저장
  if (results.length > 0) {
    setCachedResults(query, results);
  }

  return results;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No search results found.";
  }

  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`
    )
    .join("\n\n");
}
