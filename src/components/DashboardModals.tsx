/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnimatePresence } from "motion/react";
import { ConfirmDialog, type ConfirmDialogRequest } from "./ConfirmDialog";
import { ExitPresence } from "./ExitPresence";
import { ImportDialog } from "./ImportDialog";

type Props = {
  confirmDialog: ConfirmDialogRequest | null;
  onCancel: () => void;
  config: any;
  importDialogOpen: boolean;
  importInitialError: string | null;
  importInitialText: string;
  closeImportDialog: () => void;
  handleImported: (response: any) => void;
  showToast: (...args: any[]) => void;
};

export function DashboardModals({
  confirmDialog,
  onCancel,
  config,
  importDialogOpen,
  importInitialError,
  importInitialText,
  closeImportDialog,
  handleImported,
  showToast,
}: Props) {
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
