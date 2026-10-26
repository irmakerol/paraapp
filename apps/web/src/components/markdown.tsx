import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders trusted Markdown (our own legal texts). Raw HTML is not allowed. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-legal">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
