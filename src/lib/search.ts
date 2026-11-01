import type { Game } from "./types";
import { acronym, cleanTitle, levenshtein, normalizeText } from "./gameName";

type Predicate = (g: Game) => boolean;

export interface ParsedQuery {
  terms: string[];
  regex: RegExp | null;
  filters: Predicate[];
  error: string | null;
  isEmpty: boolean;
}

const PLATFORM_ALIASES: Record<string, string> = {
  steam: "steam", epic: "epic", egs: "epic", "epic games": "epic", gog: "gog", ubisoft: "ubisoft", uplay: "ubisoft", ubi: "ubisoft", custom: "custom", other: "custom",
};

const STATUS_ALIASES: Record<string, string> = {
  playing: "playing", backlog: "backlog", completed: "completed", done: "completed", finished: "completed", beaten: "completed",
  dropped: "dropped", abandoned: "dropped", hold: "on_hold", onhold: "on_hold", on_hold: "on_hold", paused: "on_hold", none: "none", unset: "none",
};

function parseDuration(v: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|d|days?)?$/i.exec(v.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "h").toLowerCase();
  if (unit.startsWith("m")) return n;
  if (unit.startsWith("d")) return n * 1440;
  return n * 60;
}

function parseAge(v: string): number | null {
  const m = /^(\d+)\s*(d|days?|w|weeks?|m|months?|y|years?)$/i.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const u = m[2][0].toLowerCase();
  const day = 86400000;
  return n * (u === "d" ? day : u === "w" ? 7 * day : u === "m" ? 30 * day : 365 * day);
}

function compare(op: string, a: number, b: number) {
  switch (op) {
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    case "!=": return a !== b;
    default: return a === b;
  }
}

