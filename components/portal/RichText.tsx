import type { ReactNode } from "react";

/**
 * A small, safe rich-text renderer for notice bodies.
 *
 * Offices write plain text; this adds just enough formatting to read well:
 *   **bold**   *italic*   [link text](https://…)   https://bare-links
 *   - bullet lines         ### short heading        blank line = new paragraph
 *
 * It builds React elements only — it never injects HTML — and links are limited
 * to http, https and mailto, so a pasted `javascript:` URL renders as plain text.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const close = token.indexOf("](");
      const label = token.slice(1, close);
      const href = token.slice(close + 2, -1);
      nodes.push(SAFE_HREF.test(href) ? <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">{label}</a> : label);
    } else {
      // Bare URL: trim trailing punctuation so "see https://x.bd." links cleanly.
      const url = token.replace(/[.,;:!?]+$/, "");
      nodes.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer nofollow">{url}</a>);
      if (url.length < token.length) nodes.push(token.slice(url.length));
    }
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "h"; text: string };

function blocksOf(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", lines: paragraph });
    if (list?.length) blocks.push({ kind: "ul", items: list });
    paragraph = [];
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
    const heading = /^#{2,3}\s+(.*)$/.exec(line.trim());
    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: "h", text: heading[1] });
    } else if (bullet) {
      if (paragraph.length) {
        blocks.push({ kind: "p", lines: paragraph });
        paragraph = [];
      }
      list = list ?? [];
      list.push(bullet[1]);
    } else {
      if (list?.length) {
        blocks.push({ kind: "ul", items: list });
        list = null;
      }
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export function RichText({ source, className = "" }: { source: string; className?: string }) {
  const blocks = blocksOf(String(source ?? ""));
  return (
    <div className={`rich-text ${className}`.trim()}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.kind === "h") return <h4 key={key}>{inline(block.text, key)}</h4>;
        if (block.kind === "ul") {
          return (
            <ul key={key}>
              {block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{inline(item, `${key}-${itemIndex}`)}</li>)}
            </ul>
          );
        }
        return (
          <p key={key}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {inline(line, `${key}-${lineIndex}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Plain-text preview for a collapsed card: markup stripped, whitespace collapsed. */
export function plainPreview(source: string, limit = 180) {
  const text = String(source ?? "")
    .replace(/\*\*|\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-•]|#{2,3})\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}
