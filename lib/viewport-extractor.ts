export interface ViewportContext {
  visibleText: string;
  url: string;
  title: string;
  scrollPosition: number;
  pageType: PageType;
  selectedText?: string;
}

export type PageType = "github-pr" | "github-issue" | "github-code" | "general";

export function getScrollContainer(): Element | null {
  const candidates: Element[] = [];
  const all = document.querySelectorAll("*");
  for (const el of all) {
    if (el === document.body || el === document.documentElement) continue;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    if (el.scrollHeight <= el.clientHeight + 10) continue;
    if (el.clientHeight <= window.innerHeight * 0.3) continue;
    candidates.push(el);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.clientHeight - a.clientHeight);
  return candidates[0];
}

export function extractViewportText(): ViewportContext {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const BUFFER = viewportHeight * 0.5;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const el = node as Element;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return NodeFilter.FILTER_REJECT;
        }
        const tag = el.tagName.toLowerCase();
        if (["script", "style", "noscript", "head"].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        const rect = el.getBoundingClientRect();
        const isVisible =
          rect.top < viewportHeight + BUFFER && rect.bottom > -BUFFER &&
          rect.left < viewportWidth && rect.right > 0 && rect.height > 0;
        return isVisible ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    }
  );

  const visibleTexts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as Element;
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (directText) visibleTexts.push(directText);
  }

  const deduped: string[] = [];
  for (const t of visibleTexts) {
    if (t !== deduped[deduped.length - 1]) deduped.push(t);
  }
  const visibleText = deduped.join("\n").slice(0, 6000);
  const container = getScrollContainer();
  let scrollPosition: number;
  if (container) {
    const maxScroll = container.scrollHeight - container.clientHeight;
    scrollPosition = maxScroll > 0 ? Math.round((container.scrollTop / maxScroll) * 100) : 0;
  } else {
    const scrollHeight = document.documentElement.scrollHeight - viewportHeight;
    scrollPosition = scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 0;
  }

  return {
    visibleText,
    url: window.location.href,
    title: document.title,
    scrollPosition,
    pageType: detectPageType(),
    selectedText: window.getSelection()?.toString().trim() || undefined,
  };
}

function detectPageType(): PageType {
  const url = window.location.href;
  if (url.includes("github.com") && url.includes("/pull/")) return "github-pr";
  if (url.includes("github.com") && url.includes("/issues/")) return "github-issue";
  if (url.includes("github.com") && url.includes("/blob/")) return "github-code";
  return "general";
}

const LOCALE_LANGUAGE_MAP: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese", es: "Spanish",
};

export function buildSystemPrompt(ctx: ViewportContext, locale?: string): string {
  const pageTypeLabel: Record<PageType, string> = {
    "github-pr": "GitHub Pull Request page",
    "github-issue": "GitHub Issue page",
    "github-code": "GitHub code file",
    "general": "web page",
  };

  const langInstruction = locale && LOCALE_LANGUAGE_MAP[locale]
    ? `You MUST respond in ${LOCALE_LANGUAGE_MAP[locale]}.`
    : "Respond in the same language the user uses.";

  return `You are an adaptive expert assistant embedded in a Chrome sidebar.
Automatically identify the domain of the user's question and context (e.g., software engineering, system architecture, data science, medicine, law, finance, writing, design, etc.) and respond as a seasoned expert in that domain. If the question spans multiple domains, cover each with the appropriate expertise.
The user is currently viewing a ${pageTypeLabel[ctx.pageType]}.

URL: ${ctx.url}
Title: ${ctx.title}
Scroll position: ${ctx.scrollPosition}%

--- Currently visible content on screen ---
${ctx.visibleText}
--- End of visible content ---

${ctx.selectedText ? `User has selected this text: "${ctx.selectedText}"\n` : ""}
Use the visible content above as context for your answers.
${langInstruction}
Always format your response in Markdown.
When including images: ONLY use real, verified image URLs from web search results. NEVER fabricate, guess, or generate image URLs. If you don't have a real image URL, say so in text instead of making one up. When you do have a real URL, use Markdown image syntax: ![description](url).
When including tables, use standard Markdown (GFM) pipe-table syntax with pipe delimiters and a separator row (|---|---|).
When including multi-line diagrams, flowcharts, or ASCII art, always wrap them in a fenced code block (\`\`\`text or \`\`\`). Single-line inline notation (e.g., A → B) does not need a code block.
When including code, follow these rules without exception:
- Always use fenced code blocks with the correct language identifier (e.g., \`\`\`python, \`\`\`typescript, \`\`\`cpp).
- Before outputting any code, perform a strict character-level check on these high-error punctuation marks:
  - Quotes: every opening ' or " must have a matching closing ' or "
  - Parentheses: every ( must have a matching )
  - Brackets: every [ must have a matching ]
  - Braces: every { must have a matching }
  - Semicolons: every statement that requires a terminating ; must have one
- Also verify: no truncated lines, no missing operators, no broken string literals, indentation is consistent.
- Never output syntactically broken or incomplete code. If uncertain, fix it first or omit it and explain in text instead.`;
}
