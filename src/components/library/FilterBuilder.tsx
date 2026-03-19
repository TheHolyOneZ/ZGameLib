import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/useGameStore";
import type { FilterField, FilterOperator, FilterRule, Game } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELD_META: Record<FilterField, { label: string; hint: string }> = {
  platform: { label: "Platform", hint: "Which store the game is from" },
  status: { label: "Play Status", hint: "Your current progress label" },
  rating: { label: "Rating", hint: "Your score from 1 to 10" },
  playtime: { label: "Playtime", hint: "Total time played in minutes" },
  tags: { label: "Tag", hint: "A tag you added to the game" },
  date_added: { label: "Date Added", hint: "When you added it to the library" },
  is_favorite: { label: "Favorited", hint: "Whether the game is in your favorites" },
  has_cover: { label: "Has Cover Art", hint: "Whether a cover image is set" },
  not_installed: { label: "Installation", hint: "Whether the game is installed on this PC" },
};

const OPERATORS_FOR_FIELD: Record<FilterField, FilterOperator[]> = {
  platform:      ["=", "!="],
  status:        ["=", "!="],
  rating:        [">=", "<=", "=", "!="],
  playtime:      [">=", "<="],
  tags:          ["contains", "not_contains"],
  date_added:    [">=", "<="],
  is_favorite:   ["=", "!="],
  has_cover:     ["=", "!="],
  not_installed: ["=", "!="],
};

const OPERATOR_LABELS: Record<FilterField, Partial<Record<FilterOperator, string>>> = {
  platform:      { "=": "is", "!=": "is not" },
  status:        { "=": "is", "!=": "is not" },
  rating:        { "=": "is exactly", "!=": "is not", ">=": "at least", "<=": "at most" },
  playtime:      { ">=": "at least", "<=": "at most" },
  tags:          { "contains": "includes tag", "not_contains": "excludes tag" },
  date_added:    { ">=": "on or after", "<=": "on or before" },
  is_favorite:   { "=": "is", "!=": "is not" },
  has_cover:     { "=": "is", "!=": "is not" },
  not_installed: { "=": "is", "!=": "is not" },
};

function ruleSentence(rule: FilterRule): string {
  const field = FIELD_META[rule.field].label;
  const op = OPERATOR_LABELS[rule.field][rule.operator] ?? rule.operator;
  if (!rule.value) return `${field} — pick a value`;
  let val = rule.value;
  if (rule.field === "platform") val = val.charAt(0).toUpperCase() + val.slice(1);
  if (rule.field === "status") {
    const map: Record<string, string> = { none: "None", backlog: "Backlog", playing: "Playing", completed: "Completed", dropped: "Dropped", on_hold: "On Hold" };
    val = map[val] ?? val;
  }
  if (rule.field === "is_favorite") val = val === "true" ? "Yes" : "No";
  if (rule.field === "has_cover") val = val === "true" ? "Yes" : "No";
  if (rule.field === "not_installed") val = val === "true" ? "Not Installed" : "Installed";
  if (rule.field === "playtime") val = `${val} mins`;
  if (rule.field === "rating") val = `${val}/10`;
  return `${field} ${op} ${val}`;
}

function matchesRule(game: Game, rule: FilterRule): boolean {
  switch (rule.field) {
    case "platform":
      if (rule.operator === "=") return game.platform === rule.value;
      if (rule.operator === "!=") return game.platform !== rule.value;
      return true;
    case "status":
      if (rule.operator === "=") return game.status === rule.value;
      if (rule.operator === "!=") return game.status !== rule.value;
      return true;
    case "rating": {
      const rating = game.rating ?? -1;
      const val = parseFloat(rule.value);
      if (isNaN(val)) return true;
      if (rule.operator === "=") return rating === val;
      if (rule.operator === "!=") return rating !== val;
      if (rule.operator === ">=") return rating >= val;
      if (rule.operator === "<=") return rating <= val;
      return true;
    }
    case "playtime": {
      const val = parseFloat(rule.value);
      if (isNaN(val)) return true;
      if (rule.operator === ">=") return game.playtime_mins >= val;
      if (rule.operator === "<=") return game.playtime_mins <= val;
      return true;
    }
    case "tags":
      if (rule.operator === "contains") return game.tags.includes(rule.value);
      if (rule.operator === "not_contains") return !game.tags.includes(rule.value);
      return true;
    case "date_added":
      if (rule.operator === ">=") return game.date_added >= rule.value;
      if (rule.operator === "<=") return game.date_added <= rule.value;
      return true;
    case "is_favorite":
      if (rule.operator === "=") return game.is_favorite === (rule.value === "true");
      if (rule.operator === "!=") return game.is_favorite !== (rule.value === "true");
      return true;
    case "has_cover": {
      const hasCover = game.cover_path !== null;
      if (rule.operator === "=") return hasCover === (rule.value === "true");
      if (rule.operator === "!=") return hasCover !== (rule.value === "true");
      return true;
    }
    case "not_installed":
      if (rule.operator === "=") return game.not_installed === (rule.value === "true");
      if (rule.operator === "!=") return game.not_installed !== (rule.value === "true");
      return true;
    default: return true;
  }
}

