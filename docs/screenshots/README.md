# Public Screenshots

All images in this directory are generated from `tests/visual/fixtures.ts`, a public-only synthetic fixture created from zero for this snapshot.

Generation command:

```powershell
npm.cmd run screenshot:public
```

| File | View | Inspection |
| --- | --- | --- |
| `main-dashboard.png` | Main dashboard, 1366 x 768 | PASS - synthetic labels and app window only |
| `dictionary.png` | Dictionary, 1000 x 640 | PASS - synthetic launcher entries only |
| `instruction-viewer.png` | Instruction viewer, 1080 x 680 | PASS - synthetic instruction tree and content only |
| `contact-sheet.png` | Combined review sheet | PASS - contains only the three images above |

The test fixes the date and time, installs a Tauri API mock before navigation, disables animation and caret rendering, uses a dedicated local Vite port, and never reads real application data.