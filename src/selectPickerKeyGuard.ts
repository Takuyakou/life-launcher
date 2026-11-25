// 選ぶ欄(select)の一覧を開いている間のキーは、一覧だけが受け取る(v1.6.4)。
// appearance: base-select の一覧は、Esc や矢印のキーがページにも届く。そのままだと、
// Esc で一覧と一緒にダイアログまで閉じたり、矢印でアプリのキーボード移動が動いたりする。
// 前の Windows の一覧(ページにキーが届かない)と同じにするため、開いている間は伝わりを止める。
// 一覧を閉じる・選ぶ・動くのはブラウザーのふだんの動き(既定の動作)なので、止めない。

function isInsideOpenSelect(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const select = target.closest("select");
  if (!select) return false;
  try {
    return select.matches(":open");
  } catch {
    // :open を知らない古い WebView2 は Windows の一覧を使うので、キーはページに届かない。
    return false;
  }
}

export function installSelectPickerKeyGuard(target: Window = window): () => void {
  const stopWhileOpen = (event: KeyboardEvent) => {
    if (isInsideOpenSelect(event.target)) event.stopPropagation();
  };
  target.addEventListener("keydown", stopWhileOpen, true);
  target.addEventListener("keyup", stopWhileOpen, true);
  return () => {
    target.removeEventListener("keydown", stopWhileOpen, true);
    target.removeEventListener("keyup", stopWhileOpen, true);
  };
}
