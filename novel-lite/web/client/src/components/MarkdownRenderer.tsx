import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  fontSize: number;
}

function MarkdownRenderer({ content, fontSize }: MarkdownRendererProps) {
  return (
    <div className="reader-md" style={{ fontSize }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
