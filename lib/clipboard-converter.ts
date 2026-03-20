import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// highlight.js로 렌더된 코드 블록 처리
turndown.addRule("highlightedCodeBlock", {
  filter(node) {
    return (
      node.nodeName === "PRE" &&
      node.querySelector("code") !== null
    );
  },
  replacement(_content, node) {
    const codeEl = (node as HTMLElement).querySelector("code");
    if (!codeEl) return _content;
    const langLabel = (node as HTMLElement).parentElement?.querySelector(".text-gray-400 > span")?.textContent || "";
    const code = codeEl.textContent || "";
    return `\n\`\`\`${langLabel}\n${code}\n\`\`\`\n`;
  },
});

// KaTeX display math (block) — must come before inline rule
turndown.addRule("katexDisplay", {
  filter(node) {
    return (
      node.nodeName === "SPAN" &&
      (node as HTMLElement).classList.contains("katex-display")
    );
  },
  replacement(_content, node) {
    const annotation = (node as HTMLElement).querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
      return `\n$$${annotation.textContent}$$\n`;
    }
    return _content;
  },
});

// KaTeX inline math
turndown.addRule("katexInline", {
  filter(node) {
    return (
      node.nodeName === "SPAN" &&
      (node as HTMLElement).classList.contains("katex")
    );
  },
  replacement(_content, node) {
    const annotation = (node as HTMLElement).querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
      return `$${annotation.textContent}$`;
    }
    return _content;
  },
});

// Checkbox (task list) 처리
turndown.addRule("checkbox", {
  filter(node) {
    return node.nodeName === "INPUT" && (node as HTMLInputElement).type === "checkbox";
  },
  replacement(_content, node) {
    return (node as HTMLInputElement).checked ? "[x] " : "[ ] ";
  },
});

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  // Remove copy buttons and other UI elements
  doc.querySelectorAll("button").forEach((el) => el.remove());

  // Remove the language label div from code blocks
  doc.querySelectorAll(".flex.justify-between.bg-gray-900").forEach((el) => el.remove());

  const md = turndown.turndown(doc.body);

  return md.replace(/\n{3,}/g, "\n\n").trim();
}
