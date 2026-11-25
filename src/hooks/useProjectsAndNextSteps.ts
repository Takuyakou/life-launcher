/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AppConfig, LauncherNextStep, LauncherProject } from "../types";
import { listInstructionDirectory, listInstructionRoots } from "../tauri";
import { resolveProjectColorId } from "../projectIdentity";
import { unfinishedTodayUsesSource } from "../sourceEdit";
import type {
  InstructionChoice,
  LegacyNextStepChoice,
  NextStepDecisionMode,
  NextStepEditDraft,
  ProjectEditDraft,
} from "../app/dashboardTypes";
import { createStableId, uniqueProjectId } from "../app/helpers";
import { WEEKLY_FOCUS_LIMIT } from "../constants";
import { prepareProjectDeletion, projectDeletionBlockReason, projectDeletionSummary, type ProjectDeletionMode } from "../projectDeletion";
import { prepareNextStepRemoval, prepareWishlistPromotion, sameNextStepSnapshot } from "../nextStepWishlist";

type Deps = Record<string, any>;

export function useProjectsAndNextSteps(deps: Deps) {
  const {
    activeTimerRef,
    captureDialogReturnFocus,
    config,
    configRef,
    persistConfig,
    refreshInstructionChoicesRef,
    requestConfirmation,
    saveSourceEdit,
    setContextMenu,
    setProjectsOpen,
    showToast,
    sourceEditBlockReason,
    sourceEditBusyRef,
    sourceEditOriginRef,
    warnSourceEditBlocked,
    setProjectNextStepSuggestions,
    projectEditDraft,
    setProjectEditDraft,
    setProjectEditSaving,
    nextStepEditDraft,
    setNextStepEditDraft,
    setNextStepOpenMenuOpen,
    setNextStepOpenPicker,
    setInstructionChoices,
    setInstructionChoicesLoading,
    setInstructionChoicesError,
    projectEditSavingRef,
    projectEditInitialDraftRef,
    nextStepEditInitialDraftRef,
    projectEditReturnFocusRef,
    nextStepEditReturnFocusRef,
    projectSelectableButtons,
    refreshNextStepSuggestions,
    closeNextStepEditDialog,
    setSourceEditSaving,
    closeProjectEditDialog,
  } = deps;

  const refreshInstructionChoices = async () => {
    setInstructionChoicesLoading(true);
    setInstructionChoicesError(null);
    try {
      const roots = (await listInstructionRoots()).filter((root: any) => root.available);
      const choices: InstructionChoice[] = [];
      const queue = roots.map((root: any) => ({ root, path: root.path }));
      let scanned = 0;
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        const entries = await listInstructionDirectory(current.path);
        for (const entry of entries) {
          scanned += 1;
          if (scanned > 50_000) throw new Error("手順書一覧が50,000項目を超えています");
          if (entry.kind === "folder") {
            queue.push({ root: current.root, path: entry.path });
          } else {
            const relative = entry.path
              .slice(current.root.path.length)
              .replace(/^[\\/]+/, "")
              .replace(/[\\/]+/g, " / ");
            choices.push({ path: entry.path, label: `${current.root.name} / ${relative}` });
          }
        }
      }
      choices.sort((left, right) => left.label.localeCompare(right.label, "ja"));
      setInstructionChoices(choices);
    } catch (error) {
      setInstructionChoices([]);
      setInstructionChoicesError(error instanceof Error ? error.message : String(error));
    } finally {
      setInstructionChoicesLoading(false);
    }
  };

  refreshInstructionChoicesRef.current = refreshInstructionChoices;

  const openProjectAddDialog = () => {
    if (!config) return;
    captureDialogReturnFocus(projectEditReturnFocusRef);
    setContextMenu(null);
    const draft: ProjectEditDraft = {
      id: "",
      name: "",
      northStar: "",
      weeklyFocus: false,
      colorId: "amber",
      isNew: true,
    };
    projectEditInitialDraftRef.current = draft;
    setProjectEditDraft(draft);
  };

  const openProjectEditDialog = (
    project: LauncherProject,
    origin: "source" | "today" | "builder" = "source",
  ) => {
    sourceEditOriginRef.current = origin;
    captureDialogReturnFocus(projectEditReturnFocusRef);
    setContextMenu(null);
    const draft: ProjectEditDraft = {
      id: project.id,
      name: project.name,
      northStar: project.northStar ?? "",
      weeklyFocus: project.weeklyFocus === true,
      colorId: resolveProjectColorId(project.id, project.colorId),
      isNew: false,
    };
    projectEditInitialDraftRef.current = draft;
    setProjectEditDraft(draft);
  };

  const nextStepExecutionDraft = (
    execution?: Partial<LauncherNextStep>,
  ): Pick<
    NextStepEditDraft,
    | "buttonIds"
    | "defaultTimerMinutes"
    | "shortTimerMinutes"
    | "startNoteTemplate"
    | "instructionPath"
    | "instructionOpenOnStart"
    | "expandTimerOnStart"
  > => ({
    buttonIds: (execution?.buttonIds ?? []).filter((buttonId: any) =>
      projectSelectableButtons.some((button: any) => button.id === buttonId),
    ),
    defaultTimerMinutes: execution?.defaultTimerMinutes
      ? String(execution.defaultTimerMinutes)
      : "",
    shortTimerMinutes: execution?.shortTimerMinutes ? String(execution.shortTimerMinutes) : "",
    startNoteTemplate: execution?.startNoteTemplate ?? "",
    instructionPath: execution?.instructionPath ?? "",
    instructionOpenOnStart: Boolean(
      execution?.instructionPath && execution.instructionOpenOnStart !== false,
    ),
    expandTimerOnStart: execution?.expandTimerOnStart === true,
  });

  const openNextStepEditor = (
    project: LauncherProject,
    options?: {
      mode?: NextStepEditDraft["mode"];
      text?: string;
      promotedWishlistId?: string;
      projectLocked?: boolean;
      origin?: "source" | "today" | "builder";
      /** P10-09: values copied from the Next Step that was just finished. */
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
    },
  ) => {
    const sourceKey = `project:${project.id}`;
    const origin = options?.origin ?? "source";
    if (warnSourceEditBlocked(sourceKey, origin === "today")) {
      setContextMenu(null);
      return;
    }
    const mode = options?.mode ?? (project.nextStep?.text.trim() ? "edit" : "set");
    const promotingWishlist = mode === "promote" && Boolean(options?.promotedWishlistId);
    const editingExisting = mode === "edit" && Boolean(project.nextStep);
    // P10-09 (§8.1): a prefilled Next Step ("same step again") starts on the free-text form so
    // the copied action and its execution settings are visible as they are.
    const initialDecisionMode: NextStepDecisionMode = options?.prefill
      ? "new"
      : promotingWishlist || mode === "set"
        ? "wishlist"
        : "new";
    sourceEditOriginRef.current = origin;
    captureDialogReturnFocus(nextStepEditReturnFocusRef);
    setContextMenu(null);
    const draft: NextStepEditDraft = {
      mode,
      decisionMode: initialDecisionMode,
      projectId: project.id,
      projectLocked: options?.projectLocked ?? true,
      text:
        initialDecisionMode === "wishlist" ? "" : (options?.text ?? project.nextStep?.text ?? ""),
      originalText: project.nextStep?.text ?? "",
      trigger: editingExisting ? (project.nextStep?.trigger ?? "") : "",
      resumeNote: editingExisting ? (project.nextStep?.resumeNote ?? "") : "",
      ...nextStepExecutionDraft(editingExisting ? project.nextStep : undefined),
      legacyChoice:
        !editingExisting && !project.nextStep && project.legacyNextStepSettings ? null : "discard",
      replacementChoice: null,
      replacedNextStep: promotingWishlist ? project.nextStep : undefined,
      ...(options?.promotedWishlistId ? { promotedWishlistId: options.promotedWishlistId } : {}),
      ...(options?.prefill ?? {}),
    };
    nextStepEditInitialDraftRef.current = draft;
    setNextStepOpenMenuOpen(false);
    setNextStepOpenPicker(null);
    setNextStepEditDraft(draft);
    void refreshNextStepSuggestions(project.id);
    void refreshInstructionChoices();
  };

  const promoteInboxToNextStep = (index: number) => {
    const current = configRef.current;
    const item = current?.inbox[index];
    if (!current || !item) return;
    if (!item.id) {
      setContextMenu(null);
      showToast("warn", "この項目にはstable IDがないため、先に編集して保存してください");
      return;
    }
    if (warnSourceEditBlocked(`wishlist:${item.id}`)) {
      setContextMenu(null);
      return;
    }
    const project = item.projectId
      ? current.projects.find((candidate: any) => candidate.id === item.projectId)
      : undefined;
    if (item.projectId && !project) {
      setContextMenu(null);
      showToast("warn", "所属プロジェクトが見つかりません");
      return;
    }
    if (project) {
      openNextStepEditor(project, {
        mode: "promote",
        text: item.text,
        promotedWishlistId: item.id,
        projectLocked: true,
      });
      return;
    }
    captureDialogReturnFocus(nextStepEditReturnFocusRef);
    setContextMenu(null);
    const draft: NextStepEditDraft = {
      mode: "promote",
      decisionMode: "wishlist",
      projectId: "",
      projectLocked: false,
      text: "",
      originalText: "",
      trigger: "",
      resumeNote: "",
      ...nextStepExecutionDraft(),
      legacyChoice: "discard",
      replacementChoice: null,
      replacedNextStep: undefined,
      promotedWishlistId: item.id,
    };
    nextStepEditInitialDraftRef.current = draft;
    setNextStepOpenMenuOpen(false);
    setNextStepOpenPicker(null);
    setNextStepEditDraft(draft);
    setProjectNextStepSuggestions([]);
    void refreshInstructionChoices();
  };

  async function promoteWishlistToProject(wishlistId: string) {
    const current = configRef.current;
    const item = current?.inbox.find((candidate: any) => candidate.id === wishlistId);
    const project = item?.projectId
      ? current?.projects.find((candidate: any) => candidate.id === item.projectId)
      : undefined;
    if (!current || !item || !project || sourceEditBusyRef.current) return false;
    if (project.nextStep?.sourceWishlistId === wishlistId) {
      showToast("warn", "すでに次の一手に設定されています");
      return true;
    }
    const projectId = project.id;
    const wishlistSource = `wishlist:${wishlistId}`;
    const projectSource = `project:${projectId}`;
    const blockReason =
      sourceEditBlockReason(wishlistSource) ?? sourceEditBlockReason(projectSource);
    if (blockReason) {
      showToast("warn", blockReason);
      return false;
    }

    const legacyExecution = project.nextStep ? undefined : project.legacyNextStepSettings;
    const instructionPath = item.instructionPath ?? legacyExecution?.instructionPath;
    const nextStep: LauncherNextStep = {
      text: item.text.trim(),
      generationId: createStableId(),
      buttonIds: [...(item.buttonIds ?? legacyExecution?.buttonIds ?? [])],
      ...(legacyExecution?.defaultTimerMinutes
        ? { defaultTimerMinutes: legacyExecution.defaultTimerMinutes }
        : {}),
      ...(legacyExecution?.shortTimerMinutes
        ? { shortTimerMinutes: legacyExecution.shortTimerMinutes }
        : {}),
      ...(legacyExecution?.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
      ...(legacyExecution?.startNoteTemplate
        ? { startNoteTemplate: legacyExecution.startNoteTemplate }
        : {}),
      ...(instructionPath
        ? {
            instructionPath,
            instructionOpenOnStart:
              item.instructionPath !== undefined
                ? item.instructionOpenOnStart !== false
                : legacyExecution?.instructionOpenOnStart !== false,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    let nextConfig: AppConfig;
    try {
      nextConfig = prepareWishlistPromotion(current, {
        wishlistId,
        projectId,
        nextStep,
        expectedCurrent: project.nextStep,
        createId: createStableId,
      });
    } catch (error) {
      showToast("warn", error instanceof Error ? error.message : String(error));
      return false;
    }

    sourceEditBusyRef.current = projectSource;
    try {
      const saved = await persistConfig(nextConfig);
      if (saved) {
        showToast(
          "ok",
          project.nextStep?.text.trim() ? "次の一手を変更しました" : "次の一手に設定しました",
          {
            detail: project.nextStep?.text.trim()
              ? "元の次の一手はやりたいことへ戻しました"
              : undefined,
          },
        );
      }
      return saved;
    } finally {
      sourceEditBusyRef.current = null;
    }
  }

  const selectNextStepProject = (projectId: string) => {
    if (!nextStepEditDraft || nextStepEditDraft.projectLocked) return;
    const project = configRef.current?.projects.find((candidate: any) => candidate.id === projectId);
    if (project && warnSourceEditBlocked(`project:${project.id}`)) {
      return;
    }
    setNextStepEditDraft({
      ...nextStepEditDraft,
      mode:
        nextStepEditDraft.decisionMode === "wishlist"
          ? "promote"
          : project?.nextStep
            ? "edit"
            : "set",
      projectId,
      originalText: project?.nextStep?.text ?? "",
      trigger: "",
      resumeNote: "",
      ...nextStepExecutionDraft(),
      legacyChoice: project?.legacyNextStepSettings && !project.nextStep ? null : "discard",
      replacementChoice: null,
      replacedNextStep:
        nextStepEditDraft.decisionMode === "wishlist" ? project?.nextStep : undefined,
      promotedWishlistId: undefined,
    });
    void refreshNextStepSuggestions(projectId || null);
  };

  const selectNextStepDecisionMode = (decisionMode: NextStepDecisionMode) => {
    const draft = nextStepEditDraft;
    const current = configRef.current;
    if (!draft || !current || draft.decisionMode === decisionMode) return;
    const project = current.projects.find((candidate: any) => candidate.id === draft.projectId);
    const selectedWishlistStillMatches = current.inbox.some(
      (item: any) => item.id === draft.promotedWishlistId && item.projectId === draft.projectId,
    );
    if (decisionMode === "wishlist") {
      setNextStepEditDraft({
        ...draft,
        mode: "promote",
        decisionMode,
        trigger: "",
        resumeNote: "",
        ...nextStepExecutionDraft(),
        legacyChoice: "discard",
        replacementChoice: null,
        replacedNextStep: project?.nextStep,
        promotedWishlistId: selectedWishlistStillMatches ? draft.promotedWishlistId : undefined,
      });
      return;
    }
    setNextStepEditDraft({
      ...draft,
      mode: project?.nextStep ? "edit" : "set",
      decisionMode,
      resumeNote: project?.nextStep?.resumeNote ?? "",
      legacyChoice: project?.legacyNextStepSettings && !project.nextStep ? null : "discard",
      replacementChoice: null,
      replacedNextStep: undefined,
    });
  };

  const chooseLegacyNextStepSettings = (choice: Exclude<LegacyNextStepChoice, null>) => {
    if (!nextStepEditDraft) return;
    const project = configRef.current?.projects.find(
      (candidate: any) => candidate.id === nextStepEditDraft.projectId,
    );
    setNextStepEditDraft({
      ...nextStepEditDraft,
      ...nextStepExecutionDraft(choice === "inherit" ? project?.legacyNextStepSettings : undefined),
      legacyChoice: choice,
    });
  };

  const parseNextStepTimer = (raw: string, label: string) => {
    if (!raw.trim()) return undefined;
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 1 || value > 240) {
      throw new Error(`${label}は1〜240分で入力してください`);
    }
    return value;
  };

  const saveNextStepEdit = async () => {
    const current = configRef.current;
    const draft = nextStepEditDraft;
    if (!current || !draft || sourceEditBusyRef.current) return;
    const project = current.projects.find((candidate: any) => candidate.id === draft.projectId);
    if (!project) {
      showToast("warn", "プロジェクトを選択してください");
      return;
    }

    const promotingWishlist = draft.decisionMode === "wishlist";
    const selectedWishlist =
      promotingWishlist && draft.promotedWishlistId
        ? current.inbox.find(
            (item: any) => item.id === draft.promotedWishlistId && item.projectId === project.id,
          )
        : undefined;
    if (promotingWishlist && !selectedWishlist) {
      showToast("warn", "やりたいことを選択してください");
      return;
    }
    if (selectedWishlist && project.nextStep?.sourceWishlistId === selectedWishlist.id) {
      showToast("warn", "すでに次の一手に設定されています");
      return;
    }
    const text = promotingWishlist ? (selectedWishlist?.text.trim() ?? "") : draft.text.trim();
    if (!text) {
      showToast("warn", "次の一手を入力してください");
      return;
    }
    if (promotingWishlist && !sameNextStepSnapshot(project.nextStep, draft.replacedNextStep)) {
      showToast("warn", "現在の次の一手が変更されたため、内容を確認し直してください");
      return;
    }
    if (
      !promotingWishlist &&
      !project.nextStep &&
      project.legacyNextStepSettings &&
      draft.legacyChoice === null
    ) {
      showToast("warn", "以前の実行設定を引き継ぐか破棄するか選んでください");
      return;
    }

    const replacingExisting = Boolean(promotingWishlist && project.nextStep?.text.trim());
    if (replacingExisting && draft.replacementChoice !== "return") {
      showToast("warn", "現在の次の一手をやりたいことへ戻すことを確認してください");
      return;
    }
    const projectSourceKey = `project:${project.id}`;
    const wishlistSourceKey = selectedWishlist ? `wishlist:${selectedWishlist.id}` : null;
    const allowTodaySourceSync = sourceEditOriginRef.current === "today" && !promotingWishlist;
    const blockReason =
      sourceEditBlockReason(projectSourceKey, allowTodaySourceSync) ??
      (wishlistSourceKey ? sourceEditBlockReason(wishlistSourceKey) : null);
    if (blockReason) {
      showToast("warn", blockReason);
      return;
    }
    if (selectedWishlist && unfinishedTodayUsesSource(current, `wishlist:${selectedWishlist.id}`)) {
      showToast("warn", "今日の3件で未完了のやりたいことは選べません");
      return;
    }
    if (
      replacingExisting &&
      unfinishedTodayUsesSource(current, projectSourceKey, project.nextStep?.generationId)
    ) {
      showToast("warn", "今日の3件で未完了の次の一手があるため変更できません");
      return;
    }

    let defaultTimerMinutes: number | undefined;
    let shortTimerMinutes: number | undefined;
    try {
      defaultTimerMinutes = parseNextStepTimer(draft.defaultTimerMinutes, "通常タイマー");
      shortTimerMinutes = parseNextStepTimer(draft.shortTimerMinutes, "短時間タイマー");
    } catch (error) {
      showToast("warn", error instanceof Error ? error.message : String(error));
      return;
    }

    const now = new Date().toISOString();
    const existing = !promotingWishlist && draft.mode === "edit" ? project.nextStep : undefined;
    const nextStep: LauncherNextStep = {
      text,
      ...(existing ? { generationId: existing.generationId } : { generationId: createStableId() }),
      ...(existing?.sourceWishlistId ? { sourceWishlistId: existing.sourceWishlistId } : {}),
      buttonIds: [...draft.buttonIds],
      ...(draft.trigger.trim() ? { trigger: draft.trigger.trim() } : {}),
      ...(defaultTimerMinutes ? { defaultTimerMinutes } : {}),
      ...(shortTimerMinutes ? { shortTimerMinutes } : {}),
      ...(draft.expandTimerOnStart ? { expandTimerOnStart: true } : {}),
      ...(draft.startNoteTemplate.trim()
        ? { startNoteTemplate: draft.startNoteTemplate.trim() }
        : {}),
      ...(draft.instructionPath
        ? {
            instructionPath: draft.instructionPath,
            instructionOpenOnStart: draft.instructionOpenOnStart,
          }
        : {}),
      updatedAt: existing?.updatedAt && text === draft.originalText ? existing.updatedAt : now,
      ...(existing?.reviewedAt ? { reviewedAt: existing.reviewedAt } : {}),
      ...(existing && draft.resumeNote.trim() ? { resumeNote: draft.resumeNote.trim() } : {}),
    };

    let nextConfig: AppConfig;
    if (promotingWishlist && selectedWishlist) {
      try {
        nextConfig = prepareWishlistPromotion(current, {
          wishlistId: selectedWishlist.id!,
          projectId: project.id,
          nextStep,
          expectedCurrent: draft.replacedNextStep,
          createId: createStableId,
        });
      } catch (error) {
        showToast("warn", error instanceof Error ? error.message : String(error));
        return;
      }
    } else {
      const nextProject: LauncherProject = {
        ...project,
        nextStep,
        legacyNextStepSettings: undefined,
      };
      nextConfig = {
        ...current,
        projects: current.projects.map((candidate: any) =>
          candidate.id === project.id ? nextProject : candidate,
        ),
      };
    }

    if (!promotingWishlist && draft.mode === "edit") {
      const result = await saveSourceEdit(current, nextConfig, projectSourceKey);
      if (!result) return;
      closeNextStepEditDialog(true);
      showToast("ok", "次の一手を保存しました", {
        detail: result.todayUpdated ? "今日の3件にも反映しました" : undefined,
      });
      return;
    }

    sourceEditBusyRef.current = projectSourceKey;
    setSourceEditSaving(true);
    try {
      if (!(await persistConfig(nextConfig))) return;
      closeNextStepEditDialog(true);
      showToast("ok", promotingWishlist ? "次の一手にしました" : "次の一手を保存しました", {
        detail: replacingExisting ? "元の次の一手はやりたいことへ戻しました" : undefined,
      });
    } finally {
      sourceEditBusyRef.current = null;
      setSourceEditSaving(false);
    }
  };

  async function removeProjectNextStep(project: LauncherProject, choice: "return" | "delete") {
    const current = configRef.current;
    const liveProject = current?.projects.find((candidate: any) => candidate.id === project.id);
    if (!current || !liveProject?.nextStep?.text.trim()) return false;
    const sourceKey = `project:${project.id}`;
    if (warnSourceEditBlocked(sourceKey)) {
      setContextMenu(null);
      return false;
    }
    let nextConfig: AppConfig;
    try {
      nextConfig = prepareNextStepRemoval(current, {
        projectId: liveProject.id,
        expectedCurrent: liveProject.nextStep,
        choice,
        createId: createStableId,
      });
    } catch (error) {
      showToast("warn", error instanceof Error ? error.message : String(error));
      return false;
    }
    const saved = await persistConfig(nextConfig);
    if (saved) {
      setContextMenu(null);
      showToast(
        "neutral",
        choice === "return" ? "やりたいことへ戻しました" : "次の一手を未設定にしました",
      );
    }
    return saved;
  }

  const clearProjectNextStep = (project: LauncherProject) => {
    const current = configRef.current;
    const liveProject = current?.projects.find((candidate: any) => candidate.id === project.id);
    if (!current || !liveProject?.nextStep?.text.trim()) return;
    const sourceKey = `project:${project.id}`;
    if (warnSourceEditBlocked(sourceKey)) {
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    requestConfirmation({
      title: "次の一手を未設定にしますか？",
      subject: `「${liveProject.nextStep.text}」`,
      message: "今日の3件に採用済みの内容と実行記録は変更しません。",
      confirmLabel: "やりたいことへ戻す",
      alternateLabel: "削除して未設定にする",
      alternateTone: "danger",
      processingLabel: "保存しています…",
      alternateProcessingLabel: "保存しています…",
      tone: "warning",
      onConfirm: () => removeProjectNextStep(liveProject, "return"),
      onAlternate: () => removeProjectNextStep(liveProject, "delete"),
    });
  };

  const projectDeleteBlockReason = (projectId: string) => {
    const current = configRef.current;
    if (!current) return "設定を読み込んでから削除してください";
    if (sourceEditBusyRef.current !== null || projectEditSavingRef.current) {
      return "保存処理が完了してから削除してください";
    }
    return projectDeletionBlockReason(current, projectId, activeTimerRef.current?.sourceId);
  };

  const executeProjectDeletion = async (projectId: string, mode: ProjectDeletionMode) => {
    const current = configRef.current;
    if (!current) return false;
    const reason = projectDeleteBlockReason(projectId);
    if (reason) {
      showToast("warn", reason);
      return false;
    }
    const summary = projectDeletionSummary(current, projectId);
    if (!summary) {
      showToast("warn", "削除するプロジェクトが見つかりません");
      return false;
    }
    const nextConfig = prepareProjectDeletion(current, projectId, mode, {
      completedAt: new Date().toISOString(),
      createId: createStableId,
    });
    if (!nextConfig) return false;
    if (!(await persistConfig(nextConfig))) return false;

    if (projectEditDraft?.id === projectId) closeProjectEditDialog(true);
    showToast(
      "danger",
      mode === "complete"
        ? `残っている項目を完了扱いにして、プロジェクト「${summary.project.name}」を削除しました`
        : `プロジェクト「${summary.project.name}」を削除しました`,
    );
    return true;
  };

  const requestProjectDeletion = (project: LauncherProject) => {
    setContextMenu(null);
    const current = configRef.current;
    if (!current) return;
    const reason = projectDeleteBlockReason(project.id);
    if (reason) {
      showToast("warn", reason);
      return;
    }
    const summary = projectDeletionSummary(current, project.id);
    if (!summary) {
      showToast("warn", "削除するプロジェクトが見つかりません");
      return;
    }
    requestConfirmation({
      title: "プロジェクトを削除しますか？",
      subject: `「${summary.project.name}」と、現在登録されている関連項目が対象です。`,
      message: `次の一手: ${summary.nextStepCount}件\nやりたいこと: ${summary.wishlistCount}件\n\n過去の実行記録は残ります。`,
      confirmLabel: "関連項目も削除",
      alternateLabel: "残っている項目を完了扱いにして削除",
      processingLabel: "削除しています…",
      alternateProcessingLabel: "完了扱いにして削除しています…",
      tone: "danger",
      alternateTone: "danger",
      initialFocus: "cancel",
      onConfirm: () => executeProjectDeletion(project.id, "delete"),
      onAlternate: () => executeProjectDeletion(project.id, "complete"),
    });
  };

  const openProjectManagement = () => {
    setContextMenu(null);
    setProjectsOpen(true);
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".projectsBand")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const saveProjectEdit = async () => {
    const config = configRef.current;
    if (!config || !projectEditDraft || projectEditSavingRef.current) return;
    if (!projectEditDraft.isNew && !config.projects.some((p: any) => p.id === projectEditDraft.id)) {
      showToast("warn", "元の登録が見つかりません");
      return;
    }
    const name = projectEditDraft.name.trim();
    if (!name) {
      showToast("warn", "プロジェクト名を入力してください");
      return;
    }

    const existingProject = projectEditDraft.isNew
      ? undefined
      : config.projects.find((item: any) => item.id === projectEditDraft.id);
    const project: LauncherProject = {
      ...(existingProject ?? {}),
      id: projectEditDraft.isNew ? uniqueProjectId(name, config.projects) : projectEditDraft.id,
      name,
      northStar: projectEditDraft.northStar.trim() || undefined,
      weeklyFocus: projectEditDraft.weeklyFocus || undefined,
      colorId: projectEditDraft.colorId,
    };

    const projects = projectEditDraft.isNew
      ? [...config.projects, project]
      : config.projects.map((item: any) => (item.id === project.id ? project : item));

    projectEditSavingRef.current = true;
    setProjectEditSaving(true);
    try {
      if (!(await persistConfig({ ...config, projects }))) return;
      closeProjectEditDialog(true);
      if (projectEditDraft.isNew) {
        showToast("ok", `${name} を追加しました`);
      } else {
        showToast("ok", "プロジェクトを保存しました");
      }
    } finally {
      projectEditSavingRef.current = false;
      setProjectEditSaving(false);
    }
  };

  const setProjectWeeklyFocus = (checked: boolean) => {
    if (!config || !projectEditDraft) return;
    const otherFocusedProjects = config.projects.filter(
      (project: any) => project.id !== projectEditDraft.id && project.weeklyFocus === true,
    ).length;
    if (checked && otherFocusedProjects >= WEEKLY_FOCUS_LIMIT) {
      showToast("neutral", `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件まで選べます`);
      return;
    }
    setProjectEditDraft({ ...projectEditDraft, weeklyFocus: checked });
  };

  const setWeeklyReviewProjectFocus = (projectId: string, checked: boolean) => {
    if (!config) return;
    const otherFocusedProjects = config.projects.filter(
      (project: any) => project.id !== projectId && project.weeklyFocus === true,
    ).length;
    if (checked && otherFocusedProjects >= WEEKLY_FOCUS_LIMIT) {
      showToast("neutral", `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件まで選べます`);
      return;
    }

    void persistConfig({
      ...config,
      projects: config.projects.map((project: any) =>
        project.id === projectId ? { ...project, weeklyFocus: checked || undefined } : project,
      ),
    });
  };


  return {
    chooseLegacyNextStepSettings,
    clearProjectNextStep,
    executeProjectDeletion,
    nextStepExecutionDraft,
    openNextStepEditor,
    openProjectAddDialog,
    openProjectEditDialog,
    openProjectManagement,
    parseNextStepTimer,
    projectDeleteBlockReason,
    promoteInboxToNextStep,
    promoteWishlistToProject,
    refreshInstructionChoices,
    removeProjectNextStep,
    requestProjectDeletion,
    saveNextStepEdit,
    saveProjectEdit,
    selectNextStepDecisionMode,
    selectNextStepProject,
    setProjectWeeklyFocus,
    setWeeklyReviewProjectFocus,
  };
}
