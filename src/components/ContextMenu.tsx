import type { ButtonHTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type ContextMenuProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  opener: HTMLElement | null;
  onClose: () => void;
  x: number;
  y: number;
};

const EDGE_GUTTER = 8;

export function ContextMenuItem({
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} role="menuitem" type={type} />;
}

export function ContextMenu({
  ariaLabel,
  children,
  className = "contextMenu",
  opener,
  onClose,
  x,
  y,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const dismiss = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
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
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", clampToViewport);
    };
  }, [clampToViewport]);

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    });
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) dismiss();
    };
    const closeOnBlur = () => dismiss();
    document.addEventListener("pointerdown", closeOnPointerDown, true);
    window.addEventListener("blur", closeOnBlur);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOnPointerDown, true);
      window.removeEventListener("blur", closeOnBlur);
    };
  }, [dismiss]);

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
      className={className}
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
    >
      {children}
    </div>
  );
}
