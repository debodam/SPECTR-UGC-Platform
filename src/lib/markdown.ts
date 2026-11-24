/**
 * A small Markdown reader for generated content. It understands only what the writer produces: headings,
 * paragraphs with line breaks, bullet and numbered lists, block quotes, rules, bold, italics, inline code and links.
 * It never produces HTML strings, so rendering it (components/spectr/Markdown.tsx) cannot inject markup.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "br" };

export type Block =
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: Inline[][] }
  | { t: "ol"; start: number; items: Inline[][] }
  | { t: "quote"; c: Inline[] }
  | { t: "hr" };

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** Inline spans: links, code, bold, italics. Anything unmatched stays literal text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    if (rest[0] === "\n") {
      flush();
      out.push({ t: "br" });
      i++;
      continue;
    }
    if (rest[0] === "\\" && /[*_`[\]#\\]/.test(rest[1] ?? "")) {
      buf += rest[1];
      i += 2;
      continue;
    }
    let m = rest.match(/^`([^`\n]+)`/);
    if (m) {
      flush();
      out.push({ t: "code", v: m[1] });
      i += m[0].length;
      continue;
    }
    m = rest.match(/^\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/);
    if (m) {
      flush();
      if (SAFE_URL.test(m[2])) out.push({ t: "link", href: m[2], c: parseInline(m[1]) });
      else out.push(...parseInline(m[1]));
      i += m[0].length;
      continue;
    }
    m = rest.match(/^(\*\*|__)(\S|\S[\s\S]*?\S)\1/);
    if (m) {
      flush();
      out.push({ t: "strong", c: parseInline(m[2]) });
      i += m[0].length;
      continue;
    }
    // Single * or _ italics; an underscore inside a word (snake_case) is left alone.
    m = rest.match(/^(\*|_)(?=\S)([^*_\n]+?\S|\S)\1(?![A-Za-z0-9])/);
    if (m && !(m[1] === "_" && /[A-Za-z0-9]$/.test(buf))) {
      flush();
      out.push({ t: "em", c: parseInline(m[2]) });
      i += m[0].length;
      continue;
    }
    buf += rest[0];
    i++;
  }
  flush();
  return out;
}

const BULLET = /^\s{0,3}(?:[-*+•→▪◦●▸]|\d+[.)])\s+/;

/** Splits Markdown into blocks. */
export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join("\n").trim()) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      continue;
    }
    const h = trimmed.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (h) {
      flushPara();
      const level = Math.min(3, h[1].length) as 1 | 2 | 3;
      blocks.push({ t: "h", level, c: parseInline(h[2]) });
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      blocks.push({ t: "hr" });
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">"))
        quote.push(lines[i++].trim().replace(/^>\s?/, ""));
      i--;
      blocks.push({ t: "quote", c: parseInline(quote.join("\n")) });
      continue;
    }
    if (BULLET.test(line)) {
      flushPara();
      const ordered = /^\s{0,3}\d+[.)]\s/.test(line);
      const start = ordered ? parseInt(trimmed, 10) || 1 : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (BULLET.test(l) && /^\s{0,3}\d+[.)]\s/.test(l) === ordered) {
          items.push(l.replace(BULLET, ""));
        } else if (l.trim() && /^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1] += "\n" + l.trim();
        } else break;
        i++;
      }
      i--;
      const parsed = items.map((it) => parseInline(it.trim()));
      blocks.push(ordered ? { t: "ol", start, items: parsed } : { t: "ul", items: parsed });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks;
}

const plainInline = (c: Inline[]): string =>
  c
    .map((n) =>
      n.t === "text" || n.t === "code"
        ? n.v
        : n.t === "br"
          ? "\n"
          : n.t === "link"
            ? `${plainInline(n.c)} (${n.href})`
            : plainInline(n.c),
    )
    .join("");

/**
 * Generated content as clean plain text, with no Markdown symbols: what Copy, Open LinkedIn, DOCX and PDF use.
 * Headings become their own line, bullets become "•" and numbered items keep their numbers.
 */
export function toPlainText(md: string): string {
  return parseMarkdown(md)
    .map((b) => {
      if (b.t === "hr") return "";
      if (b.t === "ul") return b.items.map((it) => `• ${plainInline(it)}`).join("\n");
      if (b.t === "ol")
        return b.items.map((it, k) => `${b.start + k}. ${plainInline(it)}`).join("\n");
      return plainInline(b.c);
    })
    .filter((s, k, arr) => s !== "" || (k > 0 && arr[k - 1] !== ""))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One line of plain text for previews and titles. */
export function previewText(md: string, max = 120): string {
  return toPlainText(md).replace(/\s+/g, " ").trim().slice(0, max);
}
