import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence } from "motion/react";
import type { AppConfig, LauncherButton, OverlayPage } from "../types";
import type {
  InstructionChoice,
  LegacyNextStepChoice,
  NextStepDecisionMode,
  NextStepEditDraft,
  NumberInputDragField,
} from "../app/dashboardTypes";
import { EXECUTION_TRIGGER_MAX_CHARS } from "../constants";
import { InstructionPicker } from "../InstructionPicker";
import { StartEnvironmentPicker } from "../StartEnvironmentPicker";
import { unfinishedTodayUsesSource } from "../sourceEdit";
import { ProjectIdentity } from "./ProjectIdentity";
import { SlidingFace } from "./SlidingFace";
import { TimerMinutesStepper } from "./TimerMinutesStepper";
import { UiIcon } from "./UiIcon";
import { ExitPresence, type ExitPresenceAttributes } from "./ExitPresence";

// V163-A4: the Next Step edit dialog (and the Project edit dialog it opens from inside),
// moved out of App.tsx unchanged.

export type NextStepEditDialogProps = {
  config: AppConfig;
  nextStepEditDraft: NextStepEditDraft;
  buttonsById: Map<string, LauncherButton>;
  instructionChoices: InstructionChoice[];
  instructionChoicesError: string | null;
  instructionChoicesLoading: boolean;
  missingButtonIds: Set<string>;
  missingInstructionProjectIds: Set<string>;
  nextStepOpenMenuOpen: boolean;
  nextStepOpenPicker: "buttons" | "instructions" | null;
  numberInputDragging: NumberInputDragField | null;
  overlayPages: OverlayPage[];
  projectNextStepSuggestions: string[];
  projectSelectableButtons: LauncherButton[];
  sourceEditSaving: boolean;
  setNextStepEditDraft: Dispatch<SetStateAction<NextStepEditDraft | null>>;
  setNextStepOpenMenuOpen: Dispatch<SetStateAction<boolean>>;
  setNextStepOpenPicker: Dispatch<SetStateAction<"buttons" | "instructions" | null>>;
  renderButtonIcon: (button: LauncherButton, className: string) => React.ReactNode;
  cancelNumberInputDrag: (event: React.PointerEvent<HTMLElement>) => void;
  finishNumberInputDrag: (event: React.PointerEvent<HTMLElement>) => void;
  updateNumberInputDrag: (event: React.PointerEvent<HTMLElement>) => void;
  startNumberInputDrag: (
    event: React.PointerEvent<HTMLElement>,
    field: NumberInputDragField,
    value: number,
  ) => void;
  chooseLegacyNextStepSettings: (choice: Exclude<LegacyNextStepChoice, null>) => void;
  closeNextStepEditDialog: (afterSuccessfulSave?: boolean) => void;
  refreshInstructionChoices: () => void;
  saveNextStepEdit: () => void;
  selectNextStepDecisionMode: (decisionMode: NextStepDecisionMode) => void;
  selectNextStepProject: (projectId: string) => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

export function NextStepEditDialog(props: NextStepEditDialogProps) {
  const {
    buttonsById,
    cancelNumberInputDrag,
    chooseLegacyNextStepSettings,
    closeNextStepEditDialog,
    config,
    finishNumberInputDrag,
    instructionChoices,
    instructionChoicesError,
    instructionChoicesLoading,
    missingButtonIds,
    missingInstructionProjectIds,
    nextStepEditDraft,
    nextStepOpenMenuOpen,
    nextStepOpenPicker,
    numberInputDragging,
    overlayPages,
    projectNextStepSuggestions,
    projectSelectableButtons,
    refreshInstructionChoices,
    renderButtonIcon,
    saveNextStepEdit,
    selectNextStepDecisionMode,
    selectNextStepProject,
    setNextStepEditDraft,
    setNextStepOpenMenuOpen,
    setNextStepOpenPicker,
    sourceEditSaving,
    startNumberInputDrag,
    updateNumberInputDrag,
    exitProps,
  } = props;

  return (
    (() => {
      const nextStepProject = config.projects.find(
        (project) => project.id === nextStepEditDraft.projectId,
      );
      const nextStepInstructionLabel = nextStepEditDraft.instructionPath
        ? (instructionChoices.find(
            (choice) => choice.path === nextStepEditDraft.instructionPath,
          )?.label ?? "現在の設定")
        : "";
      const wishlistMode = nextStepEditDraft.decisionMode === "wishlist";
      const wishlistCandidates = nextStepProject
        ? config.inbox.filter(
            (item) => Boolean(item.id) && item.projectId === nextStepProject.id,
          )
        : [];
      const selectedWishlist = nextStepEditDraft.promotedWishlistId
        ? wishlistCandidates.find((item) => item.id === nextStepEditDraft.promotedWishlistId)
        : undefined;
      const selectedWishlistLocked = Boolean(
        selectedWishlist &&
        unfinishedTodayUsesSource(config, `wishlist:${selectedWishlist.id}`),
      );
      const currentNextStepLocked = Boolean(
        wishlistMode &&
        selectedWishlist &&
        nextStepProject?.nextStep &&
        unfinishedTodayUsesSource(
          config,
          `project:${nextStepProject.id}`,
          nextStepProject.nextStep.generationId,
        ),
      );
      const legacyChoiceRequired = Boolean(
        !wishlistMode &&
        nextStepProject?.legacyNextStepSettings &&
        !nextStepProject.nextStep &&
        nextStepEditDraft.legacyChoice === null,
      );
      const replacingExisting = Boolean(
        wishlistMode && selectedWishlist && nextStepProject?.nextStep?.text.trim(),
      );
      const swappingExisting = Boolean(
        nextStepEditDraft.mode === "promote" && nextStepProject?.nextStep?.text.trim(),
      );
      const editingExisting = !wishlistMode && nextStepEditDraft.mode === "edit";
      const dialogTitle = editingExisting
        ? "次の一手を編集"
        : replacingExisting || swappingExisting
          ? "次の一手を入れ替える"
          : "次の一手を設定";
      const saveDisabled =
        sourceEditSaving ||
        !nextStepEditDraft.projectId ||
        (wishlistMode
          ? !selectedWishlist || selectedWishlistLocked || currentNextStepLocked
          : !nextStepEditDraft.text.trim()) ||
        (replacingExisting && nextStepEditDraft.replacementChoice !== "return") ||
        legacyChoiceRequired;

      const timerFieldDefs = [
        ["shortTimerMinutes", "projectShort", "短時間", config.settings.shortTimerMinutes],
        ["defaultTimerMinutes", "projectDefault", "通常", config.settings.defaultTimerMinutes],
      ] as const;

      const renderTimerStepper = (
        field: "shortTimerMinutes" | "defaultTimerMinutes",
        dragField: "projectShort" | "projectDefault",
        label: string,
        fallback: number,
      ) => (
        <TimerMinutesStepper
          dragging={numberInputDragging === dragField}
          fallback={fallback}
          label={label}
          onDragCancel={cancelNumberInputDrag}
          onDragEnd={finishNumberInputDrag}
          onDragMove={updateNumberInputDrag}
          onDragStart={(event, value) => startNumberInputDrag(event, dragField, value)}
          onValueChange={(value) =>
            setNextStepEditDraft({ ...nextStepEditDraft, [field]: value })
          }
          value={nextStepEditDraft[field]}
        />
      );

      const renderTimerGrid = (compact: boolean) => (
        <div className={compact ? "nextStepEditTimerGrid" : "projectTimerGrid"}>
          {timerFieldDefs.map(([field, dragField, label, fallback]) => (
            <div className="projectTimerSetting" key={field}>
              <span className="projectTimerSettingLabel">
                <span aria-hidden="true" className="projectTimerDot" />
                {label}
              </span>
              {renderTimerStepper(field, dragField, label, fallback)}
              {compact ? null : (
                <div className="projectTimerFooter">
                  <span>
                    {nextStepEditDraft[field]
                      ? `${nextStepEditDraft[field]}分を使用`
                      : `全体設定 ${fallback}分を使用`}
                  </span>
                  <button
                    disabled={!nextStepEditDraft[field]}
                    onClick={() =>
                      setNextStepEditDraft({ ...nextStepEditDraft, [field]: "" })
                    }
                    type="button"
                  >
                    全体設定に戻す
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );

      const renderActionField = (compact: boolean) => {
        const suggestions =
          !compact && projectNextStepSuggestions.length > 0 ? (
            <div aria-label="次の一手候補" className="suggestionRow">
              {projectNextStepSuggestions.map((suggestion) => (
                <button
                  className="suggestionChip"
                  key={suggestion}
                  onClick={() =>
                    setNextStepEditDraft({
                      ...nextStepEditDraft,
                      text: suggestion,
                    })
                  }
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null;
        return (
          <label className={compact ? "fieldStack nextStepEditField" : "fieldStack"}>
            <span>行動</span>
            <input autoComplete="off"
              aria-label="行動"
              autoFocus={compact || nextStepEditDraft.projectLocked}
              className={compact ? "textInput nextStepEditActionInput" : "textInput"}
              maxLength={120}
              onChange={(event) =>
                setNextStepEditDraft({
                  ...nextStepEditDraft,
                  text: event.target.value,
                })
              }
              placeholder="次に着手する具体的な一手"
              value={nextStepEditDraft.text}
            />
            {compact ? (
              <small className="nextStepEditHint">
                始めにくいときは、最初の2分でやることだけを書きます。例: 「運動着に着替える」
              </small>
            ) : (
              suggestions
            )}
          </label>
        );
      };

      const renderTriggerField = (compact: boolean) => (
        <label className={compact ? "fieldStack nextStepEditField" : "fieldStack"}>
          <span>{compact ? "きっかけ（いつ・どこで）" : "始めるきっかけ（任意）"}</span>
          <input autoComplete="off"
            aria-label="始めるきっかけ（任意）"
            className="textInput"
            maxLength={EXECUTION_TRIGGER_MAX_CHARS}
            onChange={(event) =>
              setNextStepEditDraft({
                ...nextStepEditDraft,
                trigger: event.target.value,
              })
            }
            placeholder="例: 21時 / 夕食後 / PCを開いたら"
            value={nextStepEditDraft.trigger}
          />
        </label>
      );

      return (
        <div className="modalBackdrop" role="presentation" {...exitProps}>
          <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
          <section
            aria-label={dialogTitle}
            aria-modal="true"
            className={
              editingExisting
                ? "dropDialog editDialog modalLongForm nextStepEditDialog nextStepEditDialog--edit app-scrollbar"
                : "dropDialog editDialog modalLongForm nextStepEditDialog app-scrollbar"
            }
            role="dialog"
            tabIndex={-1}
          >
            <div className="modalTitleRow">
              <div>
                <p className="eyebrow">{editingExisting ? "Next step" : "Next Step"}</p>
                <h2>{editingExisting ? "一手を編集" : dialogTitle}</h2>
                {editingExisting ? null : (
                  <p className="dialogLead">今進める1件と、始めるための環境を設定します。</p>
                )}
              </div>
              <div className="nextStepEditHeaderRight">
                {editingExisting && nextStepProject ? (
                  <span className="nextStepEditProjectChip">
                    <ProjectIdentity
                      colorId={nextStepProject.colorId}
                      name={nextStepProject.name}
                      projectId={nextStepProject.id}
                    />
                  </span>
                ) : null}
                <button
                  aria-label={`${dialogTitle}を閉じる`}
                  className="iconButton"
                  disabled={sourceEditSaving}
                  onClick={() => closeNextStepEditDialog()}
                  title="閉じる"
                  type="button"
                >
                  <UiIcon name="close" size={16} />
                </button>
              </div>
            </div>

            {editingExisting ? (
              <>
                {renderActionField(true)}
                {renderTriggerField(true)}
                <label className="fieldStack nextStepEditField">
                  <span>次はここから(任意)</span>
                  <input autoComplete="off"
                    aria-label="次はここから(任意)"
                    className="textInput"
                    maxLength={80}
                    onChange={(event) =>
                      setNextStepEditDraft({
                        ...nextStepEditDraft,
                        resumeNote: event.target.value,
                      })
                    }
                    placeholder="例: 3章の途中から"
                    value={nextStepEditDraft.resumeNote}
                  />
                </label>
                {renderTimerGrid(true)}
              </>
            ) : null}

            {editingExisting ? null : (
              <>
                <h3 className="formSectionHeading">プロジェクト</h3>
            {nextStepEditDraft.projectLocked && nextStepProject ? (
              <div className="nextStepFixedProject">
                <ProjectIdentity
                  colorId={nextStepProject.colorId}
                  name={nextStepProject.name}
                  projectId={nextStepProject.id}
                />
                <span>このプロジェクトに設定します</span>
              </div>
            ) : (
              <label className="fieldStack">
                <span>プロジェクト</span>
                <select
                  autoFocus
                  className="textInput"
                  onChange={(event) => selectNextStepProject(event.target.value)}
                  value={nextStepEditDraft.projectId}
                >
                  <option value="">選択してください</option>
                  {config.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <section className="nextStepDecisionBlock">
              <h3>次の一手の決め方</h3>
              <p>同じプロジェクトのやりたいことから選ぶか、新しい行動を入力します。</p>
              <div
                aria-label="次の一手の決め方"
                className="nextStepDecisionModes"
                role="tablist"
              >
                <button
                  aria-selected={wishlistMode}
                  className={
                    wishlistMode
                      ? "nextStepDecisionModeButton nextStepDecisionModeButton--active nextStepDecisionModeButton--wishlistActive mainActionButton mainActionButton--gold"
                      : "nextStepDecisionModeButton mainActionButton mainActionButton--neutral"
                  }
                  disabled={sourceEditSaving}
                  onClick={() => selectNextStepDecisionMode("wishlist")}
                  role="tab"
                  type="button"
                >
                  {wishlistMode && (
                    <SlidingFace className="nextStepModeFace" layoutId="nextstep-mode-face" />
                  )}
                  <span className="nextStepModeLabel">＋ やりたいことから選ぶ</span>
                </button>
                <button
                  aria-selected={!wishlistMode}
                  className={
                    !wishlistMode
                      ? "nextStepDecisionModeButton nextStepDecisionModeButton--active mainActionButton mainActionButton--positive"
                      : "nextStepDecisionModeButton mainActionButton mainActionButton--neutral"
                  }
                  disabled={sourceEditSaving}
                  onClick={() => selectNextStepDecisionMode("new")}
                  role="tab"
                  type="button"
                >
                  {!wishlistMode && (
                    <SlidingFace className="nextStepModeFace" layoutId="nextstep-mode-face" />
                  )}
                  <span className="nextStepModeLabel">＋ 新しく入力</span>
                </button>
              </div>

              <div className="nextStepDecisionPanel" role="tabpanel">
                {wishlistMode ? (
                  <>
                    <div className="nextStepWishlistPickerHeading">
                      <strong>やりたいこと</strong>
                      <span>{wishlistCandidates.length}件</span>
                    </div>
                    {wishlistCandidates.length ? (
                      <div
                        aria-label="次の一手を設定するやりたいこと"
                        className="nextStepWishlistPickerList"
                        role="radiogroup"
                      >
                        {wishlistCandidates.map((item) => {
                          const locked = unfinishedTodayUsesSource(
                            config,
                            `wishlist:${item.id}`,
                          );
                          return (
                            <button
                              aria-checked={item.id === selectedWishlist?.id}
                              className="nextStepWishlistCandidate"
                              disabled={sourceEditSaving || locked}
                              key={item.id}
                              title={
                                locked
                                  ? "未完了の今日の3件に入っているため、完了または外すまで次の一手にできません"
                                  : undefined
                              }
                              onClick={() =>
                                setNextStepEditDraft({
                                  ...nextStepEditDraft,
                                  mode: "promote",
                                  promotedWishlistId: item.id,
                                  replacementChoice: null,
                                  replacedNextStep: nextStepProject?.nextStep,
                                })
                              }
                              role="radio"
                              type="button"
                            >
                              <span aria-hidden="true" className="nextStepWishlistRadio" />
                              <span className="nextStepWishlistCandidateText">{item.text}</span>
                              {locked ? (
                                <span className="nextStepWishlistLock">今日の3件で未完了</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="nextStepWishlistEmpty">
                        このプロジェクトのやりたいことはありません
                      </p>
                    )}

                    {selectedWishlist ? (
                      <div className="nextStepWishlistSelection">
                        <span aria-hidden="true">✓</span>
                        <span className="nextStepWishlistSelectionCopy">
                          <small>選択済み</small>
                          <strong>{selectedWishlist.text}</strong>
                        </span>
                        <button
                          className="secondaryButton"
                          disabled={sourceEditSaving}
                          onClick={() =>
                            setNextStepEditDraft({
                              ...nextStepEditDraft,
                              promotedWishlistId: undefined,
                            })
                          }
                          type="button"
                        >
                          選び直す
                        </button>
                      </div>
                    ) : (
                      <span className="nextStepDecisionHint">1件選択してください。</span>
                    )}

                    {replacingExisting ? (
                      <div className="nextStepSwapSummary">
                        <strong>現在の次の一手</strong>
                        <span>
                          「{nextStepProject?.nextStep?.text}
                          」は、保存するとやりたいことへ戻ります。
                        </span>
                        <button
                          aria-pressed={nextStepEditDraft.replacementChoice === "return"}
                          className="secondaryButton"
                          disabled={sourceEditSaving}
                          onClick={() =>
                            setNextStepEditDraft({
                              ...nextStepEditDraft,
                              replacementChoice: "return",
                            })
                          }
                          type="button"
                        >
                          やりたいことへ戻す
                        </button>
                        {currentNextStepLocked ? (
                          <span>今日の3件で未完了のため、今は入れ替えできません。</span>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {nextStepProject?.legacyNextStepSettings && !nextStepProject.nextStep ? (
                      <fieldset className="legacyNextStepChoice">
                        <legend>以前の実行設定</legend>
                        <p>
                          移行前の開始環境などが残っています。今回だけ扱いを選んでください。
                        </p>
                        <div>
                          <button
                            aria-pressed={nextStepEditDraft.legacyChoice === "inherit"}
                            className={
                              nextStepEditDraft.legacyChoice === "inherit"
                                ? "secondaryButton legacyNextStepChoice--selected"
                                : "secondaryButton"
                            }
                            onClick={() => chooseLegacyNextStepSettings("inherit")}
                            type="button"
                          >
                            引き継ぐ
                          </button>
                          <button
                            aria-pressed={nextStepEditDraft.legacyChoice === "discard"}
                            className={
                              nextStepEditDraft.legacyChoice === "discard"
                                ? "secondaryButton legacyNextStepChoice--selected"
                                : "secondaryButton"
                            }
                            onClick={() => chooseLegacyNextStepSettings("discard")}
                            type="button"
                          >
                            破棄して全体設定を使う
                          </button>
                        </div>
                      </fieldset>
                    ) : null}
                    {renderActionField(false)}
                  </>
                )}
              </div>
            </section>
              </>
            )}

            {editingExisting ? null : renderTriggerField(false)}

            {editingExisting ? null : (
              <>
                <h3 className="formSectionHeading">タイマー</h3>
                {renderTimerGrid(false)}
              </>
            )}

            <section className="nextStepOpenTogether">
              {editingExisting ? (
                <span className="nextStepEditSectionLabel">始めると一緒に開く</span>
              ) : (
                <h3 className="formSectionHeading">始めると一緒に開く</h3>
              )}
              <div className="nextStepOpenChips">
                {nextStepEditDraft.buttonIds.map((buttonId) => {
                  const button = buttonsById.get(buttonId);
                  const label = button?.label ?? "登録が見つかりません";
                  const buttonMissing = Boolean(button && missingButtonIds.has(button.id));
                  return (
                    <span
                      className={
                        buttonMissing
                          ? "nextStepOpenChip nextStepOpenChip--missing"
                          : "nextStepOpenChip"
                      }
                      key={`button:${buttonId}`}
                    >
                      {button ? (
                        renderButtonIcon(button, "nextStepOpenChipIcon")
                      ) : (
                        <span aria-hidden="true" className="nextStepOpenChipIcon">
                          ?
                        </span>
                      )}
                      <span className="nextStepOpenChipLabel" title={label}>
                        {label}
                      </span>
                      {buttonMissing && (
                        <span className="uiPill nextStepOpenChipMissing">見つかりません</span>
                      )}
                      <button
                        aria-label={`${label}を外す`}
                        className="nextStepOpenChipRemove"
                        onClick={() =>
                          setNextStepEditDraft({
                            ...nextStepEditDraft,
                            buttonIds: nextStepEditDraft.buttonIds.filter(
                              (candidate) => candidate !== buttonId,
                            ),
                          })
                        }
                        type="button"
                      >
                        <UiIcon name="close" size={12} />
                      </button>
                    </span>
                  );
                })}
                {nextStepEditDraft.instructionPath ? (
                  (() => {
                    const instructionMissing = Boolean(
                      editingExisting &&
                        nextStepProject &&
                        missingInstructionProjectIds.has(nextStepProject.id) &&
                        nextStepEditDraft.instructionPath ===
                          (nextStepProject.nextStep?.instructionPath ?? ""),
                    );
                    return (
                      <span
                        className={
                          instructionMissing
                            ? "nextStepOpenChip nextStepOpenChip--missing"
                            : "nextStepOpenChip"
                        }
                      >
                        <UiIcon name="fileText" size={16} />
                        <span className="nextStepOpenChipLabel" title={nextStepInstructionLabel}>
                          {nextStepInstructionLabel}
                        </span>
                        {instructionMissing && (
                          <span className="uiPill nextStepOpenChipMissing">見つかりません</span>
                        )}
                        <button
                          aria-label={`${nextStepInstructionLabel}を外す`}
                          className="nextStepOpenChipRemove"
                          onClick={() =>
                            setNextStepEditDraft({
                              ...nextStepEditDraft,
                              instructionPath: "",
                              instructionOpenOnStart: false,
                            })
                          }
                          type="button"
                        >
                          <UiIcon name="close" size={12} />
                        </button>
                      </span>
                    );
                  })()
                ) : null}
                <button
                  aria-expanded={nextStepOpenMenuOpen}
                  className="nextStepOpenChipAdd"
                  onClick={() => setNextStepOpenMenuOpen((current) => !current)}
                  type="button"
                >
                  ＋ ボタン・手順書を足す
                </button>
              </div>
              <AnimatePresence initial={false}>
                {nextStepOpenMenuOpen && (
                  <ExitPresence key="next-step-open-menu">
                    {(exiting, exitProps) => (
                      <div
                        aria-label="足す物"
                        className="nextStepOpenMenu"
                        role="menu"
                        {...exitProps}
                      >
                        <button
                          onClick={() => {
                            setNextStepOpenMenuOpen(false);
                            setNextStepOpenPicker("buttons");
                          }}
                          role="menuitem"
                          type="button"
                        >
                          ボタンを選ぶ
                        </button>
                        <button
                          onClick={() => {
                            setNextStepOpenMenuOpen(false);
                            setNextStepOpenPicker("instructions");
                          }}
                          role="menuitem"
                          type="button"
                        >
                          手順書を選ぶ
                        </button>
                      </div>
                    )}
                  </ExitPresence>
                )}
              </AnimatePresence>
              <label className="projectWeeklyFocusToggle projectInstructionStartToggle">
                <input
                  checked={nextStepEditDraft.instructionOpenOnStart}
                  disabled={!nextStepEditDraft.instructionPath}
                  onChange={(event) =>
                    setNextStepEditDraft({
                      ...nextStepEditDraft,
                      instructionOpenOnStart: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>開始時に手順書を開く</span>
              </label>
              <StartEnvironmentPicker
                buttons={projectSelectableButtons}
                chrome="chips"
                onChange={(buttonIds) =>
                  setNextStepEditDraft({ ...nextStepEditDraft, buttonIds })
                }
                onOpenChange={(open) => {
                  setNextStepOpenPicker(open ? "buttons" : null);
                  if (!open) {
                    window.requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(".nextStepOpenChipAdd")
                        ?.focus(),
                    );
                  }
                }}
                open={nextStepOpenPicker === "buttons"}
                overlayPages={overlayPages}
                renderIcon={renderButtonIcon}
                selectedIds={nextStepEditDraft.buttonIds}
              />
              <InstructionPicker
                choices={instructionChoices}
                chrome="chips"
                error={instructionChoicesError}
                loading={instructionChoicesLoading}
                onChange={(instructionPath) =>
                  setNextStepEditDraft({
                    ...nextStepEditDraft,
                    instructionPath,
                    instructionOpenOnStart: instructionPath
                      ? nextStepEditDraft.instructionPath
                        ? nextStepEditDraft.instructionOpenOnStart
                        : true
                      : false,
                  })
                }
                onOpenChange={(open) => {
                  setNextStepOpenPicker(open ? "instructions" : null);
                  if (!open) {
                    window.requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(".nextStepOpenChipAdd")
                        ?.focus(),
                    );
                  }
                }}
                onRetry={() => void refreshInstructionChoices()}
                open={nextStepOpenPicker === "instructions"}
                selectedPath={nextStepEditDraft.instructionPath}
              />
            </section>

            <label className="projectWeeklyFocusToggle projectInstructionStartToggle">
              <input
                checked={nextStepEditDraft.expandTimerOnStart}
                onChange={(event) =>
                  setNextStepEditDraft({
                    ...nextStepEditDraft,
                    expandTimerOnStart: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span>開始時にタイマーを大きく表示</span>
            </label>

            <label
              className={
                editingExisting ? "fieldStack nextStepEditSmallField" : "fieldStack"
              }
            >
              <span>開始noteテンプレート（任意）</span>
              <input autoComplete="off"
                className="textInput"
                maxLength={120}
                onChange={(event) =>
                  setNextStepEditDraft({
                    ...nextStepEditDraft,
                    startNoteTemplate: event.target.value,
                  })
                }
                value={nextStepEditDraft.startNoteTemplate}
              />
            </label>

            <div className="dialogActions formDialogActions">
              <button
                className="primaryButton"
                disabled={saveDisabled}
                onClick={() => void saveNextStepEdit()}
                type="button"
              >
                {sourceEditSaving ? "保存中…" : "保存"}
              </button>
              <button
                className="secondaryButton dialogCancelButton"
                disabled={sourceEditSaving}
                onClick={() => closeNextStepEditDialog()}
                type="button"
              >
                キャンセル
              </button>
            </div>
          </section>
        </div>
      );
    })()
  );
}
