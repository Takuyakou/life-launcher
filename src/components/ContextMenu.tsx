import type { ButtonHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ExitPresenceAttributes } from "./ExitPresence";

type ContextMenuProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  opener: HTMLElement | null;
  onClose: () => void;
  /** P10-12 (D15): a plain-key shortcut that only works while the menu is open (e.g. "t"). */
  onShortcutKey?: (key: string) => boolean;
  x: number;
  y: number;
  /** V164 (E1): attributes for the close motion; the menu is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

const EDGE_GUTTER = 8;

type ContextMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** P10-12 (D15): key badge shown at the right edge; only for keys that really work. */
  shortcut?: string;
};

export function ContextMenuItem({
  children,
  shortcut,
  type = "button",
  ...props
}: ContextMenuItemProps) {
  return (
    <button {...props} role="menuitem" type={type}>
      <span className="contextMenuItemLabel">{children}</span>
      {shortcut ? (
        <kbd aria-hidden="true" className="contextMenuShortcut shortcutBadge">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

export function ContextMenu({
  ariaLabel,
  children,
  className = "contextMenu",
  opener,
  onClose,
  onShortcutKey,
  x,
  y,
  exitProps,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  /** V164: while the close motion plays the menu is inert; it must not take keys, clicks or focus. */
  const exiting = exitProps?.["data-exiting"] === "true";

  const dismiss = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => {
      if (document.activeElement?.closest('[role="menu"]:not([data-exiting="true"])')) return;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }, [onClose, opener]);

  const clampToViewport = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { height, width } = menu.getBoundingClientRect();
    const nextPosition = {
      x: Math.max(EDGE_GUTTER, Math.min(x, window.innerWidth - width - EDGE_GUTTER)),
      y: Math.max(EDGE_GUTTER, Math.min(y, window.innerHeight - height - EDGE_GUTTER)),
    };
    menu.style.left = `${nextPosition.x}px`;
    menu.style.top = `${nextPosition.y}px`;
    menu.style.opacity = "1";
    menu.style.visibility = "visible";
  }, [x, y]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    menu.style.opacity = "0";
    menu.style.visibility = "hidden";
    const observer = new ResizeObserver(clampToViewport);
    observer.observe(menu);
    window.addEventListener("resize", clampToViewport);
    clampToViewport();
    menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", clampToViewport);
    };
  }, [clampToViewport]);

  useEffect(() => {
    if (exiting) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) dismiss();
    };
    const closeOnKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (
        !onShortcutKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return;
      }
      if (event.key.length !== 1) return;
      if (onShortcutKey(event.key.toLowerCase())) {
        event.preventDefault();
        dismiss();
      }
    };
    const closeOnBlur = () => dismiss();
    document.addEventListener("pointerdown", closeOnPointerDown, true);
    document.addEventListener("keydown", closeOnKeyDown);
    window.addEventListener("blur", closeOnBlur);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown, true);
      document.removeEventListener("keydown", closeOnKeyDown);
      window.removeEventListener("blur", closeOnBlur);
    };
  }, [dismiss, exiting, onShortcutKey]);

  const moveFocus = (direction: "first" | "last" | "next" | "previous") => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (!items.length) return;
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const next =
      direction === "first"
        ? 0
        : direction === "last"
          ? items.length - 1
          : (current + (direction === "next" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled || !menuRef.current?.contains(button)) return;
    onClose();
  };

  return (
    <div
      aria-label={ariaLabel}
      className={`${className} uiMenuEnter`}
      data-focus-overlay="true"
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dismiss();
          return;
        }
        const direction =
          event.key === "ArrowDown"
            ? "next"
            : event.key === "ArrowUp"
              ? "previous"
              : event.key === "Home"
                ? "first"
                : event.key === "End"
                  ? "last"
                  : null;
        if (!direction) return;
        event.preventDefault();
        moveFocus(direction);
      }}
      ref={menuRef}
      role="menu"
      style={{
        left: 0,
        opacity: 0,
        top: 0,
        transition: "none",
        visibility: "hidden",
      }}
      {...exitProps}
    >
      {children}
    </div>
  );
}
