import type {
  Dispatch,
  KeyboardEvent,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
import type { CompletionFeedback } from "../app/dashboardTypes";
import { UiIcon } from "./UiIcon";

// V164-A1: the date and the victory condition row, moved out of App.tsx
// (same DOM, text and handlers).

export type MainHeaderVictoryBandProps = {
  actions: {
    applyVictorySuggestion: (text: string) => void;
    clearVictoryAutoFocus: (event: { currentTarget: HTMLElement }) => void;
    enterVictoryEditing: () => void;
    handleVictoryKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    leaveVictoryEditing: () => void;
    toggleVictoryDone: () => void;
    updateVictoryText: (text: string) => Promise<boolean>;
  };
  completionFeedback: CompletionFeedback | null;
  dateMain: string;
  dateWeekday: string;
  done: boolean;
  editing: boolean;
  refs: {
    input: RefObject<HTMLInputElement>;
    navigation: RefObject<HTMLButtonElement>;
    save: MutableRefObject<Promise<boolean> | null>;
    suggestions: RefObject<HTMLDivElement>;
  };
  setEditing: Dispatch<SetStateAction<boolean>>;
  suggestions: string[];
  text: string;
  /** The stored text, untrimmed (`config.today.victory.text`). */
  value: string;
};

export function MainHeaderVictoryBand({
  actions,
  completionFeedback,
  dateMain,
  dateWeekday,
  done,
  editing,
  refs,
  setEditing,
  suggestions,
  text,
  value,
}: MainHeaderVictoryBandProps) {
  const {
    applyVictorySuggestion,
    clearVictoryAutoFocus,
    enterVictoryEditing,
    handleVictoryKeyDown,
    leaveVictoryEditing,
    toggleVictoryDone,
    updateVictoryText,
  } = actions;
  return (
    <div className="mainHeaderRow">
      <div className="mainHeaderDate">
        <span className="mainDateText">{dateMain}</span>
        <span className="mainDateWeekday">{dateWeekday}</span>
      </div>
      <div className="victoryBarWrap">
        <section
          className={[
            "victoryBar",
            done ? "victoryBar--done" : "",
            text ? "" : "victoryBar--empty",
            completionFeedback?.kind === "victory" ? "victoryBar--reward" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="今日の勝利条件"
        >
          {completionFeedback?.kind === "victory" && (
            <span aria-hidden="true" className="victoryRewardSweep" />
          )}
          <span className="victoryIcon" aria-hidden="true">
            <UiIcon name="flag" size={16} />
          </span>
          <span className="victoryLabel">今日の勝利条件</span>
          <div className="victoryContent">
            {editing ? (
              <>
                <input autoComplete="off"
                  aria-label="今日の勝利条件"
                  className={done ? "victoryInput victoryInput--done" : "victoryInput"}
                  maxLength={90}
                  onBlur={(event) => {
                    const next = event.relatedTarget;
                    if (next instanceof Node && refs.suggestions.current?.contains(next)) {
                      return;
                    }
                    setEditing(false);
                  }}
                  onChange={(event) => {
                    refs.save.current = updateVictoryText(event.target.value);
                  }}
                  onKeyDown={handleVictoryKeyDown}
                  placeholder="今日はこれができれば勝ち"
                  ref={refs.input}
                  value={value}
                />
              </>
            ) : (
              <button
                aria-label="今日の勝利条件を編集"
                className={
                  done
                    ? "victoryTextButton victoryTextButton--done"
                    : text
                      ? "victoryTextButton"
                      : "victoryTextButton victoryTextButton--empty"
                }
                onBlur={clearVictoryAutoFocus}
                onClick={enterVictoryEditing}
                onKeyDown={clearVictoryAutoFocus}
                ref={refs.navigation}
                type="button"
              >
                {value || "今日はこれができれば勝ち"}
              </button>
            )}
          </div>
          {done ? (
            <span
              className={
                completionFeedback?.kind === "victory"
                  ? "victoryBadge victoryBadge--reward"
                  : "victoryBadge"
              }
              role={completionFeedback?.kind === "victory" ? "status" : undefined}
            >
              ✓ 今日の勝利、達成
            </span>
          ) : null}
          <input
            aria-label="勝利条件を達成"
            checked={done}
            className="check victoryCheck"
            disabled={!text}
            onChange={toggleVictoryDone}
            type="checkbox"
          />
        </section>
        {editing && !text && suggestions.length > 0 && (
          <div
            className="victorySuggestions"
            aria-label="勝利条件の候補"
            ref={refs.suggestions}
          >
            {suggestions.map((suggestion) => (
              <button
                className="suggestionChip"
                key={suggestion}
                onBlur={(event) => {
                  const next = event.relatedTarget;
                  if (
                    next instanceof Node &&
                    (next === refs.input.current || refs.suggestions.current?.contains(next))
                  ) {
                    return;
                  }
                  setEditing(false);
                }}
                onClick={() => applyVictorySuggestion(suggestion)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    leaveVictoryEditing();
                  }
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
