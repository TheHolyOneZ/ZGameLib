import type { ControllerKind, InputSource, PadAction } from "@/lib/gamepad";

const XBOX_FACE: Record<string, { label: string; color: string }> = {
  a: { label: "A", color: "#5dc21e" },
  b: { label: "B", color: "#e3302f" },
  x: { label: "X", color: "#2f7ef7" },
  y: { label: "Y", color: "#f2c40f" },
};

const NINTENDO_FACE: Record<string, { label: string; color: string }> = {
  a: { label: "B", color: "#e5e7eb" },
  b: { label: "A", color: "#e5e7eb" },
  x: { label: "Y", color: "#e5e7eb" },
  y: { label: "X", color: "#e5e7eb" },
};

const PS_COLORS: Record<string, string> = {
  a: "#8fb8ff",
  b: "#ff6b81",
  x: "#f19ad8",
  y: "#3ee0b7",
};

const KEYBOARD_LABEL: Record<PadAction, string> = {
  a: "Enter",
  b: "Esc",
  x: "F",
  y: "S",
  lb: "Q",
  rb: "E",
  lt: "PgUp",
  rt: "PgDn",
  start: "M",
  select: "Tab",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

function PsShape({ action, size }: { action: string; size: number }) {
  const c = PS_COLORS[action];
  const s = size * 0.46;
  const o = (size - s) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {action === "a" && (
        <path d={`M${o} ${o}L${o + s} ${o + s}M${o + s} ${o}L${o} ${o + s}`} stroke={c} strokeWidth={size * 0.09} strokeLinecap="round" />
      )}
      {action === "b" && <circle cx={size / 2} cy={size / 2} r={s / 2} fill="none" stroke={c} strokeWidth={size * 0.085} />}
      {action === "x" && <rect x={o} y={o} width={s} height={s} rx={size * 0.03} fill="none" stroke={c} strokeWidth={size * 0.085} />}
      {action === "y" && (
        <path d={`M${size / 2} ${o - size * 0.02}L${o + s + size * 0.03} ${o + s * 0.92}H${o - size * 0.03}Z`} fill="none" stroke={c} strokeWidth={size * 0.08} strokeLinejoin="round" />
      )}
    </svg>
  );
}

export default function ButtonGlyph({
  action,
  kind,
  source,
  size = 30,
}: {
  action: PadAction;
  kind: ControllerKind | null;
  source: InputSource;
  size?: number;
}) {
  const useKeyboard = source !== "gamepad" || !kind;

  if (useKeyboard) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-lg font-sans font-bold text-white/90"
        style={{
          minWidth: size,
          height: size,
          padding: "0 8px",
          fontSize: size * 0.4,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderBottomWidth: 3,
        }}
      >
        {KEYBOARD_LABEL[action]}
      </span>
    );
  }

  if (action === "a" || action === "b" || action === "x" || action === "y") {
    if (kind === "playstation") {
      return (
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: size, height: size, background: "rgba(20,22,30,0.9)", border: "1.5px solid rgba(255,255,255,0.25)" }}
        >
          <PsShape action={action} size={size} />
        </span>
      );
    }
    const face = kind === "nintendo" ? NINTENDO_FACE[action] : XBOX_FACE[action];
    return (
      <span
        className="inline-flex items-center justify-center rounded-full font-sans font-black"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.48,
          color: face.color,
          background: "radial-gradient(circle at 35% 30%, rgba(60,62,72,1), rgba(16,17,22,1))",
          border: `1.5px solid ${face.color}66`,
          boxShadow: `0 0 12px ${face.color}33`,
        }}
      >
        {face.label}
      </span>
    );
  }

  let label = "";
  if (action === "lb") label = kind === "playstation" ? "L1" : kind === "nintendo" ? "L" : "LB";
  else if (action === "rb") label = kind === "playstation" ? "R1" : kind === "nintendo" ? "R" : "RB";
  else if (action === "lt") label = kind === "playstation" ? "L2" : kind === "nintendo" ? "ZL" : "LT";
  else if (action === "rt") label = kind === "playstation" ? "R2" : kind === "nintendo" ? "ZR" : "RT";
  else if (action === "start") label = kind === "playstation" ? "OPTIONS" : kind === "nintendo" ? "+" : "☰";
  else if (action === "select") label = kind === "playstation" ? "SHARE" : kind === "nintendo" ? "−" : "⧉";
  else label = KEYBOARD_LABEL[action];

  const isWide = label.length > 2;
  return (
    <span
      className="inline-flex items-center justify-center font-sans font-bold text-white/90"
      style={{
        minWidth: isWide ? undefined : size * 1.35,
        height: size * 0.82,
        padding: isWide ? "0 9px" : undefined,
        fontSize: isWide ? size * 0.3 : size * 0.38,
        borderRadius: action === "start" || action === "select" ? 999 : size * 0.28,
        background: "linear-gradient(180deg, rgba(70,72,84,1), rgba(24,25,32,1))",
        border: "1px solid rgba(255,255,255,0.2)",
        letterSpacing: isWide ? "0.06em" : undefined,
      }}
    >
      {label}
    </span>
  );
}
