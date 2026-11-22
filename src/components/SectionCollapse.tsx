import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { springCollapse } from "../motion";


/** P10-14f (F6): the same height/opacity spring for the sidebar and the main sections. */
export function SectionCollapse({
  open,
  dragActive,
  children,
}: {
  open: boolean;
  dragActive: boolean;
  children: ReactNode;
}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setSettled(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
          exit={{ height: 0, opacity: 0, overflow: "hidden" }}
          style={{ overflow: settled ? "visible" : "hidden" }}
          transition={dragActive ? { duration: 0 } : springCollapse}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
