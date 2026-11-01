import { AnimatePresence, motion } from "framer-motion";
import { AlertIcon } from "@/components/ui/Icons";
import { useUIStore } from "@/store/useUIStore";

const DANGER = /delete|remove|stop|quit|purge|empty/i;

export default function ConfirmModal() {
  const dialog = useUIStore((s) => s.confirmDialog);
  const closeConfirm = useUIStore((s) => s.closeConfirm);
  const bigPicture = useUIStore((s) => s.bigPicture);
  const label = dialog?.confirmLabel ?? "Remove";
  const danger = DANGER.test(label);

  return (
    <AnimatePresence>
      {dialog?.open && !bigPicture && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          onClick={closeConfirm}
          onKeyDown={(e) => { if (e.key === "Escape") closeConfirm(); }}
          className="fixed inset-0 z-[80] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, pointerEvents: "none" }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl p-6 w-full max-w-[420px] mx-4"
            style={{ boxShadow: "0 40px 90px -20px rgba(0,0,0,0.85)" }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={danger
                  ? { background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.25)" }
                  : { background: "rgb(var(--accent-500) / 0.15)", border: "1px solid rgb(var(--accent-400) / 0.3)" }}
              >
                <AlertIcon size={20} className={danger ? "text-red-400" : "text-accent-300"} />
              </div>
              <div className="pt-0.5">
                <h3 className="text-[15px] font-semibold text-white mb-1">Are you sure?</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">{dialog.title}</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button onClick={closeConfirm} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button
                autoFocus
                onClick={() => { const fn = dialog.onConfirm; closeConfirm(); fn(); }}
                className={danger ? "flex-1 justify-center flex items-center gap-2 font-semibold px-4 py-2.5 rounded-xl text-sm text-white transition-all hover:brightness-110" : "btn-primary flex-1 justify-center"}
                style={danger ? { background: "linear-gradient(180deg, #ef4444, #b91c1c)", border: "1px solid rgba(248,113,113,0.4)", boxShadow: "0 8px 24px -8px rgba(239,68,68,0.6)" } : undefined}
              >
                {label}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
