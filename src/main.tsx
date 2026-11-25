import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-jp";
import App from "./App";
import { installSelectPickerKeyGuard } from "./selectPickerKeyGuard";
import "./styles.css";

// React やアプリのキー処理より先に付ける(window の capture の最初)。
installSelectPickerKeyGuard();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </React.StrictMode>,
);
