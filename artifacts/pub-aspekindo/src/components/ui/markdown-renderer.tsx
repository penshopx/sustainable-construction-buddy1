import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React, { useMemo } from "react";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

function sanitize(raw: string): string {
  const text = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:div|span|font)[^>]*>/gi, "");

  const lines = text.split("\n");
  const result: string[] = [];

  // First pass: collapse blank lines inside table blocks so GFM parses them correctly.
  const collapsed: string[] = [];
  let inTableBlock = false;
  for (const line of lines) {
    const isTableLine = line.trimStart().startsWith("|");
    const isBlank = line.trim() === "";

    if (isTableLine) {
      inTableBlock = true;
      collapsed.push(line);
    } else if (inTableBlock && isBlank) {
      // skip blank lines inside a table block
      continue;
    } else {
      inTableBlock = false;
      collapsed.push(line);
    }
  }

  // Second pass: add spacing before headings / bold lines outside tables
  for (let i = 0; i < collapsed.length; i++) {
    const line = collapsed[i];
    const inTable = line.trimStart().startsWith("|");
    const prevLine = i > 0 ? collapsed[i - 1] : "";

    if (!inTable) {
      if (/^#{1,6}\s/.test(line) && prevLine.trim() !== "") result.push("");
      if (/^\*{1,3}[^*\n]/.test(line) && prevLine.trim() !== "") result.push("");
    }
    result.push(line);
  }

  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Shared markdown renderer — spreadsheet-quality tables, clean prose.
 */
export function MarkdownRenderer({ children, className = "" }: MarkdownRendererProps) {
  const cleaned = useMemo(() => sanitize(children), [children]);

  return (
    <div className={`markdown-renderer ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* ——— Headings ——— */
          h1: ({ children }) => (
            <h1 className="text-xl font-bold font-heading text-foreground mt-6 mb-3 pb-2 border-b border-border">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold font-heading text-foreground mt-5 mb-2 pb-1.5 border-b border-border/50">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold font-heading text-foreground mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h4>
          ),

          /* ——— Paragraph ——— */
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-foreground/90 mb-3">{children}</p>
          ),

          /* ——— Lists ——— */
          ul: ({ children }) => (
            <ul className="text-sm list-disc pl-5 space-y-1.5 mb-3 text-foreground/90">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm list-decimal pl-5 space-y-1.5 mb-3 text-foreground/90">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),

          /* ——— Table (spreadsheet-style) ——— */
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-xl border border-border/80 my-5 shadow-md bg-card">
              <table className="w-full text-sm border-collapse tabular-nums">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-primary/10 dark:bg-primary/15 sticky top-0">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-primary border-b-2 border-primary/30 border-r border-border/20 last:border-r-0 whitespace-nowrap select-none">
              {children}
            </th>
          ),
          tbody: ({ children }) => {
            let rowIdx = 0;
            return (
              <tbody className="divide-y divide-border/20">
                {React.Children.map(children, (child) => {
                  if (React.isValidElement(child)) {
                    const isEven = rowIdx % 2 === 0;
                    rowIdx++;
                    return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
                      className: `${isEven ? "bg-transparent" : "bg-muted/25 dark:bg-muted/15"} hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors`,
                    });
                  }
                  return child;
                })}
              </tbody>
            );
          },
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-sm text-foreground/90 border-r border-border/20 last:border-r-0 align-top leading-relaxed">
              {children}
            </td>
          ),
          tr: ({ children, className: trClassName }) => (
            <tr className={trClassName || ""}>{children}</tr>
          ),

          /* ——— Blockquote ——— */
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 bg-primary/5 rounded-r-lg pl-4 pr-3 py-3 my-4 text-sm italic text-foreground/80 [&>p]:mb-0">
              {children}
            </blockquote>
          ),

          /* ——— Code blocks (ASCII diagrams, etc.) ——— */
          pre: ({ children }) => (
            <pre className="bg-muted/70 border border-border/50 rounded-lg p-4 my-4 overflow-x-auto text-xs leading-relaxed font-mono whitespace-pre">
              {children}
            </pre>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return <code className="text-xs font-mono">{children}</code>;
            }
            return (
              <code className="bg-muted/80 border border-border/40 text-primary px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },

          /* ——— Horizontal rule ——— */
          hr: () => <hr className="border-border my-5" />,

          /* ——— Links ——— */
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              {children}
            </a>
          ),

          /* ——— Strong / Em ——— */
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
