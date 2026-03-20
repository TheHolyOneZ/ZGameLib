import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourSpotlightProps {
  target: string | undefined;
  stepId: string;
}

const PADDING = 10;
const RADIUS = 14;

export default function TourSpotlight({ target, stepId }: TourSpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const scrollAndMeasure = async () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (!target) { setRect(null); return; }
      const el = document.querySelector(target);
      if (!el) { setRect(null); return; }

      const r = el.getBoundingClientRect();
      const isInView = r.top >= -20 && r.bottom <= window.innerHeight + 20;
      if (!isInView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        await new Promise((resolve) => setTimeout(resolve, 450));
        if (cancelledRef.current) return;
      }

      const final = el.getBoundingClientRect();
      setRect({
        x: final.left - PADDING,
        y: final.top - PADDING,
        width: final.width + PADDING * 2,
        height: final.height + PADDING * 2,
      });
    };

    const measureOnly = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      if (!target) { setRect(null); return; }
      const el = document.querySelector(target);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({
        x: r.left - PADDING,
        y: r.top - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    };

    requestAnimationFrame(() => { scrollAndMeasure(); });
    window.addEventListener("resize", measureOnly);
    return () => {
      cancelledRef.current = true;
      window.removeEventListener("resize", measureOnly);
    };
  }, [target, stepId]);

  const maskId = `tour-mask-${stepId}`;

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ width: vw, height: vh, zIndex: 9998 }}
      viewBox={`0 0 ${vw} ${vh}`}
    >
      <defs>
        <mask id={maskId}>
          <rect width={vw} height={vh} fill="white" />
          {rect && (
            <motion.rect
              key={stepId}
              initial={{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: 0, height: 0, rx: RADIUS }}
              animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height, rx: RADIUS }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              fill="black"
            />
          )}
        </mask>
        {rect && (
          <radialGradient id={`glow-${stepId}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgb(var(--accent-500))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(var(--accent-500))" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      <rect
        width={vw}
        height={vh}
        fill="rgba(0,0,0,0.75)"
        mask={`url(#${maskId})`}
      />

      <AnimatePresence>
        {rect && (
          <>
            <motion.rect
              key={`glow-${stepId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              x={rect.x - 20}
              y={rect.y - 20}
              width={rect.width + 40}
              height={rect.height + 40}
              rx={RADIUS + 10}
              fill={`url(#glow-${stepId})`}
            />
            <motion.rect
              key={`ring-${stepId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: "easeOut" }}
              x={rect.x - 4}
              y={rect.y - 4}
              width={rect.width + 8}
              height={rect.height + 8}
              rx={RADIUS + 4}
              fill="none"
              stroke="rgb(var(--accent-400))"
              strokeWidth="2"
            />
            <motion.rect
              key={`ring2-${stepId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.3, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, ease: "easeOut", delay: 0.3 }}
              x={rect.x - 10}
              y={rect.y - 10}
              width={rect.width + 20}
              height={rect.height + 20}
              rx={RADIUS + 8}
              fill="none"
              stroke="rgb(var(--accent-400))"
              strokeWidth="1"
            />
          </>
        )}
      </AnimatePresence>
    </svg>
  );
}
