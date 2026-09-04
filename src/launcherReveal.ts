import type { LauncherAction, LauncherButton } from "./types";

const LOCAL_DRIVE_PATH = /^[A-Za-z]:[\\/]/;

function revealablePath(action: LauncherAction): string | null {
  switch (action.type) {
    case "open_app":
    case "open_file":
    case "open_folder":
    case "run_script":
      return action.payload.path.trim();
    case "open_shell_special":
    case "open_url":
      return null;
  }
}

export function canRevealLauncherButton(button: LauncherButton): boolean {
  if (button.actions.length !== 1) return false;
  const path = revealablePath(button.actions[0]);
  return Boolean(path && LOCAL_DRIVE_PATH.test(path));
}
