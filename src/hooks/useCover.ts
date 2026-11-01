import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/tauri";
import type { Game } from "@/lib/types";

const CACHE_MAX = 250;
const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  if (!cache.has(key)) return undefined;
  const val = cache.get(key)!;
  cache.delete(key);
  cache.set(key, val);
  return val;
}

function cacheSet(key: string, val: string) {
  if (cache.has(key)) cache.delete(key);
  else if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, val);
}

const pending = new Map<string, Promise<string>>();
const wanted = new Map<string, number>();

const MAX_CONCURRENT = 6;
let activeCount = 0;
const queue: Array<{
  key: string;
  fetcher: () => Promise<string>;
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
}> = [];

function processQueue() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.pop()!;
    if ((wanted.get(item.key) ?? 0) <= 0) {
      pending.delete(item.key);
      item.reject(new Error("cancelled"));
      continue;
    }
    activeCount++;
    item.fetcher()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => { activeCount--; processQueue(); });
  }
}

export function want(key: string) {
  wanted.set(key, (wanted.get(key) ?? 0) + 1);
  return () => {
    const n = (wanted.get(key) ?? 1) - 1;
    if (n <= 0) wanted.delete(key); else wanted.set(key, n);
  };
}

export function queueFetch(fetcher: () => Promise<string>, key: string): Promise<string> {
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = new Promise<string>((resolve, reject) => {
    queue.push({ key, fetcher, resolve, reject });
    queueMicrotask(processQueue);
  });
  pending.set(key, promise);
  promise.then(() => pending.delete(key), () => pending.delete(key));
  return promise;
}

export function useCover(game: Game): string | null {
  const path = game.cover_path;

  const [src, setSrc] = useState<string | null>(() => {
    if (!path) return null;
    if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) return path;
    return cacheGet(path) || null;
  });

  const genRef = useRef(0);

  useEffect(() => {
    if (!path) { setSrc(null); return; }
    if (path.startsWith("data:")) { setSrc(path); return; }
    const cached = cacheGet(path);
    if (cached) { setSrc(cached); return; }

    const gen = ++genRef.current;
    const isRemote = path.startsWith("http://") || path.startsWith("https://");
    const fetcher = isRemote ? () => api.fetchUrlAsBase64(path) : () => api.readImageBase64(path);
    const release = want(path);

    queueFetch(fetcher, path)
      .then((dataUri) => {
        cacheSet(path, dataUri);
        if (genRef.current === gen) setSrc(dataUri);
      })
      .catch(() => {});
    return release;
  }, [path]);

  return src;
}

export function setCoverCache(path: string, dataUri: string) {
  cacheSet(path, dataUri);
}

export function clearCoverCache(path: string) {
  cache.delete(path);
}
