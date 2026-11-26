/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnimatePresence } from "motion/react";
import { ConfirmDialog } from "./ConfirmDialog";
import { ExitPresence } from "./ExitPresence";
import { ImportDialog } from "./ImportDialog";
import { InboxEditDialog } from "./InboxEditDialog";
import { InboxAddDialog } from "./InboxAddDialog";
import { NextStepEditDialog } from "./NextStepEditDialog";
import { TodayPickerDialog } from "./TodayPickerDialog";
type Props = Record<string, any>;

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
  } = props;
  return (
    <>
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

      <ImportDialog
        config={config}
        initialError={importInitialError}
        initialText={importInitialText}
        onClose={closeImportDialog}
        onImported={handleImported}
        onNotify={showToast}
        open={importDialogOpen}
      />
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
    </>
  );
}
