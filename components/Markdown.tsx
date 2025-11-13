import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Minimal markdown renderer with Tailwind Typography
// Usage: <Markdown content={text} />

type Props = {
  content: string;
  className?: string;
};

const Markdown: React.FC<Props> = ({ content, className }) => {
  return (
    <div className={"prose prose-slate dark:prose-invert max-w-none text-sm leading-6 " + (className || '')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline"/>,
          code: ({node, inline, className, children, ...props}) => (
            inline ? (
              <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200" {...props}>{children}</code>
            ) : (
              <pre className="p-3 rounded bg-slate-900 text-slate-100 overflow-x-auto text-[12px]" {...props}><code>{children}</code></pre>
            )
          ),
          table: ({node, ...props}) => <table className="table-auto border-collapse" {...props}/>,
          th: ({node, ...props}) => <th className="border px-2 py-1" {...props}/>,
          td: ({node, ...props}) => <td className="border px-2 py-1" {...props}/>,
          h1: ({node, ...props}) => <h1 className="mt-0" {...props}/>,
          h2: ({node, ...props}) => <h2 className="mt-2" {...props}/>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
