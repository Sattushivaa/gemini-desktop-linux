import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./CodeBlock";

interface MarkdownProps {
  content: string;
}

/**
 * Preprocesses markdown text to ensure all standard LaTeX notations used by LLMs
 * (such as \[...\], \(...\), and standalone environments like \begin{align}...\end{align})
 * are converted into remark-math compatible delimiters ($$ and $) while preserving
 * code blocks and existing math spans.
 */
function preprocessLaTeX(content: string): string {
  if (!content) return "";

  // 1. Protect code blocks (fenced and inline) so we do not modify code
  const placeholders: string[] = [];
  let text = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    const id = `___PROTECTED_${placeholders.length}___`;
    placeholders.push(match);
    return id;
  });

  // 2. Replace \[ ... \] with $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => {
    return `\n$$\n${formula.trim()}\n$$\n`;
  });

  // 3. Replace \( ... \) with $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => {
    return `$${formula.trim()}$`;
  });

  // 4. Protect existing $$ ... $$ and $ ... $ blocks before checking standalone environments
  text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g, (match) => {
    const id = `___PROTECTED_${placeholders.length}___`;
    placeholders.push(match);
    return id;
  });

  // 5. Wrap standalone LaTeX environments (\begin{align}...\end{align}, etc.) in $$
  const envs = [
    "align",
    "align\\*",
    "aligned",
    "alignedat",
    "equation",
    "equation\\*",
    "gather",
    "gather\\*",
    "gathered",
    "matrix",
    "pmatrix",
    "bmatrix",
    "Bmatrix",
    "vmatrix",
    "Vmatrix",
    "cases",
    "split",
    "CD",
    "array",
  ];
  const envRegex = new RegExp(
    `(\\\\begin\\{(${envs.join("|")})\\}[\\s\\S]*?\\\\end\\{\\2\\})`,
    "g",
  );

  text = text.replace(envRegex, (match) => {
    return `\n$$\n${match.trim()}\n$$\n`;
  });

  // 6. Restore all placeholders
  text = text.replace(/___PROTECTED_(\d+)___/g, (_, index) => placeholders[Number(index)] ?? "");

  return text;
}

/**
 * Renders model output with full Markdown, GFM (tables, task lists),
 * syntax-highlighted fenced code blocks and KaTeX math.
 */
export const Markdown = memo(function Markdown({ content }: MarkdownProps) {
  const processedContent = useMemo(() => preprocessLaTeX(content), [content]);

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              strict: false,
              throwOnError: false,
              trust: true,
              output: "htmlAndMathml",
            },
          ],
          rehypeHighlight,
        ]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-([\w+-]+)/.exec(className ?? "");
            const inline = !className;
            const code = String(children ?? "").replace(/\n$/, "");
            if (inline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match?.[1] ?? "text"} code={code} />;
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});