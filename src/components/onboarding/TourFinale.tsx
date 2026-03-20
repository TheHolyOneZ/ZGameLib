import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

interface TourFinaleProps {
  onComplete: () => void;
}

function PurpleHeart({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 512 512" className={className} style={style} fill="none">
      <defs>
        <linearGradient id="heart-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="35%" stopColor="#a855f7" />
          <stop offset="70%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <filter id="heart-glow">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feFlood floodColor="#a855f7" floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M256 448l-30.164-27.211C118.718 322.927 48 258.636 48 180c0-63.279 50.721-116 112-116 34.857 0 68.266 16.666 96 43.184C283.734 80.666 317.143 64 352 64c61.279 0 112 52.721 112 116 0 78.636-70.718 142.927-177.836 240.789z"
        fill="url(#heart-grad)"
        filter="url(#heart-glow)"
      />
    </svg>
  );
}

const PERKS = [
  "No telemetry",
  "No cloud dependency",
  "No account required",
  "Fully offline",
  "100% yours",
];

export default function TourFinale({ onComplete }: TourFinaleProps) {
  const [phase, setPhase] = useState<"message" | "heart" | "credit" | "fadeout">("message");

  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        w: 2 + Math.random() * 3,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        opacity: 0.15 + Math.random() * 0.35,
        dy: -30 - Math.random() * 40,
        dur: 2 + Math.random() * 3,
        delay: Math.random() * 2,
      })),
    []
  );

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("heart"), 4500);
    const t2 = setTimeout(() => setPhase("credit"), 6200);
    const t3 = setTimeout(() => setPhase("fadeout"), 9400);
    const t4 = setTimeout(() => onComplete(), 10200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "rgba(0,0,0,0.96)", zIndex: 10001 }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: p.w,
              height: p.w,
              background: `rgba(168, 85, 247, ${p.opacity})`,
              left: p.left,
              top: p.top,
            }}
            animate={{ y: [0, p.dy], opacity: [0.4, 0], scale: [1, 0.3] }}
            transition={{ duration: p.dur, repeat: Infinity, repeatType: "loop", delay: p.delay, ease: "easeOut" }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {phase === "message" && (
          <motion.div
            key="message"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6 }}
            className="relative flex flex-col items-center text-center px-8 max-w-lg"
          >
            <motion.h2
              className="text-2xl font-black text-white mb-3 leading-snug"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              Have fun with your personal game library
            </motion.h2>
            <motion.p
              className="text-[15px] text-slate-400 mb-6 leading-relaxed"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              Everything runs on your machine. Your data never leaves your PC.
            </motion.p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {PERKS.map((perk, i) => (
                <motion.span
                  key={perk}
                  className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full"
                  style={{
                    background: "rgba(168,85,247,0.1)",
                    border: "1px solid rgba(168,85,247,0.2)",
                    color: "#c084fc",
                  }}
                  initial={{ opacity: 0, scale: 0.7, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  {perk}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "heart" && (
          <motion.div
            key="heart"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.2, opacity: 0, rotateZ: -15 }}
              animate={{ scale: [0.2, 1.15, 1], opacity: 1, rotateZ: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <PurpleHeart
                className="w-44 h-44"
                style={{ filter: "drop-shadow(0 0 50px rgba(168,85,247,0.5))" }}
              />
            </motion.div>
          </motion.div>
        )}

        {phase === "credit" && (
          <motion.div
            key="credit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.6 }}
            className="relative flex flex-col items-center"
          >
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 14], opacity: [1, 0] }}
              transition={{ duration: 1.5, ease: [0.32, 0, 0.67, 0] }}
            >
              <PurpleHeart
                className="w-44 h-44"
                style={{ filter: "drop-shadow(0 0 50px rgba(168,85,247,0.5))" }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="absolute text-center"
              style={{ top: "50%", transform: "translateY(-50%)" }}
            >
              <motion.p
                className="text-[15px] font-medium tracking-wide"
                style={{ color: "rgba(168,85,247,0.6)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                Made By
              </motion.p>
              <motion.h2
                className="text-4xl font-black tracking-tight mt-1"
                style={{
                  background: "linear-gradient(135deg, #c084fc, #a855f7, #7e22ce)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 24px rgba(168,85,247,0.4))",
                }}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                TheHolyOneZ
              </motion.h2>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
