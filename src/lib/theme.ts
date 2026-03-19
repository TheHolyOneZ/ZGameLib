import type { CustomTheme } from "./types";

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const s1 = s / 100, l1 = l / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

export function generateShades(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex);
  const levels = [
    { key: "200", l: 82 }, { key: "300", l: 72 }, { key: "400", l: 60 }, { key: "500", l: 50 },
    { key: "600", l: 42 }, { key: "700", l: 35 }, { key: "800", l: 28 }, { key: "900", l: 20 },
  ];
  const shades: Record<string, string> = {};
  for (const { key, l } of levels) {
    const [r, g, b] = hslToRgb(h, s, l);
    shades[`--accent-${key}`] = `${r} ${g} ${b}`;
  }
  return shades;
}

export function darkenHex(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  const [r, g, b] = hslToRgb(h, s, Math.max(0, l - amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function applyCustomThemeVars(theme: CustomTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", `custom-${theme.id}`);
  const shades = generateShades(theme.accent);
  for (const [key, val] of Object.entries(shades)) {
    root.style.setProperty(key, val);
  }
  root.style.setProperty("--bg-base", hexToRgbStr(theme.bg));
  root.style.setProperty("--sidebar-bg", hexToRgbStr(theme.sidebar));
}

export function clearCustomThemeVars() {
  const root = document.documentElement;
  const keys = ["--accent-200", "--accent-300", "--accent-400", "--accent-500", "--accent-600", "--accent-700", "--accent-800", "--accent-900", "--bg-base", "--sidebar-bg"];
  for (const key of keys) root.style.removeProperty(key);
}

export function applyTheme(theme: string) {
  clearCustomThemeVars();
  document.documentElement.setAttribute("data-theme", theme);
}

export function applyThemeFromSettings(theme: string, customThemesJson: string) {
  if (theme.startsWith("custom-")) {
    try {
      const themes: CustomTheme[] = JSON.parse(customThemesJson || "[]");
      const found = themes.find((t) => `custom-${t.id}` === theme);
      if (found) { applyCustomThemeVars(found); return; }
    } catch {}
    applyTheme("dark");
  } else {
    applyTheme(theme);
  }
}
