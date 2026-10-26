import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders Markdown. Raw HTML is never rendered and unsafe link protocols are dropped by
 * react-markdown. With `ugc`, remote images are not loaded (they could track readers) and
 * links get rel="ugc nofollow".
 */
export function Markdown({ children, ugc = false }: { children: string; ugc?: boolean }) {
  return (
    <div className="prose-legal">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={ugc ? ['img'] : undefined}
        unwrapDisallowed
        components={{
          a: ({ href, children: text }) => {
            const external = href?.startsWith('http');
            return (
              <a
                href={href}
                className="font-medium text-brand-blue underline"
                {...(external
                  ? { target: '_blank', rel: `noopener noreferrer${ugc ? ' ugc nofollow' : ''}` }
                  : {})}
              >
                {text}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
