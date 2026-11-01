const TRADEMARKS = /[\u2122\u00AE\u00A9\u2120]|\(tm\)|\(r\)|\(c\)/gi;

const BRACKET_NOISE = /\s*[\[(](?:x64|x86|64[- ]?bit|32[- ]?bit|win(?:dows)?(?:\s*\d+)?|steam|gog(?:\.com)?|epic(?:\s*games)?|ubisoft(?:\s*connect)?|uplay|origin|ea app|drm[- ]?free|portable|repack|multi\d*|eng?|en|us|eu|retail|digital|pc|dx\d+|directx\s*\d+|vulkan|opengl|launcher|beta|alpha|early access|preview|playtest|demo|trial|v?\d+(?:[._]\d+)+[a-z]?|build\s*\d+|update\s*\d+|rev\s*\d+|r\d+|\d{6,})[\])]/gi;

const VERSION_TAIL = /(?:\s*[-–—_:,]?\s*)(?:v(?:er(?:sion)?)?\.?\s*\d+(?:[._]\d+)*[a-z]?(?:[-_.]?(?:hotfix|patch|fix|beta|alpha|rc)\d*)?|\b\d+\.\d+(?:\.\d+)+[a-z]?|build\s*#?\d+|update\s*\d+(?:\.\d+)*|patch\s*\d+(?:\.\d+)*|rev(?:ision)?\s*\d+|b\d{3,}|\b\d{7,})\s*$/i;

const PLATFORM_TAIL = /\s*[-–—:]\s*(?:windows|win64|win32|pc|steam|epic games|gog|ubisoft connect)\s*(?:edition|version)?\s*$/i;

const EDITION_WORDS = [
  "game of the year", "goty", "definitive", "deluxe", "complete", "ultimate", "gold", "premium", "standard",
  "enhanced", "special", "anniversary", "collector'?s", "legendary", "digital deluxe", "super deluxe", "platinum",
  "royal", "director'?s cut", "final cut", "extended", "legacy", "champions", "steam", "pc", "windows",
  "launch", "day one", "season pass", "bundle", "classic", "expanded", "next gen", "next-gen", "ultra",
];

const EDITION_TAIL = new RegExp(
  `\\s*(?:[-–—:|]\\s*|\\(|\\[)?\\s*(?:the\\s+)?(?:${EDITION_WORDS.join("|")})(?:\\s+(?:${EDITION_WORDS.join("|")}))*\\s+(?:edition|version|cut|collection|pack)\\s*[)\\]]?\\s*$`,
  "i"
);

const BARE_TAIL_TAGS = /\s*[-–—:]?\s*(?:\bthe\s+)?\b(?:goty|final cut|director'?s cut)\s*$/i;

const SUFFIX_KIND: { re: RegExp; kind: VariantKind }[] = [
  { re: /\b(?:demo|trial|prologue demo)\b/i, kind: "demo" },
  { re: /\b(?:playtest|closed beta|open beta|public beta|test server|pts|public test)\b/i, kind: "test" },
  { re: /\b(?:soundtrack|ost|artbook|art book|wallpapers?)\b/i, kind: "extra" },
  { re: /\b(?:dedicated server|server|sdk|editor|mod tools?|benchmark|tool ?kit)\b/i, kind: "tool" },
];

export type VariantKind = "game" | "demo" | "test" | "extra" | "tool";

const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16",
};

function stripDiacritics(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function splitIdentifier(s: string) {
  if (/\s/.test(s) || !/^[A-Za-z0-9_.]+$/.test(s)) return s;
  let out = s.replace(/[_.]+/g, " ").trim();
  if (!/\s/.test(out) && out.length >= 12 && (out.match(/[a-z][A-Z]/g) ?? []).length >= 1) out = out.replace(/([a-z])([A-Z][a-z])/g, "$1 $2");
  return out;
}

function titleCaseIfLower(s: string) {
  if (s !== s.toLowerCase() || !/[a-z]{3}/.test(s)) return s;
  return s
    .split(" ")
    .map((w) => (ROMAN[w] && w.length > 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function cleanTitle(raw: string): string {
  if (!raw) return raw;
  let s = raw.replace(TRADEMARKS, "").trim();
  s = splitIdentifier(s);
  s = s.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(BRACKET_NOISE, "").trim();
    s = s.replace(VERSION_TAIL, "").trim();
    s = s.replace(PLATFORM_TAIL, "").trim();
    s = s.replace(EDITION_TAIL, "").trim();
    s = s.replace(BARE_TAIL_TAGS, "").trim();
    s = s.replace(/[\s\-–—:|,._]+$/, "").trim();
    if (s === before) break;
  }
  s = s.replace(/\s*[(\[]\s*[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();
  s = titleCaseIfLower(s);
  return s.length >= 2 ? s : raw.trim();
}

export function variantKind(raw: string): VariantKind {
  const s = raw.replace(TRADEMARKS, "");
  for (const { re, kind } of SUFFIX_KIND) if (re.test(s)) return kind;
  return "game";
}

export function normalizeText(s: string): string {
  return stripDiacritics(s.replace(TRADEMARKS, ""))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => ROMAN[w] ?? w)
    .join(" ");
}

export function canonicalKey(raw: string): string {
  let s = cleanTitle(raw);
  for (const { re } of SUFFIX_KIND) s = s.replace(new RegExp(`\\s*[-–—:(\\[]?\\s*${re.source}\\s*[)\\]]?`, "gi"), " ");
  const words = normalizeText(s).split(" ").filter(Boolean);
  while (words.length > 1 && (words[0] === "the" || words[0] === "a")) words.shift();
  return words.join(" ");
}

const sortKeyCache = new Map<string, string>();

export function sortKey(name: string): string {
  let k = sortKeyCache.get(name);
  if (k === undefined) {
    k = normalizeText(cleanTitle(name)).replace(/^(?:the|a|an) /, "");
    if (sortKeyCache.size > 20000) sortKeyCache.clear();
    sortKeyCache.set(name, k);
  }
  return k;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareNames(a: string, b: string): number {
  return collator.compare(sortKey(a), sortKey(b));
}

export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev2 = new Array<number>(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

export function acronym(name: string): string {
  return normalizeText(cleanTitle(name))
    .split(" ")
    .filter((w) => w && !["of", "the", "and", "a", "an", "to", "in", "on"].includes(w))
    .map((w) => (/^\d+$/.test(w) ? w : w[0]))
    .join("");
}

let smartTitles = (() => {
  try { return localStorage.getItem("zgamelib-smart-titles") !== "0"; } catch { return true; }
})();

const cache = new Map<string, string>();

export function isSmartTitles() {
  return smartTitles;
}

export function setSmartTitles(v: boolean) {
  smartTitles = v;
  try { localStorage.setItem("zgamelib-smart-titles", v ? "1" : "0"); } catch {}
  window.dispatchEvent(new Event("zgamelib:titles-changed"));
}

export function displayName(name: string): string {
  if (!smartTitles) return name;
  let v = cache.get(name);
  if (v === undefined) {
    v = cleanTitle(name);
    if (cache.size > 5000) cache.clear();
    cache.set(name, v);
  }
  return v;
}