const selectCls = "w-full rounded-lg text-[11px] text-slate-200 px-2 py-1.5 outline-none cursor-pointer bg-bg-elevated border border-white/[0.08] focus:border-accent-500/40 transition-colors";
const inputCls  = "w-full rounded-lg text-[11px] text-slate-200 px-2 py-1.5 outline-none bg-bg-elevated border border-white/[0.08] placeholder-slate-600 focus:border-accent-500/40 transition-colors";

function ValueInput({ field, value, onChange }: { field: FilterField; value: string; onChange: (v: string) => void }) {
  if (field === "platform") return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="" className="bg-[#0d0c14]">Pick a platform…</option>
      <option value="steam" className="bg-[#0d0c14]">Steam</option>
      <option value="epic" className="bg-[#0d0c14]">Epic Games</option>
      <option value="gog" className="bg-[#0d0c14]">GOG</option>
      <option value="custom" className="bg-[#0d0c14]">Custom</option>
    </select>
  );
  if (field === "status") return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="" className="bg-[#0d0c14]">Pick a status…</option>
      <option value="none" className="bg-[#0d0c14]">None</option>
      <option value="backlog" className="bg-[#0d0c14]">Backlog</option>
      <option value="playing" className="bg-[#0d0c14]">Playing</option>
      <option value="completed" className="bg-[#0d0c14]">Completed</option>
      <option value="dropped" className="bg-[#0d0c14]">Dropped</option>
      <option value="on_hold" className="bg-[#0d0c14]">On Hold</option>
    </select>
  );
  if (field === "is_favorite") return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="" className="bg-[#0d0c14]">Pick…</option>
      <option value="true" className="bg-[#0d0c14]">Yes — is favorited</option>
      <option value="false" className="bg-[#0d0c14]">No — not favorited</option>
    </select>
  );
  if (field === "has_cover") return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="" className="bg-[#0d0c14]">Pick…</option>
      <option value="true" className="bg-[#0d0c14]">Yes — has cover art</option>
      <option value="false" className="bg-[#0d0c14]">No — missing cover</option>
    </select>
  );
  if (field === "not_installed") return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="" className="bg-[#0d0c14]">Pick…</option>
      <option value="false" className="bg-[#0d0c14]">Installed</option>
      <option value="true" className="bg-[#0d0c14]">Not Installed</option>
    </select>
  );
  if (field === "rating") return (
    <div className="relative">
      <input type="number" min={1} max={10} value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. 7" className={inputCls} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 pointer-events-none">/10</span>
    </div>
  );
  if (field === "playtime") return (
    <div className="relative">
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. 60" className={inputCls} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 pointer-events-none">min</span>
    </div>
  );
  if (field === "date_added") return (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
  );
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter a tag name…" className={inputCls} />
  );
}

