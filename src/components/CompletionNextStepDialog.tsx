import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  CompletionFollowup,
  NextStepEditDraft,
  ToastTone,
} from "../app/dashboardTypes";
import type { AppConfig, LauncherButton, LauncherProject } from "../types";
import { formatSessionRange } from "../app/helpers";
import type { ExitPresenceAttributes } from "./ExitPresence";
import { ProjectIdentity } from "./ProjectIdentity";

// V164-A1: the 「一手進みました」 dialog, moved out of App.tsx (same DOM, text and handlers).

export type NextStepEditorOptions = {
  mode?: NextStepEditDraft["mode"];
  text?: string;
  promotedWishlistId?: string;
  projectLocked?: boolean;
  origin?: "source" | "today" | "builder";
  prefill?: Partial<
    Pick<
      NextStepEditDraft,
      | "text"
      | "trigger"
      | "buttonIds"
      | "shortTimerMinutes"
      | "defaultTimerMinutes"
      | "instructionPath"
      | "instructionOpenOnStart"
      | "startNoteTemplate"
      | "expandTimerOnStart"
    >
  >;
};

export type CompletionNextStepDialogProps = {
  actions: {
    openNextStepEditor: (project: LauncherProject, options?: NextStepEditorOptions) => void;
    projectSelectableButtons: LauncherButton[];
    promoteInboxToNextStep: (index: number) => void;
    showToast: (tone: ToastTone, message: string) => void;
  };
  choice: string;
  config: AppConfig;
  configRef: MutableRefObject<AppConfig | null>;
  exitProps: ExitPresenceAttributes;
  followup: CompletionFollowup;
  setChoice: Dispatch<SetStateAction<string>>;
  setFollowup: Dispatch<SetStateAction<CompletionFollowup | null>>;
};

