import { AnimatePresence } from "motion/react";
import { ConfirmDialog, type ConfirmDialogRequest } from "./ConfirmDialog";
import { ExitPresence } from "./ExitPresence";

type Props = {
  confirmDialog: ConfirmDialogRequest | null;
  onCancel: () => void;
};

export function DashboardModals({ confirmDialog, onCancel }: Props) {
  return (
    <AnimatePresence initial={false}>
      {confirmDialog && (
        <ExitPresence key="confirm-dialog">
          {(exiting, exitProps) => (
            <ConfirmDialog {...confirmDialog} onCancel={onCancel} exitProps={exitProps} open />
          )}
        </ExitPresence>
      )}
    </AnimatePresence>
  );
}
