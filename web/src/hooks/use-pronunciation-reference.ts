"use client";

import { getBackendUrl } from "@/lib/backend-config";
import { normalizeWord } from "@/lib/normalize-word";
import type { PronunciationReferenceResponse } from "@/types/pronunciation";
import { useEffect, useState } from "react";

const cache = new Map<string, PronunciationReferenceResponse>();

async function fetchPronunciationReference(
  key: string
): Promise<PronunciationReferenceResponse | null> {
  const k = normalizeWord(key);
  if (!k) {
    return null;
  }
  if (cache.has(k)) {
    return cache.get(k)!;
  }
  const url = `${getBackendUrl()}/api/phonemes/reference/${encodeURIComponent(k)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as PronunciationReferenceResponse;
  cache.set(k, data);
  return data;
}

export function usePronunciationReference(activeKey: string) {
  const [data, setData] = useState<PronunciationReferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const k = normalizeWord(activeKey);
    if (!k) {
      setData(null);
      setError(null);
      return;
    }
    if (cache.has(k)) {
      setData(cache.get(k)!);
      setError(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    setError(null);
    fetchPronunciationReference(k)
      .then((d) => {
        if (cancel) {
          return;
        }
        setData(d);
        if (!d) {
          setError("No reference data");
        }
      })
      .catch((e) => {
        if (!cancel) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancel) {
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [activeKey]);

  return { data, loading, error };
}
