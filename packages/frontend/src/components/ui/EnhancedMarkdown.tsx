import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';

interface EnhancedMarkdownProps {
  children: string;
  className?: string;
}

export const EnhancedMarkdown: React.FC<EnhancedMarkdownProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
        // Tables with GRC-friendly styling
        table: ({ children }) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-gray-200 text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-50">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="bg-white">
            {children}
          </tbody>
        ),
        tr: ({ children }) => (
          <tr className="border-b border-gray-200 hover:bg-gray-50">
            {children}
          </tr>
        ),
        th: ({ children }) => (
          <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-900 bg-gray-100">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-200 px-4 py-2 text-gray-700">
            {children}
          </td>
        ),
        
        // Enhanced headings
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-6">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold text-gray-900 mb-3 mt-5">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-4">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-base font-semibold text-gray-800 mb-2 mt-3">
            {children}
          </h4>
        ),
        
        // Enhanced lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-2 space-y-1 text-gray-700">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-2 space-y-1 text-gray-700">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">
            {children}
          </li>
        ),
        
        // Code blocks with syntax highlighting-ready styling
        pre: ({ children }) => (
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">
              {children}
            </code>
          ) : (
            <code className="font-mono">
              {children}
            </code>
          );
        },
        
        // Enhanced blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 italic text-gray-700">
            {children}
          </blockquote>
        ),
        
        // Links with better styling
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline hover:no-underline"
          >
            {children}
          </a>
        ),
        
        // Paragraphs with better spacing
        p: ({ children }) => (
          <p className="my-2 leading-relaxed text-gray-700">
            {children}
          </p>
        ),
        
        // Emphasis
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-gray-700">
            {children}
          </em>
        ),
        
        // Horizontal rules
        hr: () => (
          <hr className="border-t border-gray-200 my-6" />
        ),
        
        // Task lists (checkboxes)
        input: ({ checked, type }) => (
          type === 'checkbox' ? (
            <input 
              type="checkbox" 
              checked={checked} 
              readOnly
              className="mr-2 rounded border-gray-300"
            />
          ) : null
        ),
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};