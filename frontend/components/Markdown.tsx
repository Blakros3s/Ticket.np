'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  content: string;
  className?: string;
}

export default function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none
      prose-headings:text-white prose-headings:font-semibold
      prose-p:text-slate-300 prose-p:leading-relaxed
      prose-a:text-sky-400 prose-a:no-underline hover:prose-a:underline
      prose-strong:text-white prose-strong:font-semibold
      prose-code:text-sky-300 prose-code:bg-slate-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-lg
      prose-blockquote:border-l-sky-400 prose-blockquote:bg-slate-800/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:text-slate-300
      prose-ul:text-slate-300 prose-ol:text-slate-300
      prose-li:marker:text-sky-400
      prose-hr:border-slate-700
      prose-table:border-collapse
      prose-th:border prose-th:border-slate-700 prose-th:bg-slate-800 prose-th:px-3 prose-th:py-2 prose-th:text-left
      prose-td:border prose-td:border-slate-700 prose-td:px-3 prose-td:py-2
      ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