function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /(-?[a-z_]+(?:>=|<=|!=|[:=<>])"[^"]*")|("[^"]*")|(\S+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push((m[1] ?? m[2] ?? m[3]).replace(/"/g, ""));
  return out;
}

function fieldPredicate(key: string, op: string, value: string): Predicate | string {
  const v = value.toLowerCase();
  switch (key) {
    case "p": case "platform": case "store": {
      const p = PLATFORM_ALIASES[v];
      if (!p) return `Unknown platform "${value}"`;
      return (g) => g.platform === p;
    }
    case "s": case "status": {
      const st = STATUS_ALIASES[v.replace(/\s/g, "")] ?? v;
      return (g) => g.status === st;
    }
    case "t": case "tag": return (g) => g.tags.some((t) => t.toLowerCase().includes(v));
    case "g": case "genre": return (g) => (g.genre ?? "").toLowerCase().includes(v);
    case "dev": case "developer": return (g) => (g.developer ?? "").toLowerCase().includes(v);
    case "pub": case "publisher": return (g) => (g.publisher ?? "").toLowerCase().includes(v);
    case "year": case "released": {
      const n = parseInt(v, 10);
      if (isNaN(n)) return `"${value}" is not a year`;
      return (g) => g.release_year !== null && compare(op, g.release_year, n);
    }
    case "r": case "rating": {
      const n = parseFloat(v);
      if (isNaN(n)) return `"${value}" is not a rating`;
      return (g) => g.rating !== null && compare(op, g.rating, n);
    }
    case "pt": case "playtime": case "time": {
      const mins = parseDuration(v);
      if (mins === null) return `"${value}" is not a duration (try 10h or 30m)`;
      return (g) => compare(op === ":" ? ">=" : op, g.playtime_mins, mins);
    }
    case "played": case "lastplayed": {
      const age = parseAge(v);
      if (age === null) return `"${value}" is not an age (try 7d, 2w, 3m, 1y)`;
      const cutoff = Date.now() - age;
      const within = op === "<" || op === "<=" || op === ":";
      return (g) => {
        if (!g.last_played) return !within;
        const t = new Date(g.last_played).getTime();
        return within ? t >= cutoff : t < cutoff;
      };
    }
    case "added": {
      const age = parseAge(v);
      if (age !== null) {
        const cutoff = Date.now() - age;
        const within = op === "<" || op === "<=" || op === ":";
        return (g) => (within ? new Date(g.date_added).getTime() >= cutoff : new Date(g.date_added).getTime() < cutoff);
      }
      const d = Date.parse(v);
      if (isNaN(d)) return `"${value}" is not a date or age`;
      return (g) => compare(op === ":" ? ">=" : op, new Date(g.date_added).getTime(), d);
    }
    case "is": case "has": {
      switch (v) {
        case "fav": case "favorite": case "favourite": case "loved": return (g) => g.is_favorite;
        case "pinned": case "pin": return (g) => g.is_pinned;
        case "installed": return (g) => !g.not_installed;
        case "uninstalled": case "notinstalled": return (g) => g.not_installed;
        case "played": return (g) => g.playtime_mins > 0;
        case "unplayed": case "new": case "fresh": return (g) => g.playtime_mins === 0;
        case "rated": case "rating": return (g) => g.rating !== null;
        case "unrated": return (g) => g.rating === null;
        case "cover": return (g) => !!g.cover_path;
        case "nocover": return (g) => !g.cover_path;
        case "tags": case "tagged": return (g) => g.tags.length > 0;
        case "description": case "desc": return (g) => !!g.description;
        case "hltb": return (g) => g.hltb_main_mins !== null;
        case "igdb": case "metadata": return (g) => !!(g.genre || g.developer || g.publisher || g.release_year);
        case "exe": return (g) => !!g.exe_path;
        default: return `Unknown "${key}:${value}"`;
      }
    }
    default:
      return `Unknown filter "${key}"`;
  }
}

export function parseQuery(q: string): ParsedQuery {
  const trimmed = q.trim();
  const res: ParsedQuery = { terms: [], regex: null, filters: [], error: null, isEmpty: trimmed === "" };
  if (!trimmed) return res;

  const whole = /^\/(.+)\/([gimsuy]*)$/.exec(trimmed);
  if (whole) {
    try { res.regex = new RegExp(whole[1], whole[2].includes("i") ? whole[2] : whole[2] + "i"); }
    catch (e) { res.error = `Invalid pattern: ${(e as Error).message}`; }
    return res;
  }

  for (const tok of tokenize(trimmed)) {
    const neg = tok.startsWith("-") && tok.length > 1;
    const body = neg ? tok.slice(1) : tok;
    const m = /^([a-z_]+)(>=|<=|!=|[:=<>])(.+)$/i.exec(body);
    if (m && !/^\d/.test(m[1])) {
      const p = fieldPredicate(m[1].toLowerCase(), m[2], m[3]);
      if (typeof p === "string") { res.error = p; continue; }
      res.filters.push(neg ? (g) => !p(g) : p);
      continue;
    }
    if (neg) {
      const nt = normalizeText(body);
      if (nt) res.filters.push((g) => !normalizeText(g.name).includes(nt));
      continue;
    }
    const nt = normalizeText(body);
    if (nt) res.terms.push(...nt.split(" "));
  }
  return res;
}

interface Indexed {
  name: string;
  clean: string;
  words: string[];
  acr: string;
  extra: string;
}

const indexCache = new Map<string, { sig: string; ix: Indexed }>();

function indexOf(g: Game): Indexed {
  const sig = g.name + "\u0001" + (g.description ?? "") + "\u0001" + (g.genre ?? "") + (g.developer ?? "") + (g.publisher ?? "") + "\u0001" + g.tags.join(",");
  const hit = indexCache.get(g.id);
  if (hit && hit.sig === sig) return hit.ix;
  const clean = normalizeText(cleanTitle(g.name));
  const name = normalizeText(g.name);
  const ix: Indexed = {
    name,
    clean,
    words: [...new Set([...clean.split(" "), ...name.split(" ")])].filter(Boolean),
    acr: acronym(g.name),
    extra: normalizeText([g.description, g.genre, g.developer, g.publisher, ...g.tags].filter(Boolean).join(" ")),
  };
  if (indexCache.size > 20000) indexCache.clear();
  indexCache.set(g.id, { sig, ix });
  return ix;
}

function termScore(ix: Indexed, term: string, deep: boolean): number {
  if (ix.clean === term || ix.name === term) return 100;
  if (ix.clean.startsWith(term)) return 85;
  if (ix.words.some((w) => w === term)) return 70;
  if (ix.words.some((w) => w.startsWith(term))) return 60;
  if (term.length >= 2) {
    const romanTail = term.replace(/(viii|vii|iii|vi|iv|ix|ii|v|x)$/, (r) => ({ ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" } as Record<string, string>)[r]);
    if (ix.acr === term || (romanTail !== term && ix.acr === romanTail)) return 75;
    if (ix.acr.startsWith(term)) return 50;
  }
  if (ix.clean.replace(/ /g, "").includes(term)) return 40;
  if (term.length >= 4) {
    const maxDist = term.length >= 8 ? 2 : 1;
    let best = Infinity;
    for (const w of ix.words) {
      if (Math.abs(w.length - term.length) > maxDist + 1) continue;
      const d = levenshtein(w.slice(0, term.length + 1), term, maxDist);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best <= maxDist) return 30 - best * 8;
  }
  if (deep && ix.extra.includes(term)) return 15;
  return 0;
}

export function scoreGame(g: Game, parsed: ParsedQuery, deep = false): number {
  for (const f of parsed.filters) if (!f(g)) return 0;
  if (parsed.regex) {
    parsed.regex.lastIndex = 0;
    const hit = parsed.regex.test(g.name) || parsed.regex.test(cleanTitle(g.name)) || (deep && !!g.description && parsed.regex.test(g.description));
    return hit ? 50 : 0;
  }
  if (parsed.terms.length === 0) return 1;
  const ix = indexOf(g);
  let total = 0;
  for (const t of parsed.terms) {
    const s = termScore(ix, t, deep);
    if (s === 0) return 0;
    total += s;
  }
  const joined = parsed.terms.join(" ");
  if (parsed.terms.length > 1 && ix.clean.startsWith(joined)) total += 40;
  return total / parsed.terms.length + (ix.clean.length < 40 ? (40 - ix.clean.length) / 20 : 0);
}

export function searchGames(games: Game[], query: string, deep = false): { game: Game; score: number }[] {
  const parsed = parseQuery(query);
  if (parsed.isEmpty) return games.map((game) => ({ game, score: 1 }));
  const out: { game: Game; score: number }[] = [];
  for (const g of games) {
    const s = scoreGame(g, parsed, deep);
    if (s > 0) out.push({ game: g, score: s });
  }
  return out.sort((a, b) => b.score - a.score);
}

export const SEARCH_HELP: { syntax: string; meaning: string }[] = [
  { syntax: "witcher", meaning: "Typo-tolerant name search" },
  { syntax: "rdr2  ·  gta5", meaning: "Acronyms and roman numerals" },
  { syntax: "/^dark.*(ii|2)$/", meaning: "Regular expression on the title" },
  { syntax: "platform:steam", meaning: "steam, epic, gog, ubisoft, custom" },
  { syntax: "status:playing", meaning: "Any of your statuses" },
  { syntax: "tag:coop  genre:rpg", meaning: "Tags and IGDB genres" },
  { syntax: "rating>=8", meaning: "Also > < <= =" },
  { syntax: "playtime>10h", meaning: "Durations in h, m or d" },
  { syntax: "played<7d  added<1m", meaning: "Recency in d, w, m, y" },
  { syntax: "year>=2020  dev:fromsoft", meaning: "Release year, developer, publisher" },
  { syntax: "is:fav  is:unplayed", meaning: "fav, pinned, installed, uninstalled, played, unplayed, rated, nocover" },
  { syntax: "-tag:multiplayer", meaning: "Prefix any part with - to exclude it" },
];
