// dashboard/src/components/ChatMarkdown.jsx
//
// Renders chat replies as GENUINE markdown (headings, bold, lists, code
// block/inline, links) -- not raw text with ##/** marks showing as-is.
// Uses react-markdown (pure rendering, doesn't execute anything) +
// remark-gfm (GitHub-style lists/tables/strikethrough, which commonly show
// up in Claude Code's replies).
//
// Only overrides `code`/`pre`/`a` via components -- everything else
// (headings, lists, paragraphs, bold) is styled purely via CSS in App.css
// (scoped to `.chat-bubble__text`), since react-markdown already renders
// standard HTML tags.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown v10 no longer passes an `inline` prop to the `code`
// override -- distinguished manually instead: block code (from a ```
// fence) usually has a `language-xxx` className OR multi-line content;
// inline code (`code`) has neither. This heuristic is accurate enough for
// real-world cases, though not a perfect guarantee (a fenced code block
// WITHOUT a language AND WITHOUT a newline -- very rare -- could be
// misread as inline).
function CodeRenderer({ className, children, ...rest }) {
  const isBlock = /language-/.test(className || "") || String(children).includes("\n");
  if (isBlock) {
    return (
      <code className={`chat-md-code-block ${className || ""}`} {...rest}>
        {children}
      </code>
    );
  }
  return (
    <code className="chat-md-code-inline" {...rest}>
      {children}
    </code>
  );
}

function LinkRenderer({ children, ...rest }) {
  // target=_blank so clicking a link doesn't navigate away from the
  // dashboard itself -- rel is required alongside target=_blank (noopener/noreferrer).
  return (
    <a {...rest} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const COMPONENTS = {
  code: CodeRenderer,
  a: LinkRenderer,
};

export default function ChatMarkdown({ text }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
}
