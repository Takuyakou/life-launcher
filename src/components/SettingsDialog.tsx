import type { Dispatch, PointerEvent, SetStateAction } from "react";
import type { AppConfig } from "../types";
import { executeActions, type TestProfileInfo } from "../tauri";
import { DEFAULT_EXTEND_TIMER_MINUTES, WEEKLY_FOCUS_LIMIT } from "../constants";
import {
  SHORTCUT_DRAFT_FIELDS,
  type NumberInputDragField,
  type SettingsCenterDraft,
  type SettingsSectionKey,
  type ShortcutDraftField,
} from "../app/dashboardTypes";
import { shortcutValidationMessage } from "../app/helpers";
import type { ShortcutConflict } from "../shortcutConflicts";
import type { useToasts } from "../hooks/useToasts";
import { APP_VERSION } from "../version";
import { ProjectIdentity } from "./ProjectIdentity";
import { SlidingFace } from "./SlidingFace";
import { UiIcon } from "./UiIcon";

// V163-A1: the Settings dialog, moved out of App.tsx. The inside is the same DOM, text and handlers.

export type SettingsDialogProps = {
  config: AppConfig;
  dailyActivityCopying: boolean;
  instructionSettingsBusy: boolean;
  numberInputDragging: NumberInputDragField | null;
  settingsDraft: SettingsCenterDraft;
  settingsSection: SettingsSectionKey;
  shortcutConflicts: ShortcutConflict<ShortcutDraftField>[];
  shortcutRecordingField: ShortcutDraftField | null;
  softwareResetStage: "idle" | "resetting" | "restart";
  testProfile: TestProfileInfo | null;
  setHelpGuideOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsDraft: Dispatch<SetStateAction<SettingsCenterDraft | null>>;
  setSettingsSection: Dispatch<SetStateAction<SettingsSectionKey>>;
  showToast: ReturnType<typeof useToasts>["showToast"];
  addInstructionFolder: () => void;
  beginShortcutRecording: (field: ShortcutDraftField) => void;
  cancelNumberInputDrag: (event: PointerEvent<HTMLElement>) => void;
  chooseBackupFolder: () => void;
  chooseBackupZipForRestore: () => void;
  copyTodayActivityLog: () => void;
  finishNumberInputDrag: (event: PointerEvent<HTMLElement>) => void;
  finishShortcutRecording: () => void;
  openBackupFolder: () => void;
  openRuntimeDataFolder: () => void;
  reloadInstructionList: () => void;
  removeInstructionFolder: (path: string) => void;
  requestClearBackupFolder: () => void;
  requestCloseSettings: () => void;
  requestIconCacheRegeneration: () => void;
  requestInstructionWindowPositionReset: () => void;
  requestMiniWindowPositionReset: () => void;
  requestSoftwareReset: () => void;
  saveSettingsCenter: () => void;
  startNumberInputDrag: (
    event: PointerEvent<HTMLElement>,
    field: NumberInputDragField,
    value: number,
  ) => void;
  updateNumberInputDrag: (event: PointerEvent<HTMLElement>) => void;
};

