import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

type TourMode = "fast" | "standard" | "detailed";

interface TourModeSelectorProps {
  onStart: (mode: TourMode) => void;
  onSkip: () => void;
}

function RocketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C12 2 6 6 6 12H10L8 22L12 18L16 22L14 12H18C18 6 12 2 12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 5L9 3L15 5L21 3V19L15 21L9 19L3 21V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M9 3V19M15 5V21" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function GraduationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L22 8L12 13L2 8L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 11V17C6 17 9 19 12 19C15 19 18 17 18 17V11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M22 8V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const MODES: { id: TourMode; label: string; duration: string; tagline: string; description: string; icon: React.ReactNode; steps: number }[] = [
  {
    id: "fast",
    label: "Quick Start",
    duration: "~2 min",
    tagline: "Just the essentials",
    description: "I know my way around apps — show me the basics and let me explore.",
    icon: <RocketIcon />,
    steps: 10,
  },
  {
    id: "standard",
    label: "Standard Tour",
    duration: "~5 min",
    tagline: "The full overview",
    description: "Walk me through all the main features so I know what's available.",
    icon: <MapIcon />,
    steps: 23,
  },
  {
    id: "detailed",
    label: "Deep Dive",
    duration: "~10 min",
    tagline: "Show me everything",
    description: "Every feature, every setting, every shortcut — I want to master this.",
    icon: <GraduationIcon />,
    steps: 37,
  },
];

export default function TourModeSelector({ onStart, onSkip }: TourModeSelectorProps) {
  const [selected, setSelected] = useState<TourMode | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)", zIndex: 9999 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 40 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="w-full max-w-[640px] mx-4"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 20, delay: 0.1 }}
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgb(var(--accent-600)), rgb(var(--accent-400)))",
              boxShadow: "0 0 60px rgb(var(--accent-500) / 0.45), 0 16px 40px rgba(0,0,0,0.4)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="7" width="18" height="13" rx="3" stroke="white" strokeWidth="1.5"/>
              <path d="M9 14H10M9 11H10M14 14H15M14 11H15M12 7V4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-2xl font-bold text-white mb-2"
          >
            Welcome to ZGameLib
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 text-sm"
          >
            Choose a tour that fits your style. You can retake it anytime from Settings.
          </motion.p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {MODES.map((mode, i) => (
            <motion.button
              key={mode.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              onClick={() => setSelected(mode.id)}
              className={cn(
                "p-5 rounded-2xl text-left transition-all duration-200 relative group",
                selected === mode.id
                  ? "border-2 border-accent-500"
                  : "border border-white/8 hover:border-white/15"
              )}
              style={{
                background: selected === mode.id
                  ? "linear-gradient(135deg, rgb(var(--accent-500) / 0.12), rgb(var(--accent-800) / 0.08))"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              {selected === mode.id && (
                <motion.div
                  layoutId="mode-selected"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    boxShadow: "0 0 40px rgb(var(--accent-500) / 0.15)",
                    background: "rgb(var(--accent-500) / 0.05)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className="relative z-10">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl mb-3 flex items-center justify-center transition-colors",
                    selected === mode.id ? "text-accent-300" : "text-slate-500 group-hover:text-slate-400"
                  )}
                  style={selected === mode.id
                    ? { background: "rgb(var(--accent-500) / 0.18)" }
                    : { background: "rgba(255,255,255,0.04)" }}
                >
                  {mode.icon}
                </div>
                <div className="text-[14px] font-bold text-white mb-0.5">{mode.label}</div>
                <div className="text-[11px] text-slate-500 mb-2.5">{mode.tagline} · {mode.duration}</div>
                <div className="text-[11px] text-slate-600 leading-relaxed">{mode.description}</div>
                <div
                  className="mt-3 text-[10px] font-semibold tabular-nums"
                  style={{ color: "rgb(var(--accent-400))" }}
                >
                  {mode.steps} steps
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="flex items-center justify-between"
        >
          <button
            onClick={onSkip}
            className="text-[12px] text-slate-600 hover:text-slate-400 transition-colors"
          >
            Skip — I'll explore on my own
          </button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => selected && onStart(selected)}
            disabled={!selected}
            className="btn-primary text-[13px] py-2.5 px-6 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start Tour
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
