import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";

interface ProviderCardProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: ReactNode;
  children?: ReactNode;
}

export default function ProviderCard({
  selected,
  onClick,
  title,
  description,
  icon,
  children,
}: ProviderCardProps) {
  return (
    <div className={`provider-card${selected ? " provider-card--selected" : ""}`}>
      <div
        className="provider-card__header"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
      >
        <span className="provider-card__icon">{icon}</span>
        <div>
          <div className="provider-card__title">{title}</div>
          <div className="provider-card__desc">{description}</div>
        </div>
        {selected && (
          <CircleCheck size={20} className="provider-card__check" />
        )}
      </div>
      {selected && <div className="provider-card__body">{children}</div>}
    </div>
  );
}
