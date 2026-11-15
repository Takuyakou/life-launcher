import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { springSnappy } from "../motion";
import { UiIcon } from "./UiIcon";

type CopyButtonProps = {
  className?: string;
  /** Label while idle. */
  label: string;
  /** Label shown for 1.5s after a successful copy. */
  copiedLabel?: string;
  /** Copies the payload. Throw to keep the label unchanged (the caller shows the failure toast). */
  onCopy: () => Promise<void>;
  icon?: "copy" | "none";
};

const COPIED_LABEL_MS = 1_500;

/**
 * P10-11 (§14.2 / D36): a copy button whose label swaps to "コピーしました" for 1.5s.
 * The width follows the longer label so the button never moves; the swap is a short spring.
 */
export function CopyButton({
  className,
  label,
  copiedLabel = "コピーしました",
  onCopy,
  icon = "copy",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longerLabel = copiedLabel.length > label.length ? copiedLabel : label;

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await onCopy();
    } catch {
      return;
    }
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setCopied(false);
    }, COPIED_LABEL_MS);
  };

  return (
    <button
      className={className ? `copyButton ${className}` : "copyButton"}
      data-copied={copied ? "true" : "false"}
      onClick={() => void handleCopy()}
      type="button"
    >
      {icon === "copy" ? <UiIcon name={copied ? "check" : "copy"} size={16} /> : null}
      <span className="copyButtonLabel">
        <span aria-hidden="true" className="copyButtonSizer">
          {longerLabel}
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="copyButtonText"
            exit={{ opacity: 0, y: copied ? -8 : 8 }}
            initial={{ opacity: 0, y: copied ? 8 : -8 }}
            key={copied ? "copied" : "label"}
            transition={springSnappy}
          >
            {copied ? copiedLabel : label}
          </motion.span>
        </AnimatePresence>
      </span>
      <span aria-live="polite" className="srOnly">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );
}
