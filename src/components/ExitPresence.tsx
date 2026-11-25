import { Fragment, useCallback, useEffect, useRef, type AnimationEvent, type ReactNode } from "react";
import { usePresence, useReducedMotion } from "motion/react";

/**
 * V164 (E1): how long we wait for the CSS close motion before removing the element anyway.
 * The paused-clock tests never reach this timer, so the animationend below is the real path.
 */
const EXIT_FALLBACK_MS = 240;

/** The attributes that make an element that is playing its close motion unclickable. */
export type ExitPresenceAttributes = {
  onAnimationEnd?: (event: AnimationEvent<HTMLElement>) => void;
  "aria-hidden"?: "true";
  "data-exiting"?: "true";
  inert?: "";
};

export type ExitPresenceRender = (
  exiting: boolean,
  exitProps: ExitPresenceAttributes,
) => ReactNode;

type ExitPresenceProps = {
  children: ExitPresenceRender;
};

/**
 * V164 (E1): keeps a dialog, a menu or an overlay mounted while its CSS close motion runs.
 *
 * It sits directly under `<AnimatePresence initial={false}>` and hands the close state to the
 * child through a render prop, so the DOM parent/child of the surface never changes. The open
 * motion stays the CSS `@keyframes` in `09-ui-parts-book.css`; only the close waits for
 * `animationend`, which keeps working while the tests freeze the clock.
 */
export function ExitPresence({ children }: ExitPresenceProps) {
  const [isPresent, safeToRemove] = usePresence();
  const prefersReducedMotion = useReducedMotion();
  const removedRef = useRef(false);
  /** Counts the openings of this surface, so a surface that opens again starts from a fresh tree. */
  const generationRef = useRef(0);
  const wasPresentRef = useRef(isPresent);

  if (wasPresentRef.current !== isPresent) {
    wasPresentRef.current = isPresent;
    if (isPresent) {
      // A surface that was closed and opened again within the same close motion keeps its React
      // tree unless the generation moves. A fresh tree is what the app had before the motion, and
      // it keeps the old focus, draft and processing state out of the new opening.
      generationRef.current += 1;
      removedRef.current = false;
    }
  }

  const remove = useCallback(() => {
    if (removedRef.current) return;
    removedRef.current = true;
    safeToRemove?.();
  }, [safeToRemove]);

  const exiting = !isPresent;

  useEffect(() => {
    if (isPresent) return;
    // With the reduced-motion setting the CSS motion is off, so there is nothing to wait for.
    if (prefersReducedMotion) {
      remove();
      return;
    }
    const fallback = window.setTimeout(remove, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(fallback);
  }, [isPresent, prefersReducedMotion, remove]);

  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (isPresent) return;
      const surface = event.currentTarget;
      if (typeof surface.getAnimations === "function") {
        // The backdrop and the dialog inside it close with different durations, so wait for the
        // last `ui-*-exit` motion in the subtree before removing anything.
        const stillClosing = surface.getAnimations({ subtree: true }).some((animation) => {
          if (animation.playState !== "running") return false;
          const name = (animation as CSSAnimation).animationName;
          return typeof name === "string" && name.endsWith("-exit");
        });
        if (stillClosing) return;
      }
      remove();
    },
    [isPresent, remove],
  );

  if (!exiting) return <Fragment key={generationRef.current}>{children(false, {})}</Fragment>;

  return (
    <Fragment key={generationRef.current}>
      {children(true, {
        "aria-hidden": "true",
        "data-exiting": "true",
        inert: "",
        onAnimationEnd,
      })}
    </Fragment>
  );
}
