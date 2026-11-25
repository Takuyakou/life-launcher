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
| `weekly-planning.png` | Plan this week tab of Records, 1366 x 768 | PASS - synthetic projects, records, and completed items only |
| `demo-start.gif` | Starting the current step for 5 minutes and leaving a “Resume here” note, 960 x 570 | PASS - synthetic public fixture only; assembled by the lead from Playwright frames |
| `contact-sheet.png` | Combined Windows product review sheet | PASS - contains only the three Windows product images above |
| `web-demo.png` | Web Demo landing page (W21 update), first screen of the public site, 1440 x 900 | PASS - synthetic public landing page only |

The Windows screenshot test fixes the date and time, installs a Tauri API mock before navigation, disables animation and caret rendering, uses a dedicated local Vite port, and never reads real application data. The weekly planning image is captured with reduced motion so the counters show their final values.

The Windows images were regenerated for the v1.1 README update. `web-demo.png` shows the Web Demo landing page rather than a dashboard crop. It was recaptured for W21 from the public site (https://life-launcher-web.takuyakou.workers.dev/) at 1440 x 900 with the page left on its first screen, after the W21 landing page and demo rebuild in [Takuyakou/life-launcher-web](https://github.com/Takuyakou/life-launcher-web) was released.
