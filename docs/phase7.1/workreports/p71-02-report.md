# P71-02 Editor Layout

Base: feature/p71-01-source-edit-sync。マージせずstack。

- Project保存、Wishlist追加/編集のfooterを左保存・右キャンセルへ変更。
- Start Environment Pickerを左選択を反映・右キャンセルへ変更。初期focusは右キャンセル。
- Project/SettingsのTimer入力DOMを短時間→通常へ移動。入力値、継承、単位、step handler、validationはそのまま。
- Project/Wishlistの初期入力focusは既存accessibility conventionを維持。既存の早期完了confirm配置は変更なし。

検証: build PASS。P71テスト8件PASS。1440/860pxのfooter DOM順・Timer順・Picker初期focusとキャンセル・Wishlist追加footerを検査。最終画像目視と全回帰はP71-03に含める。
