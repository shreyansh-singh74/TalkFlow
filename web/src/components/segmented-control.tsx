"use client";

import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  stackOnMobile?: boolean;
}

/**
 * A radio group styled as a segmented control.
 *
 * Uses real radio inputs rather than buttons so arrow-key navigation and
 * form/label semantics come for free.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
  stackOnMobile = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "bg-muted grid gap-1 rounded-lg p-1",
        stackOnMobile && options.length === 2
          ? "grid-cols-1 min-[420px]:grid-cols-2"
          : options.length === 2
            ? "grid-cols-2"
            : options.length === 3
              ? "grid-cols-3"
              : "grid-flow-col auto-cols-fr",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-visible:ring-ring rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="block font-medium">{option.label}</span>
            {option.description && (
              <span className="text-muted-foreground mt-0.5 block text-[11px] leading-tight">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
