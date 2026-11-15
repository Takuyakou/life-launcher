import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { UiIcon } from "./UiIcon";

type FirstRunBandProps = {
  shortTimerMinutes: number;
  saving: boolean;
  onStart: (projectName: string, stepText: string) => void;
  onLater: () => void;
  onOpenImport: () => void;
  onCopyPrompt: () => Promise<void>;
};

const EXAMPLE_PROJECTS = ["運動", "部屋の片付け", "読書"];

/**
 * P10-11 (§8.2): the first-run guide shown instead of the main screen while the config is empty
 * and has no `firstRunDoneAt`.
 */
export function FirstRunBand({
  shortTimerMinutes,
  saving,
  onStart,
  onLater,
  onOpenImport,
  onCopyPrompt,
}: FirstRunBandProps) {
  const [projectName, setProjectName] = useState("");
  const [stepText, setStepText] = useState("");
  const ready = projectName.trim().length > 0 && stepText.trim().length > 0;

  return (
    <section aria-labelledby="first-run-title" className="firstRunBand">
      <div className="firstRunHero">
        <h1 id="first-run-title">まず、1つだけ始めましょう</h1>
        <p>
          予定は立てません。続けたいことを1つ決めて、5分だけやってみます。あとから全部変えられます。
        </p>
      </div>

      <div className="firstRunField">
        <label className="firstRunFieldLabel" htmlFor="first-run-project">
          <span aria-hidden="true" className="firstRunStepNumber">
            1
          </span>
          続けたいこと
        </label>
        <input
          autoFocus
          className="textInput firstRunInput"
          id="first-run-project"
          maxLength={48}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="例: 英語"
          type="text"
          value={projectName}
        />
        <div className="firstRunExamples">
          <span>たとえば</span>
          {EXAMPLE_PROJECTS.map((example) => (
            <button
              className="firstRunExample"
              key={example}
              onClick={() => setProjectName(example)}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="firstRunField">
        <label className="firstRunFieldLabel" htmlFor="first-run-step">
          <span aria-hidden="true" className="firstRunStepNumber">
            2
          </span>
          最初の一手
        </label>
        <input
          className="textInput firstRunInput"
          disabled={!projectName.trim()}
          id="first-run-step"
          maxLength={120}
          onChange={(event) => setStepText(event.target.value)}
          placeholder="例: 英語の動画を1本見る"
          type="text"
          value={stepText}
        />
        <span className="firstRunHint">
          「〜する」で終わる、今すぐ始められる大きさにします。迷ったら、思ったより小さく
        </span>
      </div>

      <div className="firstRunField">
        <span className="firstRunFieldLabel">
          <span aria-hidden="true" className="firstRunStepNumber">
            3
          </span>
          始める
        </span>
        <div className="firstRunStartActions">
          <button
            className="mainActionButton mainActionButton--positive firstRunStartButton"
            disabled={!ready || saving}
            onClick={() => onStart(projectName.trim(), stepText.trim())}
            type="button"
          >
            <UiIcon name="play" size={16} />
            {shortTimerMinutes}分で始める
          </button>
          <button
            className="firstRunLaterButton"
            disabled={saving}
            onClick={onLater}
            type="button"
          >
            あとで始める
          </button>
        </div>
      </div>

      <div className="firstRunImport">
        <div className="firstRunImportCopy">
          <strong>やりたいことがたくさんある人は</strong>
          <span>ChatGPT や Claude に組み立ててもらい、まとめて取り込めます</span>
        </div>
        <CopyButton label="プロンプトをコピー" onCopy={onCopyPrompt} />
        <button className="firstRunImportOpen" onClick={onOpenImport} type="button">
          まとめて取り込むを開く
        </button>
      </div>
    </section>
  );
}
