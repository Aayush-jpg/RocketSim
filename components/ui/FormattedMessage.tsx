import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

// Import specific languages for syntax highlighting
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python';
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash';

// Register languages
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);

interface FormattedMessageProps {
  content: string;
  role: 'user' | 'assistant';
  className?: string;
}

// Minimal preprocessing - LaTeX unescaping now handled at JSON parsing level
const preprocessContent = (content: string): string => {
  let processed = content.trim();
  
  // ONLY remove JSON garbage that shouldn't be displayed
  processed = processed.replace(/\{"action":\s*"[^"]+[^}]*\}/g, '');
  processed = processed.replace(/```json\s*\{"action":\s*"[^"]+[^}]*\}\s*```/g, '');
  processed = processed.replace(/Simulation Results\s*\{"action":\s*"run_simulation"[^}]*\}/g, '✅ Simulation completed successfully!');
  
  // Basic cleanup only
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
  return processed.trim();
};

// Custom dark theme without line highlighting or borders
const customDarkTheme = {
  'code[class*="language-"]': {
    color: '#f8f8f2',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    tabSize: 4,
    hyphens: 'none',
    border: 'none',
    outline: 'none',
  },
  'pre[class*="language-"]': {
    color: '#f8f8f2',
    background: '#1a1a1a',
    textShadow: 'none',
    fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    direction: 'ltr',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    tabSize: 4,
    hyphens: 'none',
    padding: '12px',
    margin: '0',
    overflow: 'auto',
    borderRadius: '6px',
    border: 'none',
    outline: 'none',
  },
  // Comprehensive line styling to prevent any borders or highlighting
  '.token-line': {
    background: 'transparent !important',
    border: 'none !important',
    outline: 'none !important',
    boxShadow: 'none !important',
  },
  'span.token-line': {
    background: 'transparent !important',
    border: 'none !important',
    outline: 'none !important',
    boxShadow: 'none !important',
  },
  '.linenumber': {
    background: 'transparent !important',
    border: 'none !important',
  },
  '.highlight-line': {
    background: 'transparent !important',
    border: 'none !important',
  },
  // Syntax highlighting colors
  'comment': { color: '#6a9955' },
  'prolog': { color: '#6a9955' },
  'doctype': { color: '#6a9955' },
  'cdata': { color: '#6a9955' },
  'punctuation': { color: '#d4d4d4' },
  'property': { color: '#9cdcfe' },
  'tag': { color: '#569cd6' },
  'constant': { color: '#569cd6' },
  'symbol': { color: '#569cd6' },
  'deleted': { color: '#569cd6' },
  'boolean': { color: '#569cd6' },
  'number': { color: '#b5cea8' },
  'selector': { color: '#d7ba7d' },
  'attr-name': { color: '#9cdcfe' },
  'string': { color: '#ce9178' },
  'char': { color: '#ce9178' },
  'builtin': { color: '#dcdcaa' },
  'inserted': { color: '#ce9178' },
  'operator': { color: '#d4d4d4' },
  'entity': { color: '#569cd6' },
  'url': { color: '#569cd6' },
  'variable': { color: '#9cdcfe' },
  'atrule': { color: '#c586c0' },
  'attr-value': { color: '#ce9178' },
  'function': { color: '#dcdcaa' },
  'class-name': { color: '#4ec9b0' },
  'keyword': { color: '#569cd6' },
  'regex': { color: '#d16969' },
  'important': { color: '#569cd6', fontWeight: 'bold' }
};

// Custom components for markdown rendering with improved styling
const MarkdownComponents = {
  // Custom code block renderer with syntax highlighting
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    if (!inline && language) {
      return (
        <SyntaxHighlighter
          language={language}
          PreTag="div"
          className="text-xs"
          customStyle={{
            margin: '1rem 0', // Only top/bottom margin, same as text
            padding: '12px',
            fontSize: '12px',
            lineHeight: '1.4',
            background: '#1a1a1a',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            borderRadius: '6px',
            width: '100%', // Full width to match text
            minWidth: '100%', // Ensure background extends on scroll
            display: 'block',
            overflowX: 'auto',
            color: '#f8f8f2',
            fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
          }}
          codeTagProps={{
            style: {
              background: '#1a1a1a',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              display: 'block',
              minWidth: '100%',
              fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
            }
          }}
          wrapLines={false}
          wrapLongLines={false}
          showLineNumbers={false}
          lineProps={() => ({
            style: {
              background: 'transparent !important',
              border: 'none !important',
              outline: 'none !important',
              boxShadow: 'none !important',
              display: 'block'
            }
          })}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    
    // Inline code with smaller font
    return (
      <code 
        className="bg-gray-800 text-gray-200 px-1.5 py-0.5 rounded text-xs font-mono break-words" 
        {...props}
      >
        {children}
      </code>
    );
  },
  
  // Ensure headings get proper styling
  h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
  h4: ({ children, ...props }: any) => <h4 {...props}>{children}</h4>,
  h5: ({ children, ...props }: any) => <h5 {...props}>{children}</h5>,
  h6: ({ children, ...props }: any) => <h6 {...props}>{children}</h6>,
  
  // Ensure paragraphs get proper styling
  p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  
  // Ensure lists get proper styling
  ul: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
  ol: ({ children, ...props }: any) => <ol {...props}>{children}</ol>,
  li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  
  // Ensure strong/em get proper styling
  strong: ({ children, ...props }: any) => <strong {...props}>{children}</strong>,
  em: ({ children, ...props }: any) => <em {...props}>{children}</em>,
  
  // Tables
  table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
  thead: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
  tbody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  td: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  th: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  
  // Blockquotes
  blockquote: ({ children, ...props }: any) => <blockquote {...props}>{children}</blockquote>,
  
  // Horizontal rules
  hr: ({ ...props }: any) => <hr {...props} />
};

export default function FormattedMessage({ content, role, className }: FormattedMessageProps) {
  const processedContent = useMemo(() => {
    return preprocessContent(content);
  }, [content]);

  return (
    <div 
      className={cn(
        // Base container with proper containment
        "formatted-content max-w-none overflow-hidden break-words",
        // Text color based on role
        role === 'user' ? "text-white" : "text-gray-200",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [rehypeKatex, {
            strict: false,
            trust: true,
            output: 'html',
            throwOnError: false,
            errorColor: '#cc0000',
            macros: {
              "\\RR": "\\mathbb{R}",
              "\\NN": "\\mathbb{N}",
              "\\ZZ": "\\mathbb{Z}",
            }
          }],
          [rehypeSanitize, {
            ...defaultSchema,
            attributes: {
              ...defaultSchema.attributes,
              // Allow all standard HTML attributes
              '*': ['className', 'style', 'id'],
              // Allow math-specific attributes
              'span': ['className', 'style', 'aria-hidden'],
              'div': ['className', 'style'],
              // Allow SVG attributes for KaTeX
              'svg': ['*'],
              'path': ['*'],
              'use': ['*'],
              'g': ['*'],
              'rect': ['*'],
              'line': ['*']
            },
            tagNames: [
              ...defaultSchema.tagNames || [],
              // Ensure all standard markdown elements are allowed
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              'p', 'br', 'strong', 'em', 'code', 'pre',
              'ul', 'ol', 'li', 'blockquote', 'hr',
              'table', 'thead', 'tbody', 'tr', 'th', 'td',
              'a', 'img',
              // KaTeX elements
              'svg', 'path', 'use', 'g', 'rect', 'line', 'defs', 'clipPath'
            ]
          }]
        ]}
        components={MarkdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
} 