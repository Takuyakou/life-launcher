import type {
  Dispatch,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import type {
  ActiveTimer,
  ContextMenuTarget,
  InternalButtonDrag,
  NumberInputDragField,
  SidebarDragPreview,
  SidebarGroupDragPreview,
  TimerCompletionPrompt,
} from "../app/dashboardTypes";
import { timerActionText } from "../app/miniWindow";
import { springCollapse, staggerMax, staggerStep } from "../motion";
import type { ShortcutRegistrationStatus } from "../tauri";
import type { AppConfig, LauncherAction, LauncherButton, LauncherProject } from "../types";
import { ProjectIdentity } from "./ProjectIdentity";
import { ShortcutBadge } from "./ShortcutBadge";
import { TimerPanel } from "./TimerPanel";
import { UiIcon } from "./UiIcon";

// V164-A2: the sidebar (quick launch buttons, drag shadow and TimerPanel), moved out of App.tsx
// (same DOM, text and handlers).

export type SidebarQuickLaunchProps = {
  actions: {
    cancelNumberInputDrag: (event: PointerEvent<HTMLElement>) => void;
    cancelSidebarGroupPointerDrag: () => void;
    cancelSidebarPointerDrag: () => void;
    finishActiveTimer: (timer: ActiveTimer) => void;
    finishNumberInputDrag: (event: PointerEvent<HTMLElement>) => void;
    finishSidebarGroupPointerDrag: (
      event: PointerEvent<HTMLButtonElement>,
      groupName: string,
    ) => void;
    finishSidebarPointerDrag: (
      event: PointerEvent<HTMLButtonElement>,
      button: LauncherButton,
    ) => void;
    openContextMenu: (
      target: ContextMenuTarget,
      x: number,
      y: number,
      opener?: HTMLElement | null,
    ) => void;
    openContextMenuFromKeyboard: (
      event: KeyboardEvent<HTMLElement>,
      target: ContextMenuTarget,
    ) => void;
    openDictionaryManually: () => Promise<void>;
    renderSidebarButtonIcon: (button: LauncherButton) => ReactNode;
    runActions: (id: string, actions: LauncherAction[]) => Promise<void>;
    saveDefaultTimerMinutes: (rawValue: string | number) => Promise<void>;
    setDefaultTimerDraft: Dispatch<SetStateAction<string>>;
    setExpandedTimerOpen: Dispatch<SetStateAction<boolean>>;
    startNumberInputDrag: (
      event: PointerEvent<HTMLElement>,
      field: NumberInputDragField,
      value: number,
    ) => void;
    startSidebarGroupPointerDrag: (
      event: PointerEvent<HTMLButtonElement>,
      groupName: string,
    ) => void;
    startSidebarPointerDrag: (
      event: PointerEvent<HTMLButtonElement>,
      drag: InternalButtonDrag,
    ) => void;
    toggleGroupCollapsed: (groupName: string) => void;
    toggleMiniMode: () => Promise<void>;
    togglePause: () => void;
    updateNumberInputDrag: (event: PointerEvent<HTMLElement>) => void;
    updateSidebarGroupPointerDrag: (event: PointerEvent<HTMLButtonElement>) => void;
    updateSidebarPointerDrag: (event: PointerEvent<HTMLButtonElement>) => void;
  };
  data: {
    activeTimer: ActiveTimer | null;
    activeTimerProject: LauncherProject | undefined;
    collapsedGroups: Record<string, boolean>;
    completionPrompt: TimerCompletionPrompt | null;
    config: AppConfig;
    defaultTimerDraft: string;
    miniTransitioning: boolean;
    numberInputDragging: NumberInputDragField | null;
    pendingActionId: string | null;
    shortcutRegistration: ShortcutRegistrationStatus | null;
    sidebarGroupPointerDrag: SidebarGroupDragPreview | null;
    sidebarPointerDrag: SidebarDragPreview | null;
    timerClock: string;
    timerProgressPercent: number | null;
    timerStatus: string;
    visibleGroups: Array<{ name: string; buttons: LauncherButton[] }>;
  };
  expandTimerButtonRef: RefObject<HTMLButtonElement>;
};

export function SidebarQuickLaunch({ actions, data, expandTimerButtonRef }: SidebarQuickLaunchProps) {
  const {
    cancelNumberInputDrag,
    cancelSidebarGroupPointerDrag,
    cancelSidebarPointerDrag,
    finishActiveTimer,
    finishNumberInputDrag,
    finishSidebarGroupPointerDrag,
    finishSidebarPointerDrag,
    openContextMenu,
    openContextMenuFromKeyboard,
    openDictionaryManually,
    renderSidebarButtonIcon,
    runActions,
    saveDefaultTimerMinutes,
    setDefaultTimerDraft,
    setExpandedTimerOpen,
    startNumberInputDrag,
    startSidebarGroupPointerDrag,
    startSidebarPointerDrag,
    toggleGroupCollapsed,
    toggleMiniMode,
    togglePause,
    updateNumberInputDrag,
    updateSidebarGroupPointerDrag,
    updateSidebarPointerDrag,
  } = actions;
  const {
    activeTimer,
    activeTimerProject,
    collapsedGroups,
    completionPrompt,
    config,
    defaultTimerDraft,
    miniTransitioning,
    numberInputDragging,
    pendingActionId,
    shortcutRegistration,
    sidebarGroupPointerDrag,
    sidebarPointerDrag,
    timerClock,
    timerProgressPercent,
    timerStatus,
    visibleGroups: visibleSidebarButtonGroups,
  } = data;
  return (
<aside
  className="sidebar"
  onContextMenu={(event) => {
    event.preventDefault();
    openContextMenu(
      { kind: "sidebar" },
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
  }}
  onKeyDown={(event) => openContextMenuFromKeyboard(event, { kind: "sidebar" })}
  tabIndex={-1}
>
  <button
    className="launcherOpenButton"
    onClick={() => void openDictionaryManually()}
    type="button"
  >
    <span className="launcherOpenButtonLabel">
      <span aria-hidden="true" className="launcherOpenButtonIcon">
        <UiIcon name="search" size={16} />
      </span>
      <span>辞書を開く</span>
    </span>
    {shortcutRegistration && (
      <ShortcutBadge
        label="辞書"
        shortcut={config?.settings.launcherHotkey}
        registered={shortcutRegistration.launcher}
      />
    )}
  </button>

  <div className="quickList app-scrollbar" aria-label="クイック起動">
    {visibleSidebarButtonGroups.length === 0 ? (
      <p className="quietText quietText--small">
        サイドバー表示の項目がありません。アプリ、ショートカット、URLをドラッグして追加できます。
      </p>
    ) : (
      visibleSidebarButtonGroups.map((group) => {
        const collapsed = collapsedGroups[group.name] ?? false;
        // P10-02: while a sidebar drag is in flight the open/close is instant (D33).
        const sidebarDragActive =
          sidebarPointerDrag !== null || sidebarGroupPointerDrag !== null;
        return (
          <section
            className={[
              "quickGroup",
              sidebarGroupPointerDrag?.group === group.name ? "quickGroup--dragging" : "",
              sidebarGroupPointerDrag?.targetGroupName === group.name
                ? sidebarGroupPointerDrag.placement === "after"
                  ? "quickGroup--drop-after"
                  : "quickGroup--drop-before"
                : "",
              sidebarPointerDrag?.targetGroupName === group.name &&
              !sidebarPointerDrag.targetButtonId
                ? "quickGroup--item-drop-target"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-sidebar-group-section={group.name}
            key={group.name}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openContextMenu(
                { kind: "sidebar", groupName: group.name },
                event.clientX,
                event.clientY,
                event.currentTarget.querySelector<HTMLElement>(".quickGroupHeader"),
              );
            }}
          >
            <button
              aria-expanded={!collapsed}
              className="quickGroupHeader"
              data-sidebar-group-name={group.name}
              onClick={(event) => {
                if (event.detail === 0) toggleGroupCollapsed(group.name);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openContextMenu(
                  { kind: "sidebar", groupName: group.name },
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                );
              }}
              onKeyDown={(event) =>
                openContextMenuFromKeyboard(event, {
                  kind: "sidebar",
                  groupName: group.name,
                })
              }
              onPointerCancel={cancelSidebarGroupPointerDrag}
              onPointerDown={(event) => startSidebarGroupPointerDrag(event, group.name)}
              onPointerMove={updateSidebarGroupPointerDrag}
              onPointerUp={(event) => finishSidebarGroupPointerDrag(event, group.name)}
              title={group.name}
              type="button"
            >
              <UiIcon name={collapsed ? "chevronRight" : "chevronDown"} size={16} />
              <strong>{group.name}</strong>
              <small>{group.buttons.length}</small>
            </button>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  animate={{
                    height: "auto",
                    opacity: 1,
                    transitionEnd: { overflow: "visible" },
                  }}
                  className="quickGroupItems"
                  data-sidebar-group-name={group.name}
                  exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                  initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                  key="items"
                  transition={sidebarDragActive ? { duration: 0 } : springCollapse}
                >
                  {group.buttons.length === 0 && (
                    <p className="quickGroupEmpty">見出しを右クリックしてボタンを追加</p>
                  )}
                  {group.buttons.map((button, buttonIndex) => (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className={
                        sidebarPointerDrag?.id === button.id
                          ? "quickButtonDrag quickButtonDrag--dragging"
                          : "quickButtonDrag"
                      }
                      data-sidebar-button-id={button.id}
                      data-sidebar-group-name={group.name}
                      exit={sidebarDragActive ? { opacity: 1 } : { opacity: 0 }}
                      initial={sidebarDragActive ? false : { opacity: 0, y: -4 }}
                      key={button.id}
                      transition={
                        sidebarDragActive
                          ? { duration: 0 }
                          : {
                              delay: Math.min(buttonIndex * staggerStep, staggerMax),
                              duration: 0.12,
                            }
                      }
                    >
                    <button
                      className="quickButton"
                      onClick={(event) => {
                        if (event.detail === 0) void runActions(button.id, button.actions);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openContextMenu(
                          { kind: "button", button },
                          event.clientX,
                          event.clientY,
                          event.currentTarget,
                        );
                      }}
                      onKeyDown={(event) =>
                        openContextMenuFromKeyboard(event, { kind: "button", button })
                      }
                      onPointerCancel={cancelSidebarPointerDrag}
                      onPointerDown={(event) =>
                        startSidebarPointerDrag(event, { id: button.id, group: group.name })
                      }
                      onPointerMove={updateSidebarPointerDrag}
                      onPointerUp={(event) => finishSidebarPointerDrag(event, button)}
                      title={button.label}
                      type="button"
                    >
                      {pendingActionId === button.id ? (
                        <span className="quickIcon">
                          <span className="spinner spinner--small" />
                        </span>
                      ) : (
                        renderSidebarButtonIcon(button)
                      )}
                      <span>{button.label}</span>
                    </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })
    )}
  </div>

  {sidebarPointerDrag?.targetIndicator ? (
    <div
      aria-hidden="true"
      className="sidebarDropIndicator"
      style={{
        left: sidebarPointerDrag.targetIndicator.left,
        top: sidebarPointerDrag.targetIndicator.top,
        width: sidebarPointerDrag.targetIndicator.width,
      }}
    />
  ) : null}

  {sidebarPointerDrag
    ? (() => {
        const button = config.buttons.find((item) => item.id === sidebarPointerDrag.id);
        return button ? (
          <div
            aria-hidden="true"
            className="sidebarDragGhost"
            style={{
              height: sidebarPointerDrag.height,
              left: sidebarPointerDrag.pointerX - sidebarPointerDrag.offsetX,
              top: sidebarPointerDrag.pointerY - sidebarPointerDrag.offsetY,
              width: sidebarPointerDrag.width,
            }}
          >
            {renderSidebarButtonIcon(button)}
            <span>{button.label}</span>
          </div>
        ) : null;
      })()
    : null}
  {sidebarGroupPointerDrag ? (
    <div
      aria-hidden="true"
      className="sidebarGroupDragGhost"
      style={{
        height: sidebarGroupPointerDrag.height,
        left: sidebarGroupPointerDrag.pointerX - sidebarGroupPointerDrag.offsetX,
        top: sidebarGroupPointerDrag.pointerY - sidebarGroupPointerDrag.offsetY,
        width: sidebarGroupPointerDrag.width,
      }}
    >
      <UiIcon name="chevronDown" size={16} />
      <strong>{sidebarGroupPointerDrag.group}</strong>
    </div>
  ) : null}
  <TimerPanel
    active={Boolean(activeTimer)}
    expandButtonRef={expandTimerButtonRef}
    clock={
      activeTimer
        ? timerClock
        : String(
            Number.parseInt(defaultTimerDraft, 10) || config.settings.defaultTimerMinutes,
          ) + "分"
    }
    clockAdjustable={!activeTimer}
    clockDragging={numberInputDragging === "timer"}
    identity={
      activeTimerProject ? (
        <ProjectIdentity
          colorId={activeTimerProject.colorId}
          compact
          name={activeTimerProject.name}
          projectId={activeTimerProject.id}
        />
      ) : undefined
    }
    actionText={activeTimer ? timerActionText(activeTimer) : undefined}
    label={activeTimer ? activeTimer.label : "通常タイマー"}
    onFinish={() => {
      if (activeTimer) finishActiveTimer(activeTimer);
    }}
    onExpand={() => setExpandedTimerOpen(true)}
    onClockPointerCancel={!activeTimer ? cancelNumberInputDrag : undefined}
    onClockPointerDown={
      !activeTimer
        ? (event) => startNumberInputDrag(event, "timer", config.settings.defaultTimerMinutes)
        : undefined
    }
    onClockPointerMove={!activeTimer ? updateNumberInputDrag : undefined}
    onClockPointerUp={!activeTimer ? finishNumberInputDrag : undefined}
    onPause={togglePause}
    paused={Boolean(activeTimer?.paused)}
    progressPercent={timerProgressPercent}
    state={
      completionPrompt
        ? "complete"
        : activeTimer?.paused
          ? "paused"
          : activeTimer
            ? "running"
            : "waiting"
    }
    status={timerStatus}
    variant="sidebar"
    onMini={() => void toggleMiniMode()}
    miniDisabled={!config.settings.miniMode || miniTransitioning}
    waitingContent={
      <div className="timerPresetControls" aria-label="通常タイマーの分数">
        <div className="timerPresetRow">
          <button
            className="timerPresetButton"
            onClick={() =>
              void saveDefaultTimerMinutes(config.settings.defaultTimerMinutes - 5)
            }
            type="button"
          >
            -
          </button>
          <label
            className={
              numberInputDragging === "timer"
                ? "timerPresetInputWrap timerPresetInputWrap--dragging"
                : "timerPresetInputWrap"
            }
            onPointerCancel={cancelNumberInputDrag}
            onPointerDown={(event) =>
              startNumberInputDrag(event, "timer", config.settings.defaultTimerMinutes)
            }
            onPointerMove={updateNumberInputDrag}
            onPointerUp={finishNumberInputDrag}
            title="上下にドラッグして分数を調整"
          >
            <input autoComplete="off"
              aria-label="通常タイマーの分数"
              inputMode="numeric"
              max={240}
              min={1}
              onBlur={() => void saveDefaultTimerMinutes(defaultTimerDraft)}
              onChange={(event) => setDefaultTimerDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              type="number"
              value={defaultTimerDraft}
            />
            <span>分</span>
            <span aria-hidden="true" className="numberDragAffordance" />
          </label>
          <button
            className="timerPresetButton"
            onClick={() =>
              void saveDefaultTimerMinutes(config.settings.defaultTimerMinutes + 5)
            }
            type="button"
          >
            +
          </button>
        </div>
      </div>
    }
  />
</aside>
  );
}
