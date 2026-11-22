import { motion } from "motion/react";
import { useState } from "react";
import { springSnappy } from "../motion";

/**
 * V163-M2: a face that slides to the chosen tab or toggle (layoutId). It is only seen while it
 * moves; at rest the chosen control keeps its own look, so nothing changes while standing still
 * (hover and focus included). With reduced motion there is no slide.
 */
export function SlidingFace({ className, layoutId }: { className: string; layoutId: string }) {
  const [moving, setMoving] = useState(false);
  return (
    <motion.span
      aria-hidden="true"
      className={className}
      data-moving={moving ? "" : undefined}
      layoutId={layoutId}
      onLayoutAnimationComplete={() => setMoving(false)}
      onLayoutAnimationStart={() => setMoving(true)}
      transition={springSnappy}
    />
  );
}
