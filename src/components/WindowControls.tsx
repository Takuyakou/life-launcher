import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UiIcon } from "./UiIcon";

type WindowControlsProps = {
  variant?: "dashboard" | "instruction";
};

// 窓の右上に固定する最小化・最大化・閉じるの3ボタン。
// 標準のタイトルバーの代わり。ブラウザ(画像比較・Webプレビュー)では
// 押しても何もしない。
export function WindowControls({ variant = "dashboard" }: WindowControlsProps) {
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(true);

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
      if (!disposed) setFocused(payload);
    });
    return () => {
      disposed = true;
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      unlistenResized.then((unlisten) => unlisten()).catch(() => undefined);
      unlistenFocus.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, []);

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

  const variantClass =
    variant === "instruction" ? " windowControls--instruction" : " windowControls--dashboard";

  return (
    <div
      className={`windowControls${variantClass}${focused ? "" : " windowControls--unfocused"}`}
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
