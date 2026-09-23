export type GroupMode = "existing" | "new";

type GroupModeFieldProps = {
  groupMode: GroupMode;
  groups: string[];
  existingGroup: string;
  newGroup: string;
  onGroupModeChange: (mode: GroupMode) => void;
  onExistingGroupChange: (group: string) => void;
  onNewGroupChange: (group: string) => void;
};

export function GroupModeField({
  groupMode,
  groups,
  existingGroup,
  newGroup,
  onGroupModeChange,
  onExistingGroupChange,
  onNewGroupChange,
}: GroupModeFieldProps) {
  return (
    <div className="fieldStack">
      <span>グループ</span>
      <div aria-label="グループの指定方法" className="dropGroupMode">
        <button
          aria-pressed={groupMode === "existing"}
          onClick={() => onGroupModeChange("existing")}
          type="button"
        >
          既存から選ぶ
        </button>
        <button
          aria-pressed={groupMode === "new"}
          onClick={() => onGroupModeChange("new")}
          type="button"
        >
          新規グループを作成
        </button>
      </div>
      {groupMode === "existing" ? (
        <select
          aria-label="既存のグループ"
          className="textInput"
          onChange={(event) => onExistingGroupChange(event.target.value)}
          value={existingGroup}
        >
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label="新しいグループ名"
          className="textInput"
          onChange={(event) => onNewGroupChange(event.target.value)}
          placeholder="例: 資料"
          value={newGroup}
        />
      )}
    </div>
  );
}
