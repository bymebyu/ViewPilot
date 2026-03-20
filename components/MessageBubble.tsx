import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import hljs from "highlight.js";
import "highlight.js/styles/vs2015.css";
import type { Message } from "../store/chat-store";
import { useChatStore } from "../store/chat-store";
import { useTranslation } from "../hooks/useTranslation";

function wrapAsciiArtBlocks(content: string): string {
  // 유니코드 박스드로잉/채워진 화살표 (강한 지시자)
  const boxDrawing = /[─━│┃┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬═║▶◀▲▼►◄⬆⬇⬅➡]/;
  const lightArrow = /[↑↓←→]/;
  // ASCII 다이어그램 패턴 (강한 지시자)
  const asciiPipeLayout = /\|[^|\n]{2,}\|[^|\n]+\|/;  // | cell | cell | (파이프로 구분된 3+ 셀)
  const asciiBorder = /\|[-=]{3,}/;                    // |-----  (파이프 + 3개 이상 대시/등호)

  // Markdown GFM 테이블 감지: |---|---| 구분선이 있으면 테이블 → 래핑 제외
  function isMarkdownTableBlock(lines: string[]): boolean {
    return lines.some(line => /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line.trim()));
  }

  const lines = content.split('\n');
  const out: string[] = [];
  let inFence = false;
  let fenceChar = '';
  let artLines: string[] = [];
  let hasStrong = false;

  const flush = () => {
    if (artLines.length >= 2 && hasStrong) {
      if (isMarkdownTableBlock(artLines)) {
        // GFM 테이블은 앞뒤 빈 줄이 있어야 파싱됨
        if (out.length > 0 && out[out.length - 1] !== '') out.push('');
        out.push(...artLines);
        out.push('');
      } else {
        out.push('```');
        out.push(...artLines);
        out.push('```');
      }
    } else {
      out.push(...artLines);
    }
    artLines = [];
    hasStrong = false;
  };

  for (const line of lines) {
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!inFence) {
        flush();
        inFence = true;
        fenceChar = fenceMatch[1][0];
      } else if (fenceMatch[1][0] === fenceChar && line.trim() === fenceMatch[0]) {
        inFence = false;
        fenceChar = '';
      }
      out.push(line);
      continue;
    }
    if (inFence) { out.push(line); continue; }

    const isStrongArt = boxDrawing.test(line) || asciiPipeLayout.test(line) || asciiBorder.test(line);
    const isLightArt = !isStrongArt && lightArrow.test(line);

    if (isStrongArt) {
      artLines.push(line);
      hasStrong = true;
    } else if (isLightArt && artLines.length > 0) {
      artLines.push(line);
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join('\n');
}

