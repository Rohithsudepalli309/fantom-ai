import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

// Minimal markdown renderer with Tailwind Typography
// Usage: <Markdown content={text} />

type Props = {
  content: string;
  className?: string;
};

const Markdown: React.FC<Props> = ({ content, className }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className={"prose prose-slate dark:prose-invert max-w-none text-sm leading-6 " + (className || '')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline" />,
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const code = String(children).replace(/\n$/, '');
            // Generate a simple hash or use random for key if index not available (though index is tricky here)
            // We'll use a simple counter approach if needed, but for now just pass 0 or random
            const index = Math.random();

            return !inline && match ? (
              <div className="relative group rounded-md overflow-hidden my-2">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => handleCopy(code, index)}
                    className="p-1.5 rounded bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Copy code"
                  >
                    {copiedIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.85em' }}
                  {...props}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[0.9em]" {...props}>
                {children}
              </code>
            );
          },
          table: ({ node, ...props }) => <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 dark:border-slate-700"><table className="w-full text-left text-sm" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="bg-slate-100 dark:bg-slate-800/50" {...props} />,
          th: ({ node, ...props }) => <th className="border-b border-slate-200 dark:border-slate-700 px-4 py-2 font-semibold" {...props} />,
          td: ({ node, ...props }) => <td className="border-b border-slate-100 dark:border-slate-800 px-4 py-2" {...props} />,
          h1: ({ node, ...props }) => <h1 className="mt-6 mb-4 text-2xl font-bold" {...props} />,
          h2: ({ node, ...props }) => <h2 className="mt-5 mb-3 text-xl font-bold" {...props} />,
          h3: ({ node, ...props }) => <h3 className="mt-4 mb-2 text-lg font-bold" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-violet-500 pl-4 italic my-4 text-slate-600 dark:text-slate-400" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
