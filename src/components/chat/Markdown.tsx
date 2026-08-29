import { memo } from "react";
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
 * Renders model output with full Markdown, GFM (tables, task lists),
 * syntax-highlighted fenced code blocks and KaTeX math.
 */
export const Markdown = memo(function Markdown({ content }: MarkdownProps) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }], rehypeHighlight]}
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
        {content}
      </ReactMarkdown>
    </div>
  );
});