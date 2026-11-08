import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UiIcon } from "./UiIcon";

type WindowControlsProps = {
  variant?: "dashboard" | "instruction";
  closeShortcutDisabled?: boolean;
};

// 窓の右上に固定する最小化・最大化・閉じるの3ボタン。
// 標準のタイトルバーの代わり。ブラウザ(画像比較・Webプレビュー)では
// 押しても何もしない。
export function WindowControls({
  variant = "dashboard",
  closeShortcutDisabled = false,
}: WindowControlsProps) {
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(true);
  // 窓を戻した直後、マウスが動くまで「乗せた色」を出さない(P96-01 追加修正)。
  const [hoverSuppressed, setHoverSuppressed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const currentWindow = getCurrentWindow();
    let disposed = false;
    let resizeFrame = 0;
    void currentWindow
      .isMaximized()
      .then((value) => {
        if (!disposed) setMaximized(value);
      })
      .catch(() => undefined);
    const unlistenResized = currentWindow.onResized(() => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        void currentWindow
          .isMaximized()
          .then((value) => {
            if (!disposed) setMaximized(value);
          })
          .catch(() => undefined);
      });
    });
    const unlistenFocus = currentWindow.onFocusChanged(({ payload }) => {
      if (disposed) return;
      setFocused(payload);
      // 最小化・タスクトレイから戻った直後は、乗せた色が残らないようにする。
      if (payload) setHoverSuppressed(true);
    });
    return () => {
      disposed = true;
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      unlistenResized.then((unlisten) => unlisten()).catch(() => undefined);
      unlistenFocus.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, []);

  // 次にマウスが動いたら(または押したら)今までどおりの反応へ戻す。
  useEffect(() => {
    if (!hoverSuppressed) return;
    const release = () => setHoverSuppressed(false);
    window.addEventListener("pointermove", release);
    window.addEventListener("pointerdown", release);
    return () => {
      window.removeEventListener("pointermove", release);
      window.removeEventListener("pointerdown", release);
    };
  }, [hoverSuppressed]);

  const minimize = useCallback(() => {
    if (!isTauri()) return;
    void getCurrentWindow()
      .minimize()
      .catch(() => undefined);
  }, []);

  const toggleMaximize = useCallback(() => {
    if (!isTauri()) return;
    void getCurrentWindow()
      .toggleMaximize()
      .catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    if (!isTauri()) return;
    // 閉じる要求にする(CloseRequested / onCloseRequested を通る)。
    // hide() や destroy() は使わない。
    void getCurrentWindow()
      .close()
      .catch(() => undefined);
  }, []);

  // Ctrl+W は閉じるボタンと同じ close() を呼ぶ。ダイアログや入力欄に
  // フォーカスがあっても窓を閉じられるよう、window の capture で受ける。
  // 設定で Ctrl+W を使っているときは、その設定を優先して閉じない。
  useEffect(() => {
    const handleCloseShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        (event.key.toLowerCase() !== "w" && event.code !== "KeyW")
      ) {
        return;
      }
      // WebView の既定の Ctrl+W と二重にならないようにする。
      event.preventDefault();
      if (closeShortcutDisabled || event.repeat) return;
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", handleCloseShortcut, true);
    return () => window.removeEventListener("keydown", handleCloseShortcut, true);
  }, [close, closeShortcutDisabled]);

  const variantClass =
    variant === "instruction" ? " windowControls--instruction" : " windowControls--dashboard";

  return (
    <div
      className={`windowControls${variantClass}${maximized ? " windowControls--maximized" : ""}${
        focused ? "" : " windowControls--unfocused"
      }${hoverSuppressed ? " windowControls--hover-suppressed" : ""}`}
    >
      <span aria-hidden="true" className="windowControlsDivider" />
      <div className="windowControlsButtons">
        <button
          aria-label="最小化"
          className="windowControlButton"
          onClick={minimize}
          title="最小化"
          type="button"
        >
          <UiIcon name="windowMinimize" size={12} />
        </button>
        <button
          aria-label={maximized ? "元に戻す" : "最大化"}
          className="windowControlButton"
          onClick={toggleMaximize}
          title={maximized ? "元に戻す" : "最大化"}
          type="button"
        >
          <UiIcon name={maximized ? "windowRestore" : "windowMaximize"} size={12} />
        </button>
        <button
          aria-label="閉じる"
          className="windowControlButton windowControlButton--close"
          onClick={close}
          title="閉じる"
          type="button"
        >
          <UiIcon name="windowClose" size={12} />
        </button>
      </div>
    </div>
  );
}
