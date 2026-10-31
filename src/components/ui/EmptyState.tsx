import { motion } from "framer-motion";
import { GamepadIcon } from "@/components/ui/Icons";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center py-24 gap-5 text-center px-8"
    >
      <div className="relative">
        <div className="absolute inset-0 blur-2xl opacity-50" style={{ background: "radial-gradient(circle, rgb(var(--accent-500) / 0.5), transparent 70%)" }} />
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-20 h-20 rounded-3xl flex items-center justify-center text-accent-300"
          style={{ background: "linear-gradient(160deg, rgb(var(--accent-500) / 0.22), rgba(255,255,255,0.03))", border: "1px solid rgb(var(--accent-400) / 0.25)" }}
        >
          {icon ?? <GamepadIcon size={36} />}
        </motion.div>
      </div>
      <div className="space-y-2">
        <h3 className="text-[20px] font-semibold text-white">{title}</h3>
        <p className="text-[13.5px] text-slate-400 max-w-sm leading-relaxed">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}
