import { cleanTitle, sceneClean } from "./gameName";

export { sceneClean };

export interface QueryRule {
  id: string;
  pattern: string;
  replace: string;
  flags: string;
  enabled: boolean;
}

const RULES_KEY = "zgamelib-cover-query-rules";
const SCENE_KEY = "zgamelib-cover-scene-cleanup";

export function loadRules(): QueryRule[] {
  try { return JSON.parse(localStorage.getItem(RULES_KEY) ?? "[]") as QueryRule[]; } catch { return []; }
}

export function saveRules(rules: QueryRule[]) {
  try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch {}
}

export function loadSceneCleanup(): boolean {
  try { return localStorage.getItem(SCENE_KEY) !== "0"; } catch { return true; }
}

export function saveSceneCleanup(v: boolean) {
  try { localStorage.setItem(SCENE_KEY, v ? "1" : "0"); } catch {}
}

export function compileRule(rule: QueryRule): RegExp | string {
  try {
    const flags = [...new Set((rule.flags || "gi").replace(/[^gimsuy]/g, "").split(""))].join("");
    return new RegExp(rule.pattern, flags.includes("g") ? flags : flags + "g");
  } catch (e) {
    return (e as Error).message;
  }
}

export function buildQuery(name: string, rules: QueryRule[], scene: boolean): string {
  let s = name;
  for (const r of rules) {
    if (!r.enabled || !r.pattern) continue;
    const re = compileRule(r);
    if (typeof re === "string") continue;
    s = s.replace(re, r.replace);
  }
  s = scene ? cleanTitle(s) : s.replace(/\s+/g, " ");
  return s.replace(/\s{2,}/g, " ").trim() || name.trim();
}

export const RULE_PRESETS: { label: string; rule: Omit<QueryRule, "id" | "enabled"> }[] = [
  { label: "Dots & underscores → spaces", rule: { pattern: "[._]+", replace: " ", flags: "g" } },
  { label: "Drop text in brackets", rule: { pattern: "\\s*[\\[(][^\\])]*[\\])]", replace: "", flags: "g" } },
  { label: "Drop everything after \" - \"", rule: { pattern: "\\s-\\s.*$", replace: "", flags: "" } },
  { label: "Drop trailing version", rule: { pattern: "\\s*v?\\d+(\\.\\d+)+\\w*$", replace: "", flags: "i" } },
  { label: "Split CamelCase", rule: { pattern: "([a-z])([A-Z])", replace: "$1 $2", flags: "g" } },
];
