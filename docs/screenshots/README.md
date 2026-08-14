# Public Screenshots

The Windows product images in this directory are generated from `tests/visual/fixtures.ts`, a public-only synthetic fixture created from zero for this repository.

Generation command:

```powershell
npm.cmd run screenshot:public
```

| File | View | Inspection |
| --- | --- | --- |
| `main-dashboard.png` | Main dashboard, 1366 x 768 | PASS - synthetic labels and app window only |
| `dictionary.png` | Dictionary, 1000 x 640 | PASS - synthetic launcher entries only |
| `instruction-viewer.png` | Instruction Viewer, 1080 x 680 | PASS - synthetic instruction tree and content only |
| `contact-sheet.png` | Combined Windows product review sheet | PASS - contains only the three Windows product images above |
| `web-demo.png` | Web Demo landing page, 1440 x 900 | PASS - synthetic public landing page only |

The Windows screenshot test fixes the date and time, installs a Tauri API mock before navigation, disables animation and caret rendering, uses a dedicated local Vite port, and never reads real application data.

`web-demo.png` is copied from the public `docs/screenshots/web-demo.png` asset in [Takuyakou/life-launcher-web](https://github.com/Takuyakou/life-launcher-web). That asset is produced and reviewed through the Web Demo repository's Playwright Visual QA workflow.
