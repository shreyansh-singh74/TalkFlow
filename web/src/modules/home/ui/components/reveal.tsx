"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useReveal } from "../hooks/use-reveal";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger step. Maps to the .reveal-delay-* utilities in globals.css. */
  delay?: 1 | 2 | 3;
}

/**
 * Fades and lifts its children in once they scroll into view. Keeps the
 * IntersectionObserver in one client component so sections can stay on the server.
 */
export function Reveal({ children, className, delay }: RevealProps) {
  const ref = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn("reveal", delay ? `reveal-delay-${delay}` : undefined, className)}
    >
      {children}
    </div>
  );
}
