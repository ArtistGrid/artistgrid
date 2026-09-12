import { useEffect, useState } from "react";
import { resolveImageUrl, syncImageUrl } from "@/src/lib/image-resolve";

export function useResolvedImage(input: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(() => (input ? syncImageUrl(input) : null));

  useEffect(() => {
    let active = true;
    if (!input) {
      setResolved(null);
      return;
    }
    const sync = syncImageUrl(input);
    setResolved(sync);
    resolveImageUrl(input)
      .then((result) => {
        if (active && result) setResolved(result);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [input]);

  return resolved;
}
