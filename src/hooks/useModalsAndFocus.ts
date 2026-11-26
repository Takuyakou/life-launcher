/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";

type Deps = Record<string, any>;

export function useModalsAndFocus(deps: Deps) {
  const {
    activeView,
    completionPrompt,
    config,
    confirmDialog,
    contextMenu,
    dismissNonCriticalModal,
    earlyStop,
    hasDismissibleModal,
    helpGuideOpen,
    openSearchRef,
    searchOpen,
    setHelpGuideOpen,
  } = deps;

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        completionPrompt ||
        confirmDialog ||
        earlyStop ||
        !hasDismissibleModal
      )
        return;
      event.preventDefault();
      dismissNonCriticalModal();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [completionPrompt, confirmDialog, earlyStop, dismissNonCriticalModal, hasDismissibleModal]);

  // P10-03: Ctrl+F opens the search window from the main window (the dictionary and the
  // instruction viewer keep their own handling).
  useEffect(() => {
    const openOnCtrlF = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || !event.ctrlKey) return;
      if (event.altKey || event.metaKey || event.shiftKey) return;
      if (event.repeat) return;
      if (event.isComposing || event.keyCode === 229) return;
      // The main window always swallows Ctrl+F, even when the search window cannot open
      // (a dialog or a menu is up): WebView2's own find bar must never come up. Only the
      // Japanese conversion case above is left alone.
      event.preventDefault();
      if (activeView !== "main") return;
      if (completionPrompt || confirmDialog || earlyStop) return;
      if (contextMenu) return;
      if (hasDismissibleModal && !searchOpen) return;
      openSearchRef.current();
    };
    window.addEventListener("keydown", openOnCtrlF, true);
    return () => window.removeEventListener("keydown", openOnCtrlF, true);
  }, [
    activeView,
    completionPrompt,
    confirmDialog,
    contextMenu,
    earlyStop,
    hasDismissibleModal,
    searchOpen,    openSearchRef,

  ]);
  // P10-02: F1 opens the guide from the main window. It stays out of the way when a dialog or a
  // menu is open, while Japanese input is composing, or when the dictionary key is exactly F1.
  useEffect(() => {
    const openGuideOnF1 = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "F1") return;
      if (event.isComposing || event.keyCode === 229) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (activeView !== "main") return;
      if (hasDismissibleModal || completionPrompt || confirmDialog || earlyStop) return;
      if (contextMenu) return;
      const launcherKey = (config?.settings.launcherHotkey ?? "").trim().toUpperCase();
      if (launcherKey === "F1") return;
      event.preventDefault();
      setHelpGuideOpen(true);
    };
    window.addEventListener("keydown", openGuideOnF1);
    return () => window.removeEventListener("keydown", openGuideOnF1);
  }, [
    activeView,
    completionPrompt,
    config?.settings.launcherHotkey,
    confirmDialog,
    contextMenu,
    earlyStop,
    hasDismissibleModal,    setHelpGuideOpen,

  ]);

  useEffect(() => {
    if (
      confirmDialog ||
      earlyStop ||
      helpGuideOpen ||
      (!hasDismissibleModal && !completionPrompt)
    ) {
      return;
    }

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const topSurface = () => {
      const surfaces = document.querySelectorAll<HTMLElement>(
        '.modalBackdrop:not([data-exiting="true"])',
      );
      return surfaces.item(surfaces.length - 1)?.querySelector<HTMLElement>("section") ?? null;
    };
    const focusableInside = (surface: HTMLElement) =>
      Array.from(
        surface.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    const focusFrame = window.requestAnimationFrame(() => {
      const surface = topSurface();
      if (!surface || surface.contains(document.activeElement)) return;
      (
        surface.querySelector<HTMLElement>("[data-initial-focus]:not([disabled])") ??
        focusableInside(surface)[0] ??
        surface
      ).focus();
    });
    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const surface = topSurface();
      if (!surface) return;
      const controls = focusableInside(surface);
      if (controls.length === 0) {
        event.preventDefault();
        surface.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!surface.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", trapFocus, true);
      opener?.focus();
    };
  }, [
    completionPrompt,
    confirmDialog,
    earlyStop,
    hasDismissibleModal,
    helpGuideOpen,
  ]);

}
