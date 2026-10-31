export type Direction = "up" | "down" | "left" | "right";

const SELECTOR = "[data-bp-focusable]";

function isUsable(el: HTMLElement) {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export class SpatialNav {
  root: HTMLElement;
  current: HTMLElement | null = null;
  onFocus: ((el: HTMLElement) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  scope(): HTMLElement {
    const scopes = this.root.querySelectorAll<HTMLElement>("[data-bp-scope]");
    return scopes.length ? scopes[scopes.length - 1] : this.root;
  }

  items(scope = this.scope()): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>(SELECTOR)).filter(isUsable);
  }

  isValid(el: HTMLElement | null): el is HTMLElement {
    if (!el || !el.isConnected) return false;
    if (!this.scope().contains(el)) return false;
    return isUsable(el);
  }

  set(el: HTMLElement, opts: { scroll?: boolean; block?: ScrollLogicalPosition; smooth?: boolean } = {}) {
    if (this.current && this.current !== el) this.current.removeAttribute("data-bp-active");
    this.current = el;
    el.setAttribute("data-bp-active", "true");
    try { el.focus({ preventScroll: true }); } catch {}
    if (opts.scroll !== false) {
      el.scrollIntoView({ block: opts.block ?? "nearest", inline: "nearest", behavior: opts.smooth === false ? "auto" : "smooth" });
    }
    this.onFocus?.(el);
  }

  ensure(force = false) {
    if (!force && this.isValid(this.current)) {
      this.current!.setAttribute("data-bp-active", "true");
      return this.current;
    }
    const scope = this.scope();
    const auto = scope.querySelector<HTMLElement>("[data-bp-autofocus]");
    const target = auto && isUsable(auto) ? auto : this.items(scope)[0];
    if (target) this.set(target, { block: "center", smooth: false });
    return target ?? null;
  }

  restore(el: HTMLElement | null) {
    if (el && this.isValid(el)) {
      this.set(el, { block: "center", smooth: false });
      return true;
    }
    this.ensure(true);
    return false;
  }

  move(dir: Direction): boolean {
    const cur = this.ensure();
    if (!cur) return false;
    const c = cur.getBoundingClientRect();
    const ccx = c.left + c.width / 2;
    const ccy = c.top + c.height / 2;
    const row = cur.closest<HTMLElement>("[data-bp-row]");
    let best: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const el of this.items()) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let primary = 0;
      let secondary = 0;

      if (dir === "right" || dir === "left") {
        const forward = dir === "right" ? cx - ccx : ccx - cx;
        if (forward <= 2) continue;
        if (dir === "right" ? r.left < c.left + 2 : r.right > c.right - 2) continue;
        primary = dir === "right" ? Math.max(0, r.left - c.right) : Math.max(0, c.left - r.right);
        const overlap = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
        secondary = overlap > Math.min(r.height, c.height) * 0.3 ? 0 : Math.abs(cy - ccy);
        if (row && el.closest("[data-bp-row]") !== row) secondary += 400;
        primary += Math.abs(cy - ccy) * 0.05;
      } else {
        const forward = dir === "down" ? cy - ccy : ccy - cy;
        if (forward <= 2) continue;
        if (dir === "down" ? r.top < c.top + 2 : r.bottom > c.bottom - 2) continue;
        primary = dir === "down" ? Math.max(0, r.top - c.bottom) : Math.max(0, c.top - r.bottom);
        const overlap = Math.min(r.right, c.right) - Math.max(r.left, c.left);
        secondary = overlap > 0 ? Math.abs(cx - ccx) * 0.15 : Math.abs(cx - ccx);
      }

      const score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    if (best) {
      this.set(best, { block: dir === "up" || dir === "down" ? "center" : "nearest" });
      return true;
    }
    return false;
  }

  activate() {
    const cur = this.ensure();
    cur?.click();
    return !!cur;
  }
}
