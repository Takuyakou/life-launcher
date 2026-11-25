/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadTestProfileInfo } from "../tauri";
import { focusDictionaryWindowIfVisible } from "../dictionaryWindow";

type Deps = Record<string, any>;

export function useBootstrapAndSubscriptions(deps: Deps) {
  const {
    dictionaryLocked,
    dictionaryVisible,
    setTestProfile,
  } = deps;

  useEffect(() => {
    void loadTestProfileInfo()
      .then(setTestProfile)
      .catch(() => undefined);
  }, [setTestProfile]);

  




  useEffect(() => {
    if (!dictionaryVisible || !dictionaryLocked) return;
    const shell = document.querySelector<HTMLElement>(".appShell");
    if (!shell) return;
    const children = Array.from(shell.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        !child.classList.contains("dictionaryMainScrim") &&
        child.tagName !== "A",
    );
    for (const child of children) child.setAttribute("inert", "");
    return () => {
      for (const child of children) child.removeAttribute("inert");
    };
  }, [dictionaryLocked, dictionaryVisible]);

  useEffect(() => {
    if (!dictionaryVisible || !dictionaryLocked) return;
    let disposed = false;
    const unlistenPromise = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (!focused || disposed) return;
      void focusDictionaryWindowIfVisible();
    });
    return () => {
      disposed = true;
      void unlistenPromise
        .then((unlisten) => {
          if (disposed) unlisten();
        })
        .catch(() => undefined);
    };
  }, [dictionaryLocked, dictionaryVisible]);

}
