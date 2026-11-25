import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { InstructionChoice, ToastTone } from "../app/dashboardTypes";
import { buttonGroupName } from "../app/helpers";
import { SEARCH_GROUP_LIMIT, matchesSearchQuery } from "../searchMatch";
import { searchOverlayButtons } from "../overlayPages";
import type { SearchItem, SearchSection } from "../components/SearchPalette";
import type { InstructionWindowOpenOptions } from "../instructionWindow";
import type {
  AppConfig,
  DoNowCandidate,
  LauncherAction,
  LauncherProject,
} from "../types";

// V164-A5: the in-app search (Ctrl+F) items and the launch, moved out of App.tsx.
// The body is the same code in the same order; every input arrives in one deps object.

export type SearchPaletteDeps = {
  actions: {
    openDictionaryManually: () => Promise<void>;
    openInstructionWindow: (options: InstructionWindowOpenOptions) => Promise<unknown>;
    openInstructionsManually: () => Promise<void>;
    openSettingsCenter: () => void;
    promoteInboxToNextStep: (index: number) => void;
    refreshInstructionChoices: () => void;
    runActions: (id: string, actions: LauncherAction[]) => Promise<void>;
    setActiveView: Dispatch<SetStateAction<"main" | "records">>;
    setHelpGuideOpen: Dispatch<SetStateAction<boolean>>;
    showToast: (tone: ToastTone, message: string) => void;
    startDoNowProject: (
      project: LauncherProject,
      timerKind: "short" | "normal" | "measure",
    ) => void;
    toggleMiniMode: () => Promise<void>;
  };
  config: AppConfig;
  configRef: MutableRefObject<AppConfig | null>;
  doNowSelection: { candidate: DoNowCandidate; project: LauncherProject };
  instructionChoices: InstructionChoice[];
  instructionChoicesLoading: boolean;
  openSearchRef: MutableRefObject<() => void>;
  searchBusy: boolean;
  searchOpenerRef: MutableRefObject<HTMLElement | null>;
  searchOpen: boolean;
  searchQuery: string;
  setSearchBusy: Dispatch<SetStateAction<boolean>>;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
};

