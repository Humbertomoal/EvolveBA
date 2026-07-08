"use client";

import * as TablerIcons from "@tabler/icons-react";
import { IconInbox } from "@tabler/icons-react";

type TablerIconComponent = React.ComponentType<{ className?: string; stroke?: number }>;

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const IconComponent =
    (TablerIcons as unknown as Record<string, TablerIconComponent>)[icon] ?? IconInbox;

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-zinc-300 py-12 text-center">
      <IconComponent className="h-12 w-12 text-zinc-300" stroke={1.5} />
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      <p className="max-w-xs text-sm text-zinc-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-primary-dark"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
