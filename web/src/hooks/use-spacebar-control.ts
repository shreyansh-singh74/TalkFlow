"use client";

import { useEffect, useCallback } from "react";

export interface UseSpacebarControlOptions {
  onSpaceDown: () => void;
  onSpaceUp: () => void;
  enabled?: boolean;
}

export function useSpacebarControl({
  onSpaceDown,
  onSpaceUp,
  enabled = true
}: UseSpacebarControlOptions) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only trigger if spacebar and not already held down
    if (e.code === "Space" && !e.repeat && enabled) {
      // Prevent page scroll
      e.preventDefault();
      onSpaceDown();
    }
  }, [onSpaceDown, enabled]);
  
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space" && enabled) {
      e.preventDefault();
      onSpaceUp();
    }
  }, [onSpaceUp, enabled]);
  
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}

