import type { OllamaStatus } from '../types';

interface ModelSelectorProps {
  status: OllamaStatus;
  selected: string;
  onSelect: (model: string) => void;
}

export default function ModelSelector({
  status,
  selected,
  onSelect,
}: ModelSelectorProps) {
  if (!status.connected) {
    return (
      <span className="model-selector-disconnected">
        Ollama 断连
        {status.error && <span className="model-error">{status.error}</span>}
      </span>
    );
  }

  if (status.models.length === 0) {
    return <span className="model-selector-empty">无可用模型</span>;
  }

  return (
    <div className="model-selector">
      <label className="model-label" htmlFor="model-select">
        模型
      </label>
      <select
        id="model-select"
        className="model-select"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
      >
        {status.models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
