import { useEffect, useRef, useState } from "react";

export function useProgressive(total: number, step = 40, resetKey: unknown = null) {
  const [limit, setLimit] = useState(step);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => { setLimit(step); }, [resetKey, step]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= total) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((l) => Math.min(total, l + step));
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, total, step]);

  return { limit: Math.min(limit, total), sentinel, hasMore: limit < total };
}
