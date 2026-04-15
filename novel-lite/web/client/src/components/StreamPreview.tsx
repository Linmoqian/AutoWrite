import type { FC } from 'react';

interface StreamPreviewProps {
  active: boolean;
  text: string;
}

const StreamPreview: FC<StreamPreviewProps> = ({ active, text }) => {
  if (!active && !text) return null;

  return (
    <div className="stream-preview">
      <div className="stream-header">
        <span className="stream-indicator" />
        <span>实时创作预览</span>
      </div>
      <div className="stream-content">
        {text}
        {active && <span className="stream-cursor" />}
      </div>
    </div>
  );
};

export default StreamPreview;
