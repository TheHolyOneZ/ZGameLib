import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/useUIStore";

export default function LoadingBeam() {
  const isScanning = useUIStore((s) => s.isScanning);
  const isBulkAdding = useUIStore((s) => s.isBulkAdding);
  const visible = isScanning || isBulkAdding;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="loading-beam-track"
        >
          <motion.div
            className="loading-beam"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: [0.45, 0, 0.55, 1],
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
