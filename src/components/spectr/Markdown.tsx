import { Fragment, useMemo, type ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, k) => {
    switch (n.t) {
      case "text":
        return <Fragment key={k}>{n.v}</Fragment>;
      case "br":
        return <br key={k} />;
      case "code":
        return <code key={k}>{n.v}</code>;
      case "strong":
        return <strong key={k}>{renderInline(n.c)}</strong>;
      case "em":
        return <em key={k}>{renderInline(n.c)}</em>;
      case "link":
        return (
          <a key={k} href={n.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(n.c)}
          </a>
        );
    }
  });
}

/**
 * Renders generated Markdown as React elements in the glass theme (.md-* styles). Raw HTML in the source is shown
 * as text, never parsed, and only http, https and mailto links become links.
 * `compact` is for short previews such as queue items: smaller headings, tighter spacing.
 */
export function Markdown({
  text,
  compact = false,
  className = "",
}: {
  text: string;
  compact?: boolean;
  className?: string;
}) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className={`md ${compact ? "md--compact" : ""} ${className}`.trim()}>
      {blocks.map((b, k) => {
        switch (b.t) {
          case "h": {
            const Tag = `h${b.level + 1}` as "h2" | "h3" | "h4";
            return (
              <Tag key={k} className={`md-h md-h${b.level}`}>
                {renderInline(b.c)}
              </Tag>
            );
          }
          case "p":
            return <p key={k}>{renderInline(b.c)}</p>;
          case "ul":
            return (
              <ul key={k}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} start={b.start}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            );
          case "quote":
            return <blockquote key={k}>{renderInline(b.c)}</blockquote>;
          case "hr":
            return <hr key={k} />;
        }
      })}
    </div>
  );
}
