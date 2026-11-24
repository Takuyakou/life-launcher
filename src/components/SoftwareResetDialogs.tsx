import type { RefObject } from "react";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

type SoftwareResetChoiceDialogProps = {
  busy: boolean;
  onContinue: (withBackup: boolean) => void;
  onClose: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

/** Prompts whether to save a backup before starting a software reset. */
export function SoftwareResetChoiceDialog({
  busy,
  onContinue,
  onClose,
  exitProps,
}: SoftwareResetChoiceDialogProps) {
  return (
    <div
      className="modalBackdrop confirmBackdrop softwareResetChoiceBackdrop"
      role="presentation"
      {...exitProps}
    >
      <section
        aria-describedby="software-reset-choice-description"
        aria-labelledby="software-reset-choice-title"
        aria-modal="true"
        className="dropDialog confirmDialog softwareResetChoiceDialog"
        role="dialog"
      >
        <div className="confirmDialogHeader">
          <h2 id="software-reset-choice-title">リセット前にバックアップしますか？</h2>
          <button
            aria-label="確認を閉じる"
            className="confirmDialogClose"
            disabled={busy}
            onClick={onClose}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>
        <div className="confirmDialogBody" id="software-reset-choice-description">
          <p>
            現在のデータをバックアップしておくと、
            <br />
            必要になった場合に元へ戻せます。
          </p>
        </div>
        <div className="dialogActions softwareResetChoiceActions">
          <button
            className="confirmDialogButton mainActionButton mainActionButton--gold"
            disabled={busy}
            onClick={() => onContinue(true)}
            type="button"
          >
            {busy ? "バックアップしています…" : "バックアップして続行"}
          </button>
          <button
            className="dangerButton"
            disabled={busy}
            onClick={() => onContinue(false)}
            type="button"
          >
            バックアップせず続行
          </button>
          <button
            autoFocus
            className="secondaryButton settingsButton--neutral"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}

type SoftwareResetProgressDialogProps = {
  stage: "resetting" | "restart";
  progressRef: RefObject<HTMLElement>;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

/** Non-dismissible progress modal displayed during software reset and relaunch. */
export function SoftwareResetProgressDialog({
  stage,
  progressRef,
  exitProps,
}: SoftwareResetProgressDialogProps) {
  return (
    <div className="modalBackdrop softwareResetProgressBackdrop" role="presentation" {...exitProps}>
      <section
        aria-labelledby="software-reset-progress-title"
        aria-live="assertive"
        aria-modal="true"
        className="dropDialog softwareResetProgressDialog"
        onKeyDown={(event) => {
          if (event.key === "Tab") event.preventDefault();
        }}
        ref={progressRef}
        role="dialog"
        tabIndex={-1}
      >
        <span aria-hidden="true" className="softwareResetProgressIndicator" />
        <div>
          <h2 id="software-reset-progress-title">
            {stage === "restart"
              ? "Life Launcherを再起動しています"
              : "ソフトウェアリセットを実行しています"}
          </h2>
          <p>この画面を閉じずにお待ちください。</p>
        </div>
      </section>
    </div>
  );
}
