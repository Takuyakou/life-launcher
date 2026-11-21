// V160-S7: remember whether the last input in this window was a key or a pointer.
// The book view mounts after the tree's Enter already happened, so this tracker is installed
// by the viewer as soon as the window opens.
let keyboardWasLast = false;
let installed = false;

export function installFocusModalityTracking(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "keydown",
    () => {
      keyboardWasLast = true;
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    () => {
      keyboardWasLast = false;
    },
    true,
  );
}

export function lastInputWasKeyboard(): boolean {
  return keyboardWasLast;
}
