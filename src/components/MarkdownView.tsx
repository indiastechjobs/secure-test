import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface MarkdownViewProps {
  text: string;
}

interface Block {
  type: "code" | "text";
  language?: string;
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ text }) => {
  const blocks: Block[] = [];
  const parts = text.split("```");

  parts.forEach((part, index) => {
    // If the index is odd, it is a code block
    if (index % 2 === 1) {
      const firstNewLine = part.indexOf("\n");
      let language = "code";
      let content = part;

      if (firstNewLine !== -1) {
        language = part.substring(0, firstNewLine).trim() || "code";
        content = part.substring(firstNewLine + 1);
      }

      blocks.push({
        type: "code",
        language,
        content: content.trim(),
      });
    } else {
      if (part) {
        blocks.push({
          type: "text",
          content: part,
        });
      }
    }
  });

  return (
    <div className="space-y-4 text-gray-800 leading-relaxed break-words text-sm md:text-base">
      {blocks.map((block, bIdx) => {
        if (block.type === "code") {
          return (
            <CodeBlock
              key={bIdx}
              content={block.content}
              language={block.language || "code"}
            />
          );
        }

        return <TextBlock key={bIdx} content={block.content} />;
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ content: string; language: string }> = ({
  content,
  language,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 font-mono text-xs md:text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
        <span className="text-zinc-500 font-medium uppercase tracking-wider text-[10px]">
          {language}
        </span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors duration-150"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-500" />
              <span className="text-green-500 text-[11px] font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span className="text-[11px] font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-zinc-100 whitespace-pre scrollbar-thin">
        <code>{content}</code>
      </div>
    </div>
  );
};

const TextBlock: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split("\n");
  const parsedElements: React.ReactNode[] = [];

  let currentParagraph: string[] = [];

  const flushParagraph = (key: string) => {
    if (currentParagraph.length > 0) {
      parsedElements.push(
        <p key={key} className="mb-3 text-zinc-700 leading-relaxed font-sans">
          {formatInlineText(currentParagraph.join(" "))}
        </p>
      );
      currentParagraph = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check for Headings
    if (trimmed.startsWith("# ")) {
      flushParagraph(`p-${index}`);
      parsedElements.push(
        <h1
          key={`h1-${index}`}
          className="text-xl md:text-2xl font-bold text-zinc-900 mt-6 mb-3 font-sans"
        >
          {formatInlineText(trimmed.replace("# ", ""))}
        </h1>
      );
    } else if (trimmed.startsWith("## ")) {
      flushParagraph(`p-${index}`);
      parsedElements.push(
        <h2
          key={`h2-${index}`}
          className="text-lg md:text-xl font-bold text-zinc-900 mt-5 mb-2.5 font-sans"
        >
          {formatInlineText(trimmed.replace("## ", ""))}
        </h2>
      );
    } else if (trimmed.startsWith("### ")) {
      flushParagraph(`p-${index}`);
      parsedElements.push(
        <h3
          key={`h3-${index}`}
          className="text-base md:text-lg font-bold text-zinc-900 mt-4 mb-2 font-sans"
        >
          {formatInlineText(trimmed.replace("### ", ""))}
        </h3>
      );
    }
    // Check for List Items
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph(`p-${index}`);
      const listContent = trimmed.substring(2);
      parsedElements.push(
        <div
          key={`li-${index}`}
          className="flex items-start gap-2.5 my-1.5 pl-2 font-sans"
        >
          <span className="w-1.5 h-1.5 mt-2 rounded-full bg-zinc-400 flex-shrink-0" />
          <span className="text-zinc-700">{formatInlineText(listContent)}</span>
        </div>
      );
    }
    // Check for empty lines to signal a paragraph break
    else if (trimmed === "") {
      flushParagraph(`p-${index}`);
    }
    // Simple text accumulation
    else {
      currentParagraph.push(line);
    }
  });

  // Flush any leftover text
  flushParagraph(`p-final`);

  return <>{parsedElements}</>;
};

// Inline parsing helper for bold (**text**) and italic (*text*) and inline code (`code`)
function formatInlineText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let index = 0;

  // Pattern scanner for **, *, `
  while (index < text.length) {
    const doubleAsterisk = text.indexOf("**", index);
    const singleAsterisk = text.indexOf("*", index);
    const backtick = text.indexOf("`", index);

    // Find the closest token
    const indices = [
      doubleAsterisk !== -1 ? { type: "bold", idx: doubleAsterisk, len: 2 } : null,
      singleAsterisk !== -1 ? { type: "italic", idx: singleAsterisk, len: 1 } : null,
      backtick !== -1 ? { type: "code", idx: backtick, len: 1 } : null,
    ].filter((item) => item !== null) as { type: string; idx: number; len: number }[];

    if (indices.length === 0) {
      // No tokens left, add remaining text
      elements.push(text.substring(index));
      break;
    }

    // Sort by index to find the next item
    indices.sort((a, b) => a.idx - b.idx);
    const nextToken = indices[0];

    // Add plain text up to next token
    if (nextToken.idx > index) {
      elements.push(text.substring(index, nextToken.idx));
    }

    // Find the matching end token
    const startInner = nextToken.idx + nextToken.len;
    let endTokenStr = "";
    if (nextToken.type === "bold") endTokenStr = "**";
    else if (nextToken.type === "italic") endTokenStr = "*";
    else if (nextToken.type === "code") endTokenStr = "`";

    const endIdx = text.indexOf(endTokenStr, startInner);

    if (endIdx !== -1) {
      const innerText = text.substring(startInner, endIdx);
      if (nextToken.type === "bold") {
        elements.push(
          <strong key={`b-${startInner}`} className="font-semibold text-zinc-900">
            {innerText}
          </strong>
        );
      } else if (nextToken.type === "italic") {
        elements.push(
          <em key={`i-${startInner}`} className="italic text-zinc-800">
            {innerText}
          </em>
        );
      } else if (nextToken.type === "code") {
        elements.push(
          <code
            key={`ic-${startInner}`}
            className="px-1.5 py-0.5 rounded bg-zinc-100 text-pink-600 font-mono text-xs break-all"
          >
            {innerText}
          </code>
        );
      }
      index = endIdx + nextToken.len;
    } else {
      // Unmatched token, treat as plain text
      elements.push(text.substring(nextToken.idx, startInner));
      index = startInner;
    }
  }

  return elements;
}