function fixPartialMarkdown(content: string): string {
  content = wrapAsciiArtBlocks(content);
  const lines = content.split('\n');
  let inFence = false;
  let fenceChar = '';
  let suffix = '';

  // 코드펜스 상태 추적
  for (const line of lines) {
    const match = /^(`{3,}|~{3,})/.exec(line);
    if (!inFence) {
      if (match) { inFence = true; fenceChar = match[1][0]; }
    } else {
      if (match && match[1][0] === fenceChar && line.trim() === match[0]) {
        inFence = false; fenceChar = '';
      }
    }
  }

  if (inFence) {
    // 열린 코드펜스 닫기 (이전과 동일)
    return content + '\n' + fenceChar.repeat(3);
  }

  // 코드펜스 밖에서만 아래 처리 수행
  // 열린 인라인 백틱 닫기
  // 코드블록 밖의 텍스트에서 홀수 개의 백틱 감지
  const outsideFenceText = (() => {
    const result: string[] = [];
    let fence = false;
    let fc = '';
    for (const line of lines) {
      const m = /^(`{3,}|~{3,})/.exec(line);
      if (!fence) {
        if (m) { fence = true; fc = m[1][0]; }
        else result.push(line);
      } else {
        if (m && m[1][0] === fc && line.trim() === m[0]) { fence = false; fc = ''; }
      }
    }
    return result.join('\n');
  })();

  // 홀수 개의 단일 백틱 → 닫기 필요
  const backtickCount = (outsideFenceText.match(/(?<!`)`(?!`)/g) || []).length;
  if (backtickCount % 2 !== 0) suffix += '`';

  // 홀수 개의 ** (bold) → 닫기 필요
  const boldCount = (outsideFenceText.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) suffix += '**';

  // 홀수 개의 __ (bold alt) → 닫기
  const boldAltCount = (outsideFenceText.match(/__/g) || []).length;
  if (boldAltCount % 2 !== 0) suffix += '__';

  // 홀수 개의 단일 * (italic) → 닫기 필요 (**를 제외한 단독 *)
  const italicStarCount = (outsideFenceText.match(/(?<!\*)\*(?!\*)/g) || []).length;
  if (italicStarCount % 2 !== 0) suffix += '*';

  // 홀수 개의 단일 _ (italic) → 닫기 필요 (__를 제외한 단독 _)
  const italicUnderCount = (outsideFenceText.match(/(?<!_)_(?!_)/g) || []).length;
  if (italicUnderCount % 2 !== 0) suffix += '_';

  // $$ (display math) → 닫기 필요
  const displayMathCount = (outsideFenceText.match(/\$\$/g) || []).length;
  if (displayMathCount % 2 !== 0) suffix += '$$';

  // 홀수 개의 단일 $ (inline math) → 닫기 필요 ($$를 제외한 단독 $)
  const inlineMathCount = (outsideFenceText.match(/(?<!\$)\$(?!\$)/g) || []).length;
  if (inlineMathCount % 2 !== 0) suffix += '$';

  // 마지막 줄이 테이블 행이고 |로 끝나지 않으면 | 추가
  const lastLine = lines[lines.length - 1] ?? '';
  if (lastLine.startsWith('|') && !lastLine.trimEnd().endsWith('|')) {
    return content + ' |' + suffix;
  }

  return suffix ? content + suffix : content;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-400/80 text-black rounded-sm px-0.5">{part}</mark>
      : part
  );
}

function highlightChildren(children: React.ReactNode, query: string): React.ReactNode {
  if (!query) return children;
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return highlightText(child, query);
    }
    return child;
  });
}

function downloadAsFile(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyOrDownload(text: string, filename: string, clipboardFullMsg: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ok = window.confirm(clipboardFullMsg);
    if (ok) downloadAsFile(text, filename);
    return false;
  }
}

