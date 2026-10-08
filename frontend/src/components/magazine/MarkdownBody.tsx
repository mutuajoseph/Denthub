import { Fragment, type ReactNode, useMemo } from "react";

/**
 * Renders the article body, which is a small Markdown subset.
 *
 * Supports headings, paragraphs, unordered and ordered lists, bold, italic,
 * and links. Everything else is HTML-escaped first, so a stray angle bracket
 * in editorial copy renders as text rather than markup. Link targets only
 * allow http(s), mailto, and relative URLs - a `javascript:` target is never
 * rendered as a link.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const INLINE_RE = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)\s]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function linkTarget(href: string): string | null {
  if (href.startsWith("/") || href.startsWith("#")) return href;
  if (href.startsWith("mailto:")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return null;
}

function renderInline(text: string, keyCounter: () => number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  const matches = Array.from(text.matchAll(INLINE_RE));

  for (const match of matches) {
    const from = match.index ?? 0;
    const before = text.slice(lastIndex, from);
    if (before) {
      nodes.push(<Fragment key={keyCounter()}>{before}</Fragment>);
    }

    const token = match[0];

    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      nodes.push(
        <strong key={keyCounter()} className="font-semibold">
          {escapeHtml(token.slice(2, -2))}
        </strong>,
      );
    } else if (token.startsWith("_") && token.endsWith("_") && token.length > 2) {
      nodes.push(<em key={keyCounter()}>{escapeHtml(token.slice(1, -1))}</em>);
    } else {
      const link = LINK_RE.exec(token);
      const target = link ? linkTarget(link[2]) : null;

      if (link && target !== null) {
        nodes.push(
          <a
            key={keyCounter()}
            href={target}
            target={target.startsWith("/") || target.startsWith("#") ? undefined : "_blank"}
            rel={target.startsWith("/") || target.startsWith("#") ? undefined : "noreferrer"}
            className="font-medium text-orange-500 underline underline-offset-2 hover:text-orange-600 dark:text-gold-300"
          >
            {escapeHtml(link[1])}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={keyCounter()}>{escapeHtml(token)}</Fragment>);
      }
    }

    lastIndex = from + token.length;
  }

  const rest = text.slice(lastIndex);
  if (rest) {
    nodes.push(<Fragment key={keyCounter()}>{rest}</Fragment>);
  }

  return nodes;
}

function renderBlocks(body: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = body.split("\n");
  let index = 0;
  let key = 0;
  const nextKey = () => key++;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(
        <h3
          key={nextKey()}
          className="mt-6 font-display text-lg font-bold text-gray-900 dark:text-white"
        >
          {renderInline(line.slice(4).trim(), nextKey)}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <h2
          key={nextKey()}
          className="mt-6 font-display text-xl font-bold text-gray-900 dark:text-white"
        >
          {renderInline(line.slice(3).trim(), nextKey)}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index].trim())) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={nextKey()} className="mt-4 list-disc space-y-2 pl-5">
          {items.map((item) => (
            <li key={nextKey()}>{renderInline(item, nextKey)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\. /, ""));
        index += 1;
      }
      nodes.push(
        <ol key={nextKey()} className="mt-4 list-decimal space-y-2 pl-5">
          {items.map((item) => (
            <li key={nextKey()}>{renderInline(item, nextKey)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !lines[index].startsWith("## ") &&
      !lines[index].startsWith("### ") &&
      !/^[-*] /.test(lines[index]) &&
      !/^\d+\. /.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }

    nodes.push(
      <p key={nextKey()} className="mt-4 leading-7 text-gray-600 dark:text-gray-300">
        {renderInline(paragraph.join(" "), nextKey)}
      </p>,
    );
  }

  return nodes;
}

export function MarkdownBody({ body }: { body: string }) {
  const blocks = useMemo(() => renderBlocks(body), [body]);

  return <div>{blocks}</div>;
}