export function useSearchPalette(deps: SearchPaletteDeps) {
  const {
    actions,
    config,
    configRef,
    doNowSelection,
    instructionChoices,
    instructionChoicesLoading,
    openSearchRef,
    searchBusy,
    searchOpenerRef,
    searchOpen,
    searchQuery,
    setSearchBusy,
    setSearchOpen,
    setSearchQuery,
  } = deps;
  const {
    openDictionaryManually,
    openInstructionWindow,
    openInstructionsManually,
    openSettingsCenter,
    promoteInboxToNextStep,
    refreshInstructionChoices,
    runActions,
    setActiveView,
    setHelpGuideOpen,
    showToast,
    startDoNowProject,
    toggleMiniMode,
  } = actions;
const searchActions = [
  { key: "mini", title: "ミニタイマーにする" },
  { key: "records", title: "記録を開く" },
  { key: "instructions", title: "手順書を開く" },
  { key: "settings", title: "設定を開く" },
  { key: "guide", title: "使い方を開く" },
  { key: "dictionary", title: "辞書を開く" },
];

const openSearchPalette = () => {
  if (searchOpen) {
    const input = document.querySelector<HTMLInputElement>(".searchPaletteInput");
    input?.focus();
    input?.select();
    return;
  }
  const active = document.activeElement;
  searchOpenerRef.current = active instanceof HTMLElement ? active : null;
  setSearchQuery("");
  setSearchOpen(true);
  if (instructionChoices.length === 0 && !instructionChoicesLoading) {
    void refreshInstructionChoices();
  }
};
openSearchRef.current = openSearchPalette;

const closeSearchPalette = () => {
  setSearchOpen(false);
  const opener = searchOpenerRef.current;
  searchOpenerRef.current = null;
  if (opener && document.contains(opener)) opener.focus();
};

const searchNextStepItem = (project: LauncherProject): SearchItem | null => {
  const step = project.nextStep;
  if (!step || !step.text.trim()) return null;
  return {
    id: `nextStep:${project.id}`,
    kind: "nextStep",
    title: step.text.trim(),
    subtitle: project.name,
    meta: step.trigger?.trim() || undefined,
  };
};

const buildSearchSections = (): SearchSection[] => {
  const query = searchQuery.trim();
  const sections: SearchSection[] = [];
  const push = (id: string, title: string, items: SearchItem[]) => {
    if (items.length === 0) return;
    sections.push({ id, title, items: items.slice(0, SEARCH_GROUP_LIMIT), total: items.length });
  };
  const linkedToday = new Set(
    config.today.items
      .filter((item) => !item.done)
      .map((item) => item.sourceKey?.trim())
      .filter((key): key is string => Boolean(key)),
  );

  if (!query) {
    const top = doNowSelection?.project;
    const topItem = top ? searchNextStepItem(top) : null;
    if (topItem) push("doNow", "今やる一手", [topItem]);
    push("today3", "今日の3件の次の一手", config.projects
      .filter((project) => linkedToday.has(`project:${project.id}`))
      .map(searchNextStepItem)
      .filter((item): item is SearchItem => item !== null));
    return sections;
  }

  push("nextStep", "次の一手", config.projects
    .filter((project) => {
      const step = project.nextStep;
      if (!step || !step.text.trim()) return false;
      return matchesSearchQuery([project.name, step.text, step.trigger ?? ""].join("\n"), query);
    })
    .map(searchNextStepItem)
    .filter((item): item is SearchItem => item !== null));

  push("wishlist", "やりたいこと", config.inbox
    .filter((item) => {
      const project = item.projectId
        ? config.projects.find((candidate) => candidate.id === item.projectId)
        : undefined;
      return matchesSearchQuery([item.text, project?.name ?? ""].join("\n"), query);
    })
    .map((item) => {
      const project = item.projectId
        ? config.projects.find((candidate) => candidate.id === item.projectId)
        : undefined;
      return {
        id: `wishlist:${item.id}`,
        kind: "wishlist" as const,
        title: item.text,
        subtitle: project?.name,
      };
    }));

  push("button", "ボタン", searchOverlayButtons(
    config.buttons,
    config.overlayPages ?? [],
    query,
    config.dictionaryOrder,
  ).map((button) => ({
    id: `button:${button.id}`,
    kind: "button" as const,
    title: button.label,
    subtitle: buttonGroupName(button),
  })));

  push("instruction", "手順書", instructionChoices
    .filter((choice) => matchesSearchQuery(choice.label, query))
    .map((choice) => ({
      id: `instruction:${choice.path}`,
      kind: "instruction" as const,
      title: choice.label.split(" / ").pop() ?? choice.label,
      subtitle: choice.label.split(" / ").slice(0, -1).join(" / "),
    })));

  push("action", "操作", searchActions
    .filter((action) => matchesSearchQuery(action.title, query))
    .map((action) => ({
      id: `action:${action.key}`,
      kind: "action" as const,
      title: action.title,
    })));

  return sections;
};
const searchSections = buildSearchSections();

const runSearchItem = async (item: SearchItem, mode: "enter" | "shift") => {
  if (searchBusy) return;
  const missing = () => {
    setSearchBusy(false);
    showToast("warn", "見つかりません。一覧を作り直しました");
    return;
  };
  setSearchBusy(true);
  try {
  if (item.kind === "nextStep") {
    const projectId = item.id.replace("nextStep:", "");
    const project = configRef.current?.projects.find((candidate) => candidate.id === projectId);
    if (!project || !project.nextStep?.text.trim()) return missing();
    closeSearchPalette();
    startDoNowProject(project, mode === "shift" ? "normal" : "short");
    return;
  }
  if (item.kind === "wishlist") {
    const itemId = item.id.replace("wishlist:", "");
    const index = (configRef.current?.inbox ?? []).findIndex((entry) => entry.id === itemId);
    if (index < 0) return missing();
    closeSearchPalette();
    promoteInboxToNextStep(index);
    return;
  }
  if (item.kind === "button") {
    const buttonId = item.id.replace("button:", "");
    const button = (configRef.current?.buttons ?? []).find((entry) => entry.id === buttonId);
    if (!button) return missing();
    closeSearchPalette();
    void runActions(button.id, button.actions);
    return;
  }
  if (item.kind === "instruction") {
    const path = item.id.replace("instruction:", "");
    if (!instructionChoices.some((choice) => choice.path === path)) return missing();
    closeSearchPalette();
    await openInstructionWindow({ path, focus: true });
    return;
  }
  const key = item.id.replace("action:", "");
  closeSearchPalette();
  if (key === "mini") void toggleMiniMode();
  else if (key === "records") setActiveView("records");
  else if (key === "instructions") void openInstructionsManually();
  else if (key === "settings") openSettingsCenter();
  else if (key === "guide") setHelpGuideOpen(true);
  else if (key === "dictionary") void openDictionaryManually();
  } finally {
    setSearchBusy(false);
  }
};
  return { closeSearchPalette, openSearchPalette, runSearchItem, searchSections };
}