export function SettingsDialog(props: SettingsDialogProps) {
  const {
    config,
    dailyActivityCopying,
    instructionSettingsBusy,
    numberInputDragging,
    settingsDraft,
    settingsSection,
    shortcutConflicts,
    shortcutRecordingField,
    softwareResetStage,
    testProfile,
    setHelpGuideOpen,
    setSettingsDraft,
    setSettingsSection,
    showToast,
    addInstructionFolder,
    beginShortcutRecording,
    cancelNumberInputDrag,
    chooseBackupFolder,
    chooseBackupZipForRestore,
    copyTodayActivityLog,
    finishNumberInputDrag,
    finishShortcutRecording,
    openBackupFolder,
    openRuntimeDataFolder,
    reloadInstructionList,
    removeInstructionFolder,
    requestClearBackupFolder,
    requestCloseSettings,
    requestIconCacheRegeneration,
    requestInstructionWindowPositionReset,
    requestMiniWindowPositionReset,
    requestSoftwareReset,
    saveSettingsCenter,
    startNumberInputDrag,
    updateNumberInputDrag,
  } = props;

  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="設定"
        aria-modal="true"
        className="dropDialog settingsDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div className="modalTitleRow">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>設定</h2>
          </div>
          <button
            aria-label="設定を閉じる"
            className="iconButton"
            onClick={requestCloseSettings}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>

        <div className="settingsTabs" role="tablist" aria-label="設定カテゴリ">
          {[
            ["basic", "基本"],
            ["shortcuts", "ショートカット"],
            ["instructions", "手順書"],
            ["backup", "バックアップ"],
            ["maintenance", "メンテナンス"],
          ].map(([key, label]) => (
            <button
              aria-selected={settingsSection === key}
              className={
                settingsSection === key ? "settingsTab settingsTab--active" : "settingsTab"
              }
              key={key}
              onClick={() => {
                if (shortcutRecordingField) {
                  void finishShortcutRecording();
                }
                setSettingsSection(key as SettingsSectionKey);
              }}
              role="tab"
              type="button"
            >
              {settingsSection === key && (
                <SlidingFace className="settingsTabFace" layoutId="settings-tab-face" />
              )}
              <span className="settingsTabLabel">{label}</span>
            </button>
          ))}
        </div>

        <div
          className={
            settingsSection === "basic"
              ? "settingsSection app-scrollbar"
              : "settingsSection settingsSection--hidden app-scrollbar"
          }
        >
          <div className="settingsGuideRow">
            <div>
              <h3>使い方</h3>
              <p>アプリの使い方とキーの一覧を開きます。</p>
            </div>
            <button
              className="secondaryButton settingsGuideButton"
              onClick={() => setHelpGuideOpen(true)}
              type="button"
            >
              使い方を開く
            </button>
          </div>
          <h3>基本</h3>
          <div className="settingsGrid settingsGrid--timers">
            <label
              className={
                numberInputDragging === "settingsShort"
                  ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                  : "fieldStack fieldStack--numberDrag"
              }
              onPointerCancel={cancelNumberInputDrag}
              onPointerDown={(event) =>
                startNumberInputDrag(
                  event,
                  "settingsShort",
                  Number.parseInt(settingsDraft.shortTimerMinutes, 10) || 5,
                )
              }
              onPointerMove={updateNumberInputDrag}
              onPointerUp={finishNumberInputDrag}
              title="上下にドラッグして分数を調整"
            >
              <span>短時間タイマー分数</span>
              <span className="numberDragInput">
                <input
                  className="textInput"
                  max={240}
                  min={1}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      shortTimerMinutes: event.target.value,
                    })
                  }
                  type="number"
                  value={settingsDraft.shortTimerMinutes}
                />
                <span aria-hidden="true" className="numberDragAffordance" />
              </span>
            </label>
            <label
              className={
                numberInputDragging === "settingsDefault"
                  ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                  : "fieldStack fieldStack--numberDrag"
              }
              onPointerCancel={cancelNumberInputDrag}
              onPointerDown={(event) =>
                startNumberInputDrag(
                  event,
                  "settingsDefault",
                  Number.parseInt(settingsDraft.defaultTimerMinutes, 10) || 25,
                )
              }
              onPointerMove={updateNumberInputDrag}
              onPointerUp={finishNumberInputDrag}
              title="上下にドラッグして分数を調整"
            >
              <span>通常タイマー分数</span>
              <span className="numberDragInput">
                <input
                  className="textInput"
                  max={240}
                  min={1}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      defaultTimerMinutes: event.target.value,
                    })
                  }
                  type="number"
                  value={settingsDraft.defaultTimerMinutes}
                />
                <span aria-hidden="true" className="numberDragAffordance" />
              </span>
            </label>
            <label
              className={
                numberInputDragging === "settingsExtend"
                  ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                  : "fieldStack fieldStack--numberDrag"
              }
              onPointerCancel={cancelNumberInputDrag}
              onPointerDown={(event) =>
                startNumberInputDrag(
                  event,
                  "settingsExtend",
                  Number.parseInt(settingsDraft.extendTimerMinutes, 10) ||
                    DEFAULT_EXTEND_TIMER_MINUTES,
                )
              }
              onPointerMove={updateNumberInputDrag}
              onPointerUp={finishNumberInputDrag}
              title="上下にドラッグして分数を調整"
            >
              <span>延長タイマー分数</span>
              <span className="numberDragInput">
                <input
                  className="textInput"
                  max={240}
                  min={1}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      extendTimerMinutes: event.target.value,
                    })
                  }
                  type="number"
                  value={settingsDraft.extendTimerMinutes}
                />
                <span aria-hidden="true" className="numberDragAffordance" />
              </span>
            </label>
            <label
              className={
                numberInputDragging === "settingsDayStart"
                  ? "fieldStack fieldStack--numberDrag fieldStack--numberDragging"
                  : "fieldStack fieldStack--numberDrag"
              }
              onPointerCancel={cancelNumberInputDrag}
              onPointerDown={(event) =>
                startNumberInputDrag(
                  event,
                  "settingsDayStart",
                  Number.parseInt(settingsDraft.dayStartHour, 10) || 0,
                )
              }
              onPointerMove={updateNumberInputDrag}
              onPointerUp={finishNumberInputDrag}
              title="上下にドラッグして時刻を調整"
            >
              <span>日付切替時刻</span>
              <span className="numberDragInput">
                <input
                  className="textInput"
                  max={23}
                  min={0}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, dayStartHour: event.target.value })
                  }
                  type="number"
                  value={settingsDraft.dayStartHour}
                />
                <span aria-hidden="true" className="numberDragUnit">
                  時
                </span>
                <span aria-hidden="true" className="numberDragAffordance" />
              </span>
            </label>
          </div>
          <div className="settingsToggleGrid">
            <label className="settingsToggle">
              <input
                checked={settingsDraft.alwaysOnTop}
                onChange={(event) =>
                  setSettingsDraft({ ...settingsDraft, alwaysOnTop: event.target.checked })
                }
                type="checkbox"
              />
              <span>常に手前</span>
            </label>
            <label className="settingsToggle">
              <input
                checked={settingsDraft.autoStart}
                onChange={(event) =>
                  setSettingsDraft({ ...settingsDraft, autoStart: event.target.checked })
                }
                type="checkbox"
              />
              <span>Windows自動起動</span>
              {testProfile?.testProfile && (
                <small className="settingsNote">
                  テスト用の起動では、自動起動に登録しません（設定の値だけ保存します）
                </small>
              )}
            </label>
            <label className="settingsToggle">
              <input
                checked={settingsDraft.miniMode}
                onChange={(event) =>
                  setSettingsDraft({ ...settingsDraft, miniMode: event.target.checked })
                }
                type="checkbox"
              />
              <span>ミニタイマーを使う</span>
            </label>
            <label className="settingsToggle settingsToggle--wide">
              <input
                checked={settingsDraft.restartShortFirst}
                onChange={(event) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    restartShortFirst: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>長く空いたプロジェクトでは短時間開始を優先表示する</span>
            </label>
          </div>
          <section className="settingsDisplay" aria-labelledby="settings-display-title">
            <h4 id="settings-display-title">表示</h4>
            <fieldset className="settingsDisplayFieldset">
              <legend>メイン表示サイズ</legend>
              <div className="settingsDisplayChoices">
                {(["standard", "large", "xlarge"] as const).map((size) => (
                  <label key={size}>
                    <input
                      checked={settingsDraft.mainDisplaySize === size}
                      name="main-display-size"
                      onChange={() =>
                        setSettingsDraft({ ...settingsDraft, mainDisplaySize: size })
                      }
                      type="radio"
                      value={size}
                    />
                    <span>
                      {size === "standard" ? "標準" : size === "large" ? "大" : "特大"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p>メイン画面の文字・カード・操作部の大きさを変更します。</p>
          </section>
          <section
            className="settingsWeeklyFocus"
            aria-labelledby="settings-weekly-focus-title"
          >
            <div className="settingsWeeklyFocusHeading">
              <div>
                <h4 id="settings-weekly-focus-title">今週の重点</h4>
                <p>今やる一手で優先するプロジェクトを最大3件選びます。</p>
              </div>
              <span>
                {settingsDraft.weeklyFocusProjectIds.length}/{WEEKLY_FOCUS_LIMIT}
              </span>
            </div>
            {config.projects.length > 0 ? (
              <div className="weeklyFocusChecklist settingsWeeklyFocusChecklist">
                {config.projects.map((project) => {
                  const checked = settingsDraft.weeklyFocusProjectIds.includes(project.id);
                  return (
                    <label key={project.id}>
                      <input
                        aria-label={`${project.name}を今週の重点にする`}
                        checked={checked}
                        disabled={
                          !checked &&
                          settingsDraft.weeklyFocusProjectIds.length >= WEEKLY_FOCUS_LIMIT
                        }
                        onChange={(event) => {
                          const nextIds = event.target.checked
                            ? [...settingsDraft.weeklyFocusProjectIds, project.id]
                            : settingsDraft.weeklyFocusProjectIds.filter(
                                (projectId) => projectId !== project.id,
                              );
                          setSettingsDraft({
                            ...settingsDraft,
                            weeklyFocusProjectIds: nextIds,
                          });
                        }}
                        type="checkbox"
                      />
                      <ProjectIdentity
                        colorId={project.colorId}
                        compact
                        name={project.name}
                        projectId={project.id}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="quietText">プロジェクトを追加すると選択できます。</p>
            )}
          </section>
        </div>

        <div
          className={
            settingsSection === "shortcuts"
              ? "settingsSection app-scrollbar"
              : "settingsSection settingsSection--hidden app-scrollbar"
          }
        >
          <h3>ショートカット</h3>
          {shortcutConflicts.map((conflict) => (
            <p className="shortcutConflictWarning" key={conflict.chord} role="alert">
              {conflict.chord} は {conflict.bindings.map(({ label }) => `「${label}」`).join("・")}
              に設定されています。いずれかを変更してください。
            </p>
          ))}
          <div className="settingsGrid">
            {SHORTCUT_DRAFT_FIELDS.map(({ field, label }) => {
              const value = settingsDraft[field];
              const recording = shortcutRecordingField === field;
              const conflict = shortcutConflicts.find((item) =>
                item.bindings.some((binding) => binding.field === field),
              );
              const others = conflict?.bindings
                .filter((binding) => binding.field !== field)
                .map((binding) => binding.label) ?? [];
              return (
                <div
                  className={
                    conflict
                      ? "fieldStack shortcutCaptureField shortcutCaptureField--conflict"
                      : "fieldStack shortcutCaptureField"
                  }
                  key={field}
                >
                  <span>{label}</span>
                  <div
                    className={
                      recording
                        ? "shortcutCaptureControl shortcutCaptureControl--recording"
                        : "shortcutCaptureControl"
                    }
                  >
                    <div aria-live="polite" className="shortcutCaptureValue">
                      <kbd>{recording ? "入力待ち…" : value || "未設定"}</kbd>
                    </div>
                    <button
                      aria-invalid={Boolean(conflict)}
                      aria-pressed={recording}
                      className="secondaryButton shortcutCaptureButton"
                      onClick={() => void beginShortcutRecording(field)}
                      type="button"
                    >
                      {recording ? "待機中" : "登録"}
                    </button>
                    <button
                      aria-label={`${label}のショートカットを解除`}
                      className="shortcutCaptureClear"
                      disabled={!value || recording}
                      onClick={() => setSettingsDraft({ ...settingsDraft, [field]: "" })}
                      title="ショートカットを解除"
                      type="button"
                    >
                      <UiIcon name="close" size={16} />
                    </button>
                  </div>
                  {(recording || value.trim()) && (
                    <small className="quietText quietText--small">
                      {recording
                        ? "キーの組み合わせを押してください。Escapeで取消"
                        : shortcutValidationMessage(value, others)}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={
            settingsSection === "instructions"
              ? "settingsSection app-scrollbar"
              : "settingsSection settingsSection--hidden app-scrollbar"
          }
        >
          <h3>手順書</h3>
          <div className="fieldStack">
            <span>手順書フォルダ（最大5件）</span>
            {settingsDraft.instructionFolders.length > 0 ? (
              <div className="instructionFolderSettingsList">
                {settingsDraft.instructionFolders.map((folder) => (
                  <div className="instructionFolderSettingsRow" key={folder}>
                    <span title={folder}>{folder}</span>
                    <button
                      className="dangerButton settingsButton--danger"
                      disabled={instructionSettingsBusy}
                      onClick={() => removeInstructionFolder(folder)}
                      type="button"
                    >
                      解除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="quietText quietText--small">
                MarkdownまたはTextファイルを置くローカルフォルダを登録してください。
              </p>
            )}
            <button
              className="secondaryButton settingsButton--neutral instructionFolderAddButton"
              disabled={instructionSettingsBusy || settingsDraft.instructionFolders.length >= 5}
              onClick={() => void addInstructionFolder()}
              type="button"
            >
              ＋ フォルダを追加
            </button>
          </div>
        </div>

        <div
          className={
            settingsSection === "backup"
              ? "settingsSection app-scrollbar"
              : "settingsSection settingsSection--hidden app-scrollbar"
          }
        >
          <h3>バックアップ</h3>
          <label className="fieldStack">
            <span>保存先フォルダ</span>
            <div className="folderPickerRow">
              <input
                className="textInput"
                placeholder="未設定"
                readOnly
                value={settingsDraft.backupFolder}
              />
              <button
                className="secondaryButton settingsButton--neutral"
                onClick={chooseBackupFolder}
                type="button"
              >
                選択
              </button>
            </div>
          </label>
          {!settingsDraft.backupFolder && (
            <p className="quietText quietText--small">
              バックアップは未設定です。データ保護のため保存先の設定を推奨します。
            </p>
          )}
          <label className="fieldStack">
            <span>保持世代数</span>
            <input
              className="textInput"
              min={1}
              onChange={(event) =>
                setSettingsDraft({ ...settingsDraft, backupKeep: event.target.value })
              }
              type="number"
              value={settingsDraft.backupKeep}
            />
          </label>
          <div className="settingsButtonRow">
            <button
              className="dangerButton settingsButton--danger"
              onClick={requestClearBackupFolder}
              type="button"
            >
              バックアップを未設定にする
            </button>
            <button
              className="dangerButton settingsButton--danger"
              onClick={chooseBackupZipForRestore}
              type="button"
            >
              バックアップから復元
            </button>
          </div>
        </div>

        <div
          className={
            settingsSection === "maintenance"
              ? "settingsSection app-scrollbar"
              : "settingsSection settingsSection--hidden app-scrollbar"
          }
        >
          <h3>メンテナンス</h3>
          <p className="quietText quietText--small">
            このタブの操作は押すとすぐ実行されます。保存は不要です。
          </p>
          <div className="maintenanceGroups">
            <section aria-labelledby="maintenance-data-heading" className="maintenanceGroup">
              <h4 id="maintenance-data-heading">データ・フォルダ</h4>
              <div className="settingsButtonRow">
                <button
                  className="secondaryButton settingsButton--neutral"
                  disabled={dailyActivityCopying}
                  onClick={() => void copyTodayActivityLog()}
                  title="今日のセッションとできたことをクリップボードへコピー"
                  type="button"
                >
                  {dailyActivityCopying ? "コピー中" : "今日の活動ログをコピー"}
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={openRuntimeDataFolder}
                  type="button"
                >
                  configフォルダを開く
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={openBackupFolder}
                  type="button"
                >
                  バックアップフォルダを開く
                </button>
              </div>
            </section>

            <section aria-labelledby="maintenance-display-heading" className="maintenanceGroup">
              <h4 id="maintenance-display-heading">表示・キャッシュ</h4>
              <div className="settingsButtonRow">
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={requestIconCacheRegeneration}
                  type="button"
                >
                  アイコンキャッシュ再生成
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={requestMiniWindowPositionReset}
                  type="button"
                >
                  ミニウィンドウ位置をリセット
                </button>
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={requestInstructionWindowPositionReset}
                  type="button"
                >
                  手順書ウィンドウ位置をリセット
                </button>
              </div>
            </section>

            <section
              aria-labelledby="maintenance-instructions-heading"
              className="maintenanceGroup"
            >
              <h4 id="maintenance-instructions-heading">手順書</h4>
              <div className="settingsButtonRow">
                <button
                  className="secondaryButton settingsButton--neutral"
                  onClick={() => void reloadInstructionList()}
                  type="button"
                >
                  手順書一覧を再読み込み
                </button>
              </div>
            </section>

            <section
              aria-labelledby="maintenance-reset-heading"
              className="maintenanceGroup maintenanceGroup--reset"
            >
              <h4 id="maintenance-reset-heading">初期化</h4>
              <p>Life Launcherを初回起動時の状態へ戻します。</p>
              <button
                className="dangerButton settingsButton--danger softwareResetButton"
                disabled={softwareResetStage !== "idle"}
                onClick={requestSoftwareReset}
                type="button"
              >
                ソフトウェアリセット...
              </button>
            </section>
          </div>
          <p className="quietText quietText--small settingsVersion">
            バージョン {APP_VERSION}
            <button
              className="settingsReleaseLink"
              onClick={() => {
                void executeActions([
                  {
                    type: "open_url",
                    payload: { url: "https://github.com/Takuyakou/life-launcher/releases" },
                  },
                ])
                  .then((results) => {
                    if (!results[0]?.ok) {
                      showToast("error", "リリースページを開けませんでした");
                    }
                  })
                  .catch(() => {
                    showToast("error", "リリースページを開けませんでした");
                  });
              }}
              title="https://github.com/Takuyakou/life-launcher/releases"
              type="button"
            >
              リリースページを開く
              <UiIcon name="external" size={12} />
            </button>
          </p>
        </div>

        <div className="dialogActions settingsDialogActions">
          <button
            className="secondaryButton settingsSaveButton"
            disabled={Boolean(shortcutRecordingField)}
            onClick={saveSettingsCenter}
            type="button"
          >
            保存
          </button>
          <button
            className="dangerButton settingsCancelButton"
            onClick={requestCloseSettings}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
