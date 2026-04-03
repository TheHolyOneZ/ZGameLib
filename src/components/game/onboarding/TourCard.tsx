import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { TourStep, TourCardPosition } from "./steps";
import { CHAPTERS } from "./steps";

interface CardPos {
  left: number;
  top: number;
}

const CARD_WIDTH = 390;
const CARD_HEIGHT = 210;
const PADDING = 10;
const MARGIN = 24;

function computePosition(target: string | undefined, position: TourCardPosition): CardPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const center = { left: (vw - CARD_WIDTH) / 2, top: (vh - CARD_HEIGHT) / 2 };

  if (!target || position === "center") return center;
  const el = document.querySelector(target);
  if (!el) return center;

  const r = el.getBoundingClientRect();
  const sx = r.left - PADDING;
  const sy = r.top - PADDING;
  const sw = r.width + PADDING * 2;
  const sh = r.height + PADDING * 2;

  let pos: CardPos;
  switch (position) {
    case "bottom": pos = { left: Math.min(Math.max(sx, MARGIN), vw - CARD_WIDTH - MARGIN), top: Math.min(sy + sh + MARGIN, vh - CARD_HEIGHT - MARGIN) }; break;
    case "top":    pos = { left: Math.min(Math.max(sx, MARGIN), vw - CARD_WIDTH - MARGIN), top: Math.max(sy - CARD_HEIGHT - MARGIN, MARGIN) }; break;
    case "right":  pos = { left: Math.min(sx + sw + MARGIN, vw - CARD_WIDTH - MARGIN), top: Math.min(Math.max(sy, MARGIN), vh - CARD_HEIGHT - MARGIN) }; break;
    case "left":   pos = { left: Math.max(sx - CARD_WIDTH - MARGIN, MARGIN), top: Math.min(Math.max(sy, MARGIN), vh - CARD_HEIGHT - MARGIN) }; break;
    default: pos = center;
  }

  pos.left = Math.max(MARGIN, Math.min(pos.left, vw - CARD_WIDTH - MARGIN));
  pos.top = Math.max(MARGIN, Math.min(pos.top, vh - CARD_HEIGHT - MARGIN));
  return pos;
}

interface TourCardProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  showChapters: boolean;
  loading: boolean;
}

export default function TourCard({ step, stepIndex, totalSteps, onNext, onBack, onSkip, showChapters, loading }: TourCardProps) {
  const [pos, setPos] = useState<CardPos>({ left: (window.innerWidth - CARD_WIDTH) / 2, top: (window.innerHeight - CARD_HEIGHT) / 2 });

  useEffect(() => {
    const measure = () => {
      setPos(computePosition(step.target, step.cardPosition ?? "center"));
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", measure); };
  }, [step.target, step.cardPosition, step.id]);

  const progress = (stepIndex + 1) / totalSteps;
  const chapterIdx = CHAPTERS.indexOf(step.chapter ?? "");
  const isLast = stepIndex === totalSteps - 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        left: pos.left,
        top: pos.top,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      style={{
        position: "fixed",
        width: CARD_WIDTH,
        zIndex: 10000,
        pointerEvents: "auto",
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      <div
        className="h-[3px]"
        style={{ background: "linear-gradient(90deg, rgb(var(--accent-600)), rgb(var(--accent-400)), rgb(var(--accent-600)))" }}
      />
      <div
        style={{
          background: "linear-gradient(145deg, rgba(13,12,20,0.98) 0%, rgba(16,14,24,0.98) 100%)",
          backdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none",
          borderRadius: "0 0 20px 20px",
          boxShadow: "0 0 80px rgb(var(--accent-500) / 0.1), 0 32px 80px rgba(0,0,0,0.65)",
        }}
      >
        <div className="p-5 pb-0">
          <div className="mb-4">
            <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, rgb(var(--accent-600)), rgb(var(--accent-400)))" }}
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.6 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md"
              style={{ background: "rgb(var(--accent-500) / 0.12)", color: "rgb(var(--accent-400))" }}
            >
              {stepIndex + 1}/{totalSteps}
            </span>
            {showChapters && step.chapter && (
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgb(var(--accent-300))" }}
              >
                {step.chapter}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 min-h-[90px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: loading ? 0.4 : 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-[17px] font-bold text-white mb-2 leading-snug">{step.title}</h3>
              <p className="text-[13px] text-slate-400 leading-relaxed">{step.body}</p>
              {step.hint && (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] mt-3"
                  style={{
                    background: "rgb(var(--accent-500) / 0.1)",
                    color: "rgb(var(--accent-300))",
                    border: "1px solid rgb(var(--accent-500) / 0.15)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  {step.hint}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 px-5 pb-4 pt-3">
          <button
            onClick={onSkip}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors mr-auto"
          >
            Skip tour
          </button>
          {stepIndex > 0 && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onBack}
              disabled={loading}
              className="text-[12px] py-1.5 px-3 rounded-lg font-medium text-slate-400 hover:text-white transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              Back
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onNext}
            disabled={loading}
            className="btn-primary text-[12px] py-1.5 px-5 disabled:opacity-40"
          >
            {isLast ? "Finish" : "Next"}
          </motion.button>
        </div>

        {showChapters && chapterIdx >= 0 && (
          <div className="flex gap-0.5 px-5 pb-4">
            {CHAPTERS.map((ch, i) => (
              <div
                key={ch}
                title={ch}
                className="flex-1 h-1 rounded-full transition-all duration-500"
                style={{
                  background: i <= chapterIdx
                    ? "linear-gradient(90deg, rgb(var(--accent-500)), rgb(var(--accent-400)))"
                    : "rgba(255,255,255,0.04)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
