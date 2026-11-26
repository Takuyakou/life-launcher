/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnimatePresence } from "motion/react";
import { ConfirmDialog } from "./ConfirmDialog";
import { DropRegisterDialog } from "./DropRegisterDialog";
import { ExitPresence } from "./ExitPresence";
import { HelpGuideDialog } from "./HelpGuideDialog";
import { ImportDialog } from "./ImportDialog";
import { InboxEditDialog } from "./InboxEditDialog";
import { InboxAddDialog } from "./InboxAddDialog";
import { NextStepEditDialog } from "./NextStepEditDialog";
import { SettingsDialog } from "./SettingsDialog";
import { TodayPickerDialog } from "./TodayPickerDialog";
type Props = Record<string, any>;

// V165 (C5): the surfaces below keep the document order they had in App.tsx.
// ConfirmDialog closes on Escape only while it is the last aria-modal dialog in the DOM, so the
// confirm block stays after every dialog that can open it, and before the import surface.
export function DashboardModals(props: Props) {
  const {
    confirmDialog,
    onCancel,
    config,
    importDialogOpen,
    importInitialError,
    importInitialText,
    closeImportDialog,
    handleImported,
    showToast,
    inboxAddOpen,
    inboxDraft,
    inboxAddError,
    inboxAddProjectId,
    inboxAddSaving,
    closeInboxAddDialog,
    setInboxDraft,
    setInboxAddError,
    setInboxAddProjectId,
    addInboxItem,
    inboxEditingIndex,
    inboxEditDraft,
    inboxEditProjectId,
    inboxEditButtonIds,
    inboxEditInstructionPath,
    inboxEditInstructionOpenOnStart,
    instructionChoices,
    instructionChoicesError,
    instructionChoicesLoading,
    overlayPages,
    projectSelectableButtons,
    renderButtonIcon,
    setInboxEditDraft,
    setInboxEditProjectId,
    setInboxEditButtonIds,
    setInboxEditInstructionPath,
    setInboxEditInstructionOpenOnStart,
    refreshInstructionChoices,
    closeInboxEditDialog,
    commitInboxEdit,
    sourceEditSaving,
    buttonsById,
    closeNextStepEditDialog,
    missingButtonIds,
    missingInstructionProjectIds,
    nextStepEditDraft,
    nextStepOpenMenuOpen,
    nextStepOpenPicker,
    numberInputDragging,
    projectNextStepSuggestions,
    setNextStepEditDraft,
    setNextStepOpenMenuOpen,
    setNextStepOpenPicker,
    cancelNumberInputDrag,
    chooseLegacyNextStepSettings,
    finishNumberInputDrag,
    saveNextStepEdit,
    selectNextStepDecisionMode,
    selectNextStepProject,
    startNumberInputDrag,
    updateNumberInputDrag,
    todayPickerOpen,
    todayPickerDraftItems,
    todayPickerDragIndex,
    todayPickerFilter,
    todayPickerPills,
    todayPickerQuickProject,
    todayPickerQuickText,
    todayPickerSaving,
    todayPickerVisibleNextSteps,
    todayPickerVisibleWishlist,
    setTodayPickerFilter,
    setTodayPickerQuickText,
    addTodayPickerQuickWish,
    moveTodayPickerItemToIndex,
    requestCloseTodayPicker,
    saveTodayPickerDraft,
    activeTimer,
    chooseTodayCandidate,
    moveTodayPickerItem,
    projectsById,
    removeTodayPickerDraftItem,
    setTodayPickerDragIndex,
    todayPickerCandidateSelected,
    settingsDraft,
    settingsSection,
    dailyActivityCopying,
    instructionSettingsBusy,
    shortcutConflicts,
    shortcutRecordingField,
    softwareResetStage,
    testProfile,
    beginShortcutRecording,
    finishShortcutRecording,
    requestCloseSettings,
    saveSettingsCenter,
    setHelpGuideOpen,
    setSettingsDraft,
    setSettingsSection,
    addInstructionFolder,
    chooseBackupFolder,
    chooseBackupZipForRestore,
    copyTodayActivityLog,
    openBackupFolder,
    openRuntimeDataFolder,
    reloadInstructionList,
    removeInstructionFolder,
    requestClearBackupFolder,
    requestIconCacheRegeneration,
    requestInstructionWindowPositionReset,
    requestMiniWindowPositionReset,
    requestSoftwareReset,
    dropDraft,
    builderBusy,
    builderKind,
    builderSource,
    confirmDropRegistration,
    groupNames,
    pickBuilderSource,
    setBuilderKind,
    setBuilderLabelTouched,
    setBuilderModeDrafts,
    setDropDraft,
    switchBuilderKind,
    updateBuilderSource,
    helpGuideOpen,
    earlyStop,
    earlyStopSaving,
    resolveEarlyStop,
  } = props;
  return (
    <>
      <AnimatePresence initial={false}>
        {inboxEditingIndex !== null && config.inbox[inboxEditingIndex] && (
          <ExitPresence key="inbox-edit">
            {(exiting, exitProps) => (
              <InboxEditDialog
                exitProps={exitProps}
                config={config}
                inboxEditDraft={inboxEditDraft}
                inboxEditProjectId={inboxEditProjectId}
                inboxEditButtonIds={inboxEditButtonIds}
                inboxEditInstructionPath={inboxEditInstructionPath}
                inboxEditInstructionOpenOnStart={inboxEditInstructionOpenOnStart}
                instructionChoices={instructionChoices}
                instructionChoicesError={instructionChoicesError}
                instructionChoicesLoading={instructionChoicesLoading}
                overlayPages={overlayPages}
                projectSelectableButtons={projectSelectableButtons}
                renderButtonIcon={renderButtonIcon}
                setInboxEditDraft={setInboxEditDraft}
                setInboxEditProjectId={setInboxEditProjectId}
                setInboxEditButtonIds={setInboxEditButtonIds}
                setInboxEditInstructionPath={setInboxEditInstructionPath}
                setInboxEditInstructionOpenOnStart={setInboxEditInstructionOpenOnStart}
                refreshInstructionChoices={refreshInstructionChoices}
                closeInboxEditDialog={closeInboxEditDialog}
                commitInboxEdit={commitInboxEdit}
                sourceEditSaving={sourceEditSaving}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {todayPickerOpen && (
          <ExitPresence key="today-picker">
            {(exiting, exitProps) => (
              <TodayPickerDialog
                exitProps={exitProps}
                todayPickerDraftItems={todayPickerDraftItems}
                todayPickerDragIndex={todayPickerDragIndex}
                todayPickerFilter={todayPickerFilter}
                todayPickerPills={todayPickerPills}
                todayPickerQuickProject={todayPickerQuickProject}
                todayPickerQuickText={todayPickerQuickText}
                todayPickerSaving={todayPickerSaving}
                todayPickerVisibleNextSteps={todayPickerVisibleNextSteps}
                todayPickerVisibleWishlist={todayPickerVisibleWishlist}
                setTodayPickerFilter={setTodayPickerFilter}
                setTodayPickerQuickText={setTodayPickerQuickText}
                addTodayPickerQuickWish={addTodayPickerQuickWish}
                moveTodayPickerItemToIndex={moveTodayPickerItemToIndex}
                requestCloseTodayPicker={requestCloseTodayPicker}
                rows={{
                  activeTimer,
                  chooseTodayCandidate,
                  moveTodayPickerItem,
                  projectsById,
                  removeTodayPickerDraftItem,
                  setTodayPickerDragIndex,
                  todayPickerCandidateSelected,
                }}
                saveTodayPickerDraft={saveTodayPickerDraft}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {settingsDraft && (
          <ExitPresence key="settings">
            {(exiting, exitProps) => (
              <SettingsDialog
                exitProps={exitProps}
                config={config}
                data={{
                  dailyActivityCopying,
                  instructionSettingsBusy,
                  numberInputDragging,
                  settingsDraft,
                  settingsSection,
                  shortcutConflicts,
                  shortcutRecordingField,
                  softwareResetStage,
                  testProfile,
                }}
                actions={{
                  beginShortcutRecording,
                  cancelNumberInputDrag,
                  finishNumberInputDrag,
                  finishShortcutRecording,
                  requestCloseSettings,
                  saveSettingsCenter,
                  setHelpGuideOpen,
                  setSettingsDraft,
                  setSettingsSection,
                  showToast,
                  startNumberInputDrag,
                  updateNumberInputDrag,
                }}
                maintenance={{
                  addInstructionFolder,
                  chooseBackupFolder,
                  chooseBackupZipForRestore,
                  copyTodayActivityLog,
                  openBackupFolder,
                  openRuntimeDataFolder,
                  reloadInstructionList,
                  removeInstructionFolder,
                  requestClearBackupFolder,
                  requestIconCacheRegeneration,
                  requestInstructionWindowPositionReset,
                  requestMiniWindowPositionReset,
                  requestSoftwareReset,
                }}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {inboxAddOpen && (
          <ExitPresence key="inbox-add">
            {(exiting, exitProps) => (
              <InboxAddDialog
                exitProps={exitProps}
                draft={inboxDraft}
                error={inboxAddError}
                onClose={() => closeInboxAddDialog()}
                onDraftChange={(value) => {
                  setInboxDraft(value);
                  if (inboxAddError) setInboxAddError(null);
                }}
                onProjectIdChange={setInboxAddProjectId}
                onSubmit={() => void addInboxItem()}
                projectId={inboxAddProjectId}
                projects={config.projects}
                saving={inboxAddSaving}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {nextStepEditDraft && (
          <ExitPresence key="next-step-edit">
            {(exiting, exitProps) => (
              <NextStepEditDialog
                exitProps={exitProps}
                config={config}
                draft={{
                  nextStepEditDraft,
                  nextStepOpenMenuOpen,
                  nextStepOpenPicker,
                }}
                data={{
                  buttonsById,
                  instructionChoices,
                  instructionChoicesError,
                  instructionChoicesLoading,
                  missingButtonIds,
                  missingInstructionProjectIds,
                  numberInputDragging,
                  overlayPages,
                  projectNextStepSuggestions,
                  projectSelectableButtons,
                  sourceEditSaving,
                }}
                actions={{
                  cancelNumberInputDrag,
                  chooseLegacyNextStepSettings,
                  closeNextStepEditDialog,
                  finishNumberInputDrag,
                  refreshInstructionChoices,
                  renderButtonIcon,
                  saveNextStepEdit,
                  selectNextStepDecisionMode,
                  selectNextStepProject,
                  setNextStepEditDraft,
                  setNextStepOpenMenuOpen,
                  setNextStepOpenPicker,
                  startNumberInputDrag,
                  updateNumberInputDrag,
                }}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {dropDraft && (
          <ExitPresence key="drop-register">
            {(exiting, exitProps) => (
              <DropRegisterDialog
                exitProps={exitProps}
                builderBusy={builderBusy}
                builderKind={builderKind}
                builderSource={builderSource}
                confirmDropRegistration={confirmDropRegistration}
                dropDraft={dropDraft}
                groupNames={groupNames}
                overlayPages={overlayPages}
                pickBuilderSource={pickBuilderSource}
                setBuilderKind={setBuilderKind}
                setBuilderLabelTouched={setBuilderLabelTouched}
                setBuilderModeDrafts={setBuilderModeDrafts}
                setDropDraft={setDropDraft}
                switchBuilderKind={switchBuilderKind}
                updateBuilderSource={updateBuilderSource}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {confirmDialog && (
          <ExitPresence key="confirm-dialog">
            {(exiting, exitProps) => (
              <ConfirmDialog {...confirmDialog} onCancel={onCancel} exitProps={exitProps} open />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {helpGuideOpen && (
          <ExitPresence key="help">
            {(exiting, exitProps) => (
              <HelpGuideDialog
                exitProps={exitProps}
                onClose={() => setHelpGuideOpen(false)}
                onCopyResult={(ok) =>
                  showToast(
                    ok ? "ok" : "error",
                    ok
                      ? "コピーしました"
                      : "コピーできませんでした。テキストを選択してコピーしてください。",
                  )
                }
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {earlyStop && (
          <ExitPresence key="early-stop">
            {(exiting, exitProps) => (
              <ConfirmDialog
                exitProps={exitProps}
                open
                title="今日の分は完了にしますか？"
                message="ここまでの実行は記録されます。"
                confirmLabel="今日の分は完了"
                cancelLabel="未完了のまま終了"
                tone="positive"
                initialFocus="cancel"
                isProcessing={earlyStopSaving}
                onConfirm={() => resolveEarlyStop(true)}
                onCancel={() => {
                  void resolveEarlyStop(false);
                }}
              />
            )}
          </ExitPresence>
        )}
      </AnimatePresence>
      <ImportDialog
        config={config}
        initialError={importInitialError}
        initialText={importInitialText}
        onClose={closeImportDialog}
        onImported={handleImported}
        onNotify={showToast}
        open={importDialogOpen}
      />
    </>
  );
}
