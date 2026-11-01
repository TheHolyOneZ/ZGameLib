import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CoverResult } from "@/lib/types";
import { CheckIcon } from "@/components/ui/Icons";

const SOURCE_TONE: Record<string, string> = {
  Steam: "#66c0f4",
  SteamGridDB: "#3dd6a8",
  IGDB: "#c084fc",
};

export function SourceBadge({ source }: { source: string }) {
  const c = SOURCE_TONE[source] ?? "#94a3b8";
  return (
    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide backdrop-blur" style={{ background: `${c}26`, color: c, border: `1px solid ${c}40` }}>
      {source}
    </span>
  );
}

export default function CoverCandidateTile({ result, selected, busy, onClick, size = "md" }: {
  result: CoverResult;
  selected?: boolean;
  busy?: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={failed}
      title={`${result.name} · ${result.source}`}
      className={cn(
        "relative group rounded-xl overflow-hidden aspect-[3/4] transition-all ring-2 shrink-0 bg-white/[0.04]",
        selected ? "ring-accent-400" : "ring-transparent hover:ring-white/25",
        failed && "opacity-30 cursor-not-allowed",
        size === "sm" ? "w-[64px]" : "w-full"
      )}
    >
      {!failed && (
        <img
          src={result.thumb}
          alt={result.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("w-full h-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-white/[0.05]" />}
      {failed && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500 p-1 text-center">No art</div>}
      {size === "md" && (
        <>
          <div className="absolute top-1.5 left-1.5"><SourceBadge source={result.source} /></div>
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-[10.5px] text-white font-medium leading-tight line-clamp-2 text-left">{result.name}</p>
          </div>
        </>
      )}
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center shadow-lg">
          <CheckIcon size={10} className="text-white" />
        </span>
      )}
      {busy && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="w-5 h-5 rounded-full border-2 border-accent-400/30 border-t-accent-400 animate-spin" />
        </div>
      )}
    </button>
  );
}