export default function MessageBubble({
  message,
  isStreaming,
  searchQuery,
  isCurrentMatch,
}: {
  message: Message;
  isStreaming?: boolean;
  searchQuery?: string;
  isCurrentMatch?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { setPrefillText } = useChatStore();

  const handleQuote = () => {
    const quoted = message.content
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    setPrefillText(quoted + '\n\n');
  };

  const handleCopy = async () => {
    const ok = await copyOrDownload(
      message.content,
      `copilot-response-${Date.now()}.md`,
      t("bubble.clipboardFull")
    );
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (message.role === "user") {
    return (
      <div className="group flex justify-end animate-fade-in-up">
        <div className="max-w-[85%] flex flex-col gap-1.5 items-end">
          {/* 이미지 첨부파일 */}
          {message.attachments?.filter((a) => a.type === "image" && a.dataUrl).map((att) => (
            <img
              key={att.id}
              src={att.dataUrl}
              alt={att.name}
              className="max-w-full rounded-xl border border-gray-700 max-h-48 object-contain bg-gray-900 cursor-pointer hover:opacity-90 transition-opacity"
              title={t("bubble.openAttachment")}
              onClick={() => {
                fetch(att.dataUrl!)
                  .then((r) => r.blob())
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    window.open(url);
                    setTimeout(() => URL.revokeObjectURL(url), 3000);
                  });
              }}
            />
          ))}
          {/* 텍스트 파일 첨부 표시 */}
          {message.attachments?.filter((a) => a.type === "text").map((att) => (
            <button
              key={att.id}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg px-2.5 py-1 text-xs text-gray-200 transition-colors cursor-pointer"
              title={t("bubble.openAttachment")}
              onClick={() => {
                if (!att.text) return;
                const blob = new Blob([att.text], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                window.open(url);
                setTimeout(() => URL.revokeObjectURL(url), 3000);
              }}
            >
              <span>📄</span>
              <span>{att.name}</span>
            </button>
          ))}
          {/* 메시지 텍스트 */}
          {message.content && (
            <div className={`relative bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm whitespace-pre-wrap select-text
              ${isCurrentMatch ? 'ring-2 ring-yellow-400' : ''}`}>
              <button
                onClick={handleCopy}
                className="absolute -top-2 left-1 opacity-0 group-hover:opacity-100
                           text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600
                           text-gray-400 hover:text-white rounded transition-all z-10 whitespace-nowrap"
                title={t("bubble.copy")}
              >
                {copied ? t("bubble.copied") : t("bubble.copy")}
              </button>
              {searchQuery ? highlightText(message.content, searchQuery) : message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start animate-fade-in-up">
      <div className={`relative max-w-[95%] bg-gray-800 rounded-2xl rounded-tl-sm px-3 py-2 text-sm select-text
        ${isCurrentMatch ? 'ring-2 ring-yellow-400' : ''}`}>
        {!isStreaming && message.content && (
          <div className="absolute -top-2 right-1 opacity-0 group-hover:opacity-100 flex gap-1 transition-all z-10">
            <button
              onClick={handleQuote}
              className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600
                         text-gray-400 hover:text-white rounded whitespace-nowrap"
              title={t("bubble.quote")}
            >
              {t("bubble.quote")}
            </button>
            <button
              onClick={handleCopy}
              className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600
                         text-gray-400 hover:text-white rounded whitespace-nowrap"
              title={t("bubble.copy")}
            >
              {copied ? t("bubble.copied") : t("bubble.copy")}
            </button>
          </div>
        )}
        {message.content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeRaw]}
            key={isStreaming ? undefined : message.id}
            components={{
                code({ className, children }) {
                  const [blockCopied, setBlockCopied] = useState(false);
                  const match = /language-(\w+)/.exec(className || "");
                  const lang = match?.[1];
                  const code = String(children).replace(/\n$/, "");
                  const isBlock = className !== undefined || code.includes('\n');

                  const copyBlock = () => {
                    navigator.clipboard.writeText(code);
                    setBlockCopied(true);
                    setTimeout(() => setBlockCopied(false), 2000);
                  };

                  const copyBtnClass = "opacity-0 group-hover:opacity-100 hover:text-white transition-opacity text-[10px] text-gray-400 bg-gray-900/80 px-1.5 py-0.5 rounded";
                  const copyLabel = blockCopied ? t("bubble.copied") : t("bubble.copy");
                  const lineCount = code.split('\n').length;
                  const showBottomBtn = lineCount > 4;

                  if (isBlock) {
                    if (lang && hljs.getLanguage(lang)) {
                      return (
                        <div className="relative group my-2">
                          <div className="flex justify-between bg-gray-900 px-3 py-1 rounded-t text-xs text-gray-400">
                            <span>{lang}</span>
                            <button onClick={copyBlock} className={`${copyBtnClass} mr-7`}>
                              {copyLabel}
                            </button>
                          </div>
                          <pre className="bg-gray-950 rounded-b overflow-x-auto p-3 text-xs">
                            <code
                              dangerouslySetInnerHTML={{
                                __html: hljs.highlight(code, { language: lang }).value,
                              }}
                            />
                          </pre>
                          {showBottomBtn && (
                            <button onClick={copyBlock} className={`absolute bottom-2 right-7 ${copyBtnClass}`}>
                              {copyLabel}
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="relative group my-2">
                        <button onClick={copyBlock} className={`absolute top-2 right-7 z-10 ${copyBtnClass}`}>
                          {copyLabel}
                        </button>
                        <pre className="bg-gray-950 rounded overflow-x-auto p-3 text-xs">
                          <code className="text-gray-300">{code}</code>
                        </pre>
                        {showBottomBtn && (
                          <button onClick={copyBlock} className={`absolute bottom-2 right-7 z-10 ${copyBtnClass}`}>
                            {copyLabel}
                          </button>
                        )}
                      </div>
                    );
                  }
                  return <code className="bg-gray-700 px-1 rounded text-xs text-gray-200">{children}</code>;
                },
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{searchQuery ? highlightChildren(children, searchQuery) : children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="ml-2 [&>p]:inline [&>p]:mb-0">{searchQuery ? highlightChildren(children, searchQuery) : children}</li>,
                a: ({ href, children }) => (
                  <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.open(href); }} className="text-blue-400 hover:underline cursor-pointer">
                    {searchQuery ? highlightChildren(children, searchQuery) : children}
                  </a>
                ),
                h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-1.5 text-gray-100 border-b border-gray-700 pb-1">{searchQuery ? highlightChildren(children, searchQuery) : children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mt-2.5 mb-1 text-gray-100">{searchQuery ? highlightChildren(children, searchQuery) : children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-200">{searchQuery ? highlightChildren(children, searchQuery) : children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-gray-500 pl-3 my-2 text-gray-400 italic">
                    {searchQuery ? highlightChildren(children, searchQuery) : children}
                  </blockquote>
                ),
                strong: ({ children }) => <strong className="font-semibold text-gray-100">{searchQuery ? highlightChildren(children, searchQuery) : children}</strong>,
                em: ({ children }) => <em className="italic text-gray-300">{searchQuery ? highlightChildren(children, searchQuery) : children}</em>,
                hr: () => <hr className="border-gray-700 my-3" />,
                del: ({ children }) => <del className="line-through text-gray-400">{searchQuery ? highlightChildren(children, searchQuery) : children}</del>,
                img: ({ src, alt }) => {
                  const [failed, setFailed] = React.useState(false);
                  if (!src) return null;
                  // 비정상 URL 필터링: 500자 초과 또는 같은 패턴 반복
                  const isFakeUrl = src.length > 500 || /(.{8,}?)\1{3,}/.test(src);
                  if (isFakeUrl) return alt ? <em className="text-gray-500 text-sm">{alt}</em> : null;
                  const openImage = () => window.open(src);
                  if (failed) return (
                    <span onClick={openImage} className="inline-flex items-center gap-1 text-blue-400 hover:underline text-sm cursor-pointer">
                      🖼 {alt || "View image"}
                    </span>
                  );
                  return (
                    <span onClick={openImage} className="block cursor-pointer">
                      <img src={src} alt={alt ?? ""} onError={() => setFailed(true)} className="max-w-full rounded my-2 hover:opacity-80 transition-opacity" loading="lazy" referrerPolicy="no-referrer" />
                    </span>
                  );
                },
                h4: ({ children }) => <h4 className="text-sm font-semibold mt-1.5 mb-0.5 text-gray-200">{searchQuery ? highlightChildren(children, searchQuery) : children}</h4>,
                h5: ({ children }) => <h5 className="text-xs font-semibold mt-1 mb-0.5 text-gray-300">{searchQuery ? highlightChildren(children, searchQuery) : children}</h5>,
                h6: ({ children }) => <h6 className="text-xs font-medium mt-1 mb-0.5 text-gray-400">{searchQuery ? highlightChildren(children, searchQuery) : children}</h6>,
                input: ({ checked }) => <input type="checkbox" checked={checked} disabled readOnly className="mr-1.5 accent-blue-500" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="text-xs border-collapse w-full">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-900">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-gray-700">{children}</tr>,
                th: ({ children }) => <th className="px-2 py-1 text-left font-semibold text-gray-300">{searchQuery ? highlightChildren(children, searchQuery) : children}</th>,
                td: ({ children }) => <td className="px-2 py-1 text-gray-300">{searchQuery ? highlightChildren(children, searchQuery) : children}</td>,
              }}
            >
              {fixPartialMarkdown(message.content)}
            </ReactMarkdown>
        ) : null}
        {isStreaming && (
          <span className="inline-block w-[2px] h-3.5 bg-blue-400 animate-cursor-blink ml-0.5 rounded-sm align-middle" />
        )}
      </div>
    </div>
  );
}

export { copyOrDownload, downloadAsFile };
