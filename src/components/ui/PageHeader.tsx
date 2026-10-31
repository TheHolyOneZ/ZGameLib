import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tint?: string;
}

export default function PageHeader({ icon, title, subtitle, actions, tint }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-4 px-8 pt-7 pb-2"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
        style={{
          background: tint
            ? `linear-gradient(140deg, ${tint}40, ${tint}12)`
            : "linear-gradient(140deg, rgb(var(--accent-500) / 0.3), rgb(var(--accent-700) / 0.08))",
          border: tint ? `1px solid ${tint}40` : "1px solid rgb(var(--accent-400) / 0.25)",
          boxShadow: tint ? `0 10px 30px -10px ${tint}80` : "0 10px 30px -10px rgb(var(--accent-500) / 0.6)",
          color: tint ?? "rgb(var(--accent-300))",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-[26px] font-bold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </motion.div>
  );
}