export default function FilterBuilder() {
  const filterRules  = useGameStore((s) => s.filterRules);
  const filterLogic  = useGameStore((s) => s.filterLogic);
  const addFilterRule    = useGameStore((s) => s.addFilterRule);
  const removeFilterRule = useGameStore((s) => s.removeFilterRule);
  const updateFilterRule = useGameStore((s) => s.updateFilterRule);
  const setFilterLogic   = useGameStore((s) => s.setFilterLogic);
  const clearFilterRules = useGameStore((s) => s.clearFilterRules);
  const games = useGameStore((s) => s.games);

  const matchCount = useMemo(() => {
    if (filterRules.length === 0) return null;
    const activeRules = filterRules.filter((r) => r.value !== "");
    if (activeRules.length === 0) return null;
    return games.filter((g) =>
      filterLogic === "and"
        ? activeRules.every((r) => matchesRule(g, r))
        : activeRules.some((r) => matchesRule(g, r))
    ).length;
  }, [games, filterRules, filterLogic]);

  const handleFieldChange = (id: string, newField: FilterField) => {
    updateFilterRule(id, "field", newField);
    updateFilterRule(id, "operator", OPERATORS_FOR_FIELD[newField][0]);
    updateFilterRule(id, "value", "");
  };

  return (
    <div className="flex flex-col gap-2 px-1 pb-1">

      {filterRules.length === 0 ? (
        <div className="px-2 py-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}>
          <p className="text-[11px] text-slate-400 font-medium mb-1">Custom Filter Rules</p>
          <p className="text-[10px] text-slate-600 leading-relaxed">Build conditions like <span className="text-slate-500">"Rating at least 8"</span> or <span className="text-slate-500">"Platform is Steam"</span>. Multiple rules can be combined.</p>
        </div>
      ) : (
        <div className="px-2 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] text-slate-500 mb-1.5">Show games matching…</p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterLogic("and")}
              className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all border", filterLogic === "and" ? "text-white border-accent-500/50 bg-accent-600/25" : "text-slate-500 border-white/6 bg-white/3 hover:text-slate-300")}
            >
              ALL rules
            </button>
            <button
              onClick={() => setFilterLogic("or")}
              className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all border", filterLogic === "or" ? "text-white border-accent-500/50 bg-accent-600/25" : "text-slate-500 border-white/6 bg-white/3 hover:text-slate-300")}
            >
              ANY rule
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">
            {filterLogic === "and"
              ? "Every condition below must be true for a game to appear."
              : "A game appears if it matches at least one condition below."}
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {filterRules.map((rule, idx) => (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
                <div className="flex items-center gap-1.5">
                  {filterRules.length > 1 && (
                    <span className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">
                      {filterLogic === "and" ? (idx === 0 ? "WHERE" : "AND") : (idx === 0 ? "WHERE" : "OR")}
                    </span>
                  )}
                  <div className="relative flex items-center">
                    <select
                      value={rule.field}
                      onChange={(e) => handleFieldChange(rule.id, e.target.value as FilterField)}
                      className="appearance-none text-[12px] font-semibold text-slate-100 pl-2.5 pr-6 py-1 rounded-lg outline-none cursor-pointer border border-white/15 bg-white/[0.06] hover:bg-white/[0.1] hover:border-accent-500/40 transition-all"
                      title="Click to change what you're filtering by"
                    >
                      {(Object.keys(FIELD_META) as FilterField[]).map((f) => (
                        <option key={f} value={f} className="bg-[#0d0c14] font-normal">{FIELD_META[f].label}</option>
                      ))}
                    </select>
                    <svg className="absolute right-1.5 pointer-events-none text-slate-400" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9L12 15L18 9"/>
                    </svg>
                  </div>
                </div>
                <button
                  onClick={() => removeFilterRule(rule.id)}
                  className="w-5 h-5 flex items-center justify-center rounded-md text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                  title="Remove this rule"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <p className="text-[10px] text-slate-600 px-2.5 pb-1">{FIELD_META[rule.field].hint}</p>

              <div className="flex items-center gap-1.5 px-2.5 pb-2">
                <select
                  value={rule.operator}
                  onChange={(e) => updateFilterRule(rule.id, "operator", e.target.value as FilterOperator)}
                  className="shrink-0 rounded-lg text-[11px] text-accent-300 px-2 py-1.5 outline-none cursor-pointer bg-accent-900/20 border border-accent-500/20 font-medium"
                >
                  {OPERATORS_FOR_FIELD[rule.field].map((op) => (
                    <option key={op} value={op} className="bg-[#0d0c14] text-slate-200 font-normal">
                      {OPERATOR_LABELS[rule.field][op] ?? op}
                    </option>
                  ))}
                </select>
                <div className="flex-1 min-w-0">
                  <ValueInput
                    field={rule.field}
                    value={rule.value}
                    onChange={(v) => updateFilterRule(rule.id, "value", v)}
                  />
                </div>
              </div>

              {rule.value && (
                <div className="px-2.5 pb-2">
                  <p className="text-[10px] text-accent-400/70 italic leading-snug">
                    → {ruleSentence(rule)}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center gap-1.5">
        <button
          onClick={addFilterRule}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] text-slate-400 hover:text-slate-200 hover:bg-white/4 transition-all"
          style={{ border: "1px dashed rgba(255,255,255,0.09)" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Rule
        </button>
        {filterRules.length > 0 && (
          <button
            onClick={clearFilterRules}
            className="px-2.5 py-2 rounded-xl text-[11px] text-red-500/60 hover:text-red-400 hover:bg-red-500/8 transition-all border border-transparent hover:border-red-500/15"
          >
            Clear
          </button>
        )}
      </div>

      {matchCount !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-[11px] font-semibold text-accent-300">{matchCount}</span>
          <span className="text-[11px] text-slate-500">{matchCount === 1 ? "game matches" : "games match"}</span>
        </motion.div>
      )}
    </div>
  );
}
