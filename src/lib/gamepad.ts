export type PadAction =
  | "up" | "down" | "left" | "right"
  | "a" | "b" | "x" | "y"
  | "lb" | "rb" | "lt" | "rt"
  | "start" | "select";

export type ControllerKind = "xbox" | "playstation" | "nintendo" | "generic";
export type InputSource = "gamepad" | "keyboard" | "mouse";

export const BUTTON_MAP: Record<number, PadAction> = {
  0: "a",
  1: "b",
  2: "x",
  3: "y",
  4: "lb",
  5: "rb",
  6: "lt",
  7: "rt",
  8: "select",
  9: "start",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

export const REPEATABLE: ReadonlySet<PadAction> = new Set(["up", "down", "left", "right", "lt", "rt"]);

export function detectControllerKind(id: string): ControllerKind {
  const s = id.toLowerCase();
  if (/054c|dualshock|dualsense|playstation|wireless controller|ps4|ps5/.test(s)) return "playstation";
  if (/057e|pro controller|joy-con|nintendo/.test(s)) return "nintendo";
  if (/045e|xbox|xinput|x-box|microsoft/.test(s)) return "xbox";
  return "generic";
}

export function getConnectedPads(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p && p.connected);
}

export function rumble(strength = 0.35, duration = 60) {
  for (const pad of getConnectedPads()) {
    const act = (pad as Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } }).vibrationActuator;
    act?.playEffect?.("dual-rumble", { startDelay: 0, duration, weakMagnitude: strength, strongMagnitude: strength * 0.6 }).catch(() => {});
  }
}

export const KEY_MAP: Record<string, PadAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "a",
  " ": "a",
  Escape: "b",
  Backspace: "b",
  f: "x",
  F: "x",
  s: "y",
  S: "y",
  q: "lb",
  Q: "lb",
  e: "rb",
  E: "rb",
  PageUp: "lt",
  PageDown: "rt",
  m: "start",
  M: "start",
  Tab: "select",
};

type Listener = (action: PadAction, source: InputSource, kind: ControllerKind) => void;

export function startGamepadLoop(onAction: Listener, onConnectionChange?: (kind: ControllerKind | null, name: string | null) => void) {
  const held = new Map<string, { since: number; last: number }>();
  let raf = 0;
  let lastKind: ControllerKind | null = null;
  let lastName: string | null = null;
  const INITIAL = 380;
  const REPEAT = 115;

  const tick = (now: number) => {
    const pads = getConnectedPads();
    const pad = pads[0];
    const kind = pad ? detectControllerKind(pad.id) : null;
    const name = pad ? pad.id : null;
    if (kind !== lastKind || name !== lastName) {
      lastKind = kind;
      lastName = name;
      onConnectionChange?.(kind, name);
    }
    const active = new Set<string>();
    for (const p of pads) {
      const pk = detectControllerKind(p.id);
      const pressed: PadAction[] = [];
      p.buttons.forEach((b, i) => {
        const action = BUTTON_MAP[i];
        if (!action) return;
        const isDown = b.pressed || b.value > 0.55;
        if (isDown) pressed.push(action);
      });
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      const T = 0.55;
      if (ax < -T && Math.abs(ax) >= Math.abs(ay)) pressed.push("left");
      if (ax > T && Math.abs(ax) >= Math.abs(ay)) pressed.push("right");
      if (ay < -T && Math.abs(ay) > Math.abs(ax)) pressed.push("up");
      if (ay > T && Math.abs(ay) > Math.abs(ax)) pressed.push("down");

      for (const action of pressed) {
        const key = `${p.index}:${action}`;
        if (active.has(key)) continue;
        active.add(key);
        const state = held.get(key);
        if (!state) {
          held.set(key, { since: now, last: now });
          onAction(action, "gamepad", pk);
        } else if (REPEATABLE.has(action) && now - state.since > INITIAL && now - state.last > REPEAT) {
          state.last = now;
          onAction(action, "gamepad", pk);
        }
      }
    }
    for (const key of Array.from(held.keys())) {
      if (!active.has(key)) held.delete(key);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

export function prettyControllerName(id: string | null): string | null {
  if (!id) return null;
  const s = id.toLowerCase();
  const product = /product:\s*([0-9a-f]{4})/i.exec(id)?.[1]?.toLowerCase() ?? /054c-([0-9a-f]{4})/i.exec(id)?.[1]?.toLowerCase();
  if (detectControllerKind(id) === "playstation") {
    if (product === "0ce6" || product === "0df2" || s.includes("dualsense")) return product === "0df2" ? "DualSense Edge" : "DualSense";
    if (product === "05c4" || product === "09cc" || s.includes("dualshock")) return "DualShock 4";
    return "PlayStation Controller";
  }
  if (detectControllerKind(id) === "xbox") {
    if (s.includes("elite")) return "Xbox Elite Controller";
    if (s.includes("series") || product === "0b12" || product === "0b13") return "Xbox Series Controller";
    if (product === "02ea" || product === "02dd" || product === "02e0" || product === "0b20") return "Xbox One Controller";
    return "Xbox Controller";
  }
  if (detectControllerKind(id) === "nintendo") return "Nintendo Pro Controller";
  const clean = id.replace(/\(.*?\)/g, "").trim();
  return clean || "Game Controller";
}