export function CompletionNextStepDialog({
  actions,
  choice: completionFollowupChoice,
  config,
  configRef,
  exitProps,
  followup: completionFollowup,
  setChoice: setCompletionFollowupChoice,
  setFollowup: setCompletionFollowup,
}: CompletionNextStepDialogProps) {
  const {
    openNextStepEditor,
    projectSelectableButtons,
    promoteInboxToNextStep,
    showToast,
  } = actions;
  const projectId =
    completionFollowup.source.kind === "nextStep" ? completionFollowup.source.projectId : "";
  const followupProject = config.projects.find((project) => project.id === projectId);
  const followupWishlist = config.inbox.filter(
    (item): item is AppConfig["inbox"][number] & { id: string } =>
      item.projectId === projectId && Boolean(item.id),
  );
  const previous = completionFollowup.previousNextStep;
  const decide = () => {
    const live = configRef.current;
    const project = live?.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      setCompletionFollowup(null);
      showToast("warn", "プロジェクトが見つかりません");
      return;
    }
    if (project.nextStep?.text.trim()) {
      setCompletionFollowup(null);
      showToast("warn", "次の一手はもう決まっています");
      return;
    }
    if (completionFollowupChoice === "none") {
      setCompletionFollowup(null);
      return;
    }
    if (completionFollowupChoice.startsWith("wishlist:")) {
      const wishlistId = completionFollowupChoice.slice("wishlist:".length);
      const index = live?.inbox.findIndex((item) => item.id === wishlistId) ?? -1;
      if (index < 0) {
        // P10-14 (§8.1): the chosen wishlist item vanished while the dialog was open.
        const firstWishlist = live?.inbox.find(
          (item) => item.projectId === projectId && Boolean(item.id),
        );
        setCompletionFollowupChoice(
          firstWishlist?.id
            ? `wishlist:${firstWishlist.id}`
            : previous
              ? "repeat"
              : "write",
        );
        showToast("warn", "選んだやりたいことが見つかりません");
        return;
      }
      setCompletionFollowup(null);
      promoteInboxToNextStep(index);
      return;
    }
    if (completionFollowupChoice === "repeat" && previous) {
      // Only the buttons that still exist and can be chosen in the editor are copied.
      const liveButtons = new Set(projectSelectableButtons.map((button) => button.id));
      setCompletionFollowup(null);
      openNextStepEditor(project, {
        mode: "set",
        prefill: {
          text: previous.text,
          trigger: previous.trigger ?? "",
          buttonIds: previous.buttonIds.filter((id) => liveButtons.has(id)),
          shortTimerMinutes:
            previous.shortTimerMinutes === undefined
              ? ""
              : String(previous.shortTimerMinutes),
          defaultTimerMinutes:
            previous.defaultTimerMinutes === undefined
              ? ""
              : String(previous.defaultTimerMinutes),
          instructionPath: previous.instructionPath ?? "",
          instructionOpenOnStart: previous.instructionOpenOnStart ?? false,
          startNoteTemplate: previous.startNoteTemplate ?? "",
          expandTimerOnStart: previous.expandTimerOnStart ?? false,
        },
      });
      return;
    }
    setCompletionFollowup(null);
    openNextStepEditor(project, { mode: "set" });
  };
  const choiceClass = (selected: boolean) =>
    selected
      ? "completionFollowupChoice completionFollowupChoice--selected"
      : "completionFollowupChoice";
  return (
    <div className="modalBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="一手進みました"
        aria-modal="true"
        className="dropDialog completionFollowupDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div className="completionDoneHeader">
          <span aria-hidden="true" className="completionDoneMark">
            ✓
          </span>
          <div>
            <p className="eyebrow">Session</p>
            <h2>一手進みました</h2>
          </div>
        </div>
        <div className="completionDoneSubject">
          {followupProject && (
            <ProjectIdentity
              colorId={followupProject.colorId}
              compact
              name={followupProject.name}
              projectId={followupProject.id}
            />
          )}
          <strong title={completionFollowup.text}>{completionFollowup.text}</strong>
          {completionFollowup.minutes ? (
            <span className="completionDoneMinutes">
              {formatSessionRange(completionFollowup) ??
                `実行 ${completionFollowup.minutes}分`}
            </span>
          ) : null}
        </div>
        <h3 className="completionFollowupQuestion" id="completion-followup-question">
          次はどこから始めますか
        </h3>
        <div
          aria-labelledby="completion-followup-question"
          className="completionFollowupChoices"
          role="radiogroup"
        >
          {followupWishlist.map((item) => {
            const key = `wishlist:${item.id}`;
            return (
              <label className={choiceClass(completionFollowupChoice === key)} key={key}>
                <input
                  aria-label={item.text}
                  checked={completionFollowupChoice === key}
                  onChange={() => setCompletionFollowupChoice(key)}
                  type="radio"
                />
                <span>{item.text}</span>
                <small>やりたいことから</small>
              </label>
            );
          })}
          {previous && (
            <label className={choiceClass(completionFollowupChoice === "repeat")}>
              <input
                aria-label={`同じ一手をもう一度（${previous.text}）`}
                checked={completionFollowupChoice === "repeat"}
                onChange={() => setCompletionFollowupChoice("repeat")}
                type="radio"
              />
              <span>同じ一手をもう一度（{previous.text}）</span>
            </label>
          )}
          <label className={choiceClass(completionFollowupChoice === "write")}>
            <input
              aria-label="自分で書く"
              checked={completionFollowupChoice === "write"}
              onChange={() => setCompletionFollowupChoice("write")}
              type="radio"
            />
            <span>自分で書く</span>
          </label>
          <label className={choiceClass(completionFollowupChoice === "none")}>
            <input
              aria-label="今は決めない"
              checked={completionFollowupChoice === "none"}
              onChange={() => setCompletionFollowupChoice("none")}
              type="radio"
            />
            <span>今は決めない</span>
          </label>
        </div>
        <div className="dialogActions formDialogActions">
          <button
            className="primaryButton completionFollowupDecide"
            onClick={decide}
            type="button"
          >
            決定
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            onClick={() => setCompletionFollowup(null)}
            type="button"
          >
            閉じる
          </button>
        </div>
      </section>
    </div>
  );
}
