# Benchmarks

`bench.ps1` measures how heavy each API client is on a Windows machine. It compares Gostman with Postman and Bruno (Insomnia and Hoppscotch are optional). It never downloads or installs anything, and it kills every process it launches.

## What is measured

| Metric | How |
|---|---|
| Installed size | Recursive size of the install folder. A lone portable exe is the file size. Squirrel layouts (`app-x.y.z` next to `Update.exe`) count the whole parent folder. |
| Installer size | Size of the installer file if you pass it with `-InstallerPaths` or it sits in `~\Downloads` and matches a known name. Otherwise it is left blank. |
| Cold start | `Stopwatch` from `Start-Process` until any process in the app's tree has a non-zero `MainWindowHandle` and a non-empty title (polled every 20 ms). Median of `-Runs` (default 5). |
| Idle memory | After the window appears, wait `-SettleSeconds` (default 20), then sum `WorkingSet64` and `PrivateMemorySize64` over the whole process tree (root, children, Electron renderers, WebView2 `msedgewebview2` hosts). Median of `-Runs`. |

## Run

```powershell
# from the benchmarks folder
.\bench.ps1                                   # Gostman, Postman, Bruno; 5 runs; 20 s settle
.\bench.ps1 -Apps Gostman,Postman,Bruno,Insomnia,Hoppscotch
.\bench.ps1 -Runs 3 -SettleSeconds 10         # quick smoke test
.\bench.ps1 -GostmanPath D:\path\Gostman.exe
.\bench.ps1 -InstallerPaths @{ Postman='C:\dl\Postman-Setup.exe'; Bruno='C:\dl\bruno-setup.exe' }
```

If execution policy blocks it: `powershell -ExecutionPolicy Bypass -File .\bench.ps1`.

Output goes to the console and to `results-<timestamp>.json` (raw per-run start times, medians, and machine info). Copy numbers into `results.md`.

Apps that are not installed are skipped with an install hint. Winget ids (checked with `winget search`):

- Postman: `winget install --id Postman.Postman -e`
- Bruno: `winget install --id Bruno.Bruno -e`
- Insomnia (optional): `winget install --id Insomnia.Insomnia -e`
- Hoppscotch (optional): `winget install --id hoppscotch.Hoppscotch -e`

Gostman is a portable exe. The script looks in `gostman-gui\build\bin\Gostman.exe`, `%LOCALAPPDATA%\Programs\Gostman` and `Program Files\Gostman`, or use `-GostmanPath`.

`-DataDir` starts Gostman with `APPDATA` pointed at that folder, so it reads and writes none of your own data. Add `-Workspace` to open a folder workspace there, for example one made by the generator below:

```powershell
go run ./workspacegen -out C:\bench\ws5000      # from the benchmarks folder
.\bench.ps1 -Apps Gostman -DataDir C:\bench\data -Workspace C:\bench\ws5000
```

Gostman still shares the system keychain with your real installation. The script never deletes anything; do not use Preferences, Data, Delete all data during a benchmark run.

## Large workspace generator

`workspacegen` writes a collection of generated requests in nested folders, as a YAML workspace folder (`-out`) and as a web app data document (`-json`). The defaults are 5,000 requests and 3 folder levels with 6 subfolders each (258 folders). Requests have tags, headers and JSON bodies, and every URL starts with `-base-url`.

```bash
go run ./benchmarks/workspacegen -out /tmp/ws5000 -json /tmp/ws5000.json -requests 5000 -depth 3 -fanout 6
```

## Web build benchmark

`web-bench.mjs` measures the web build in a headless Chromium through the DevTools protocol. It needs Node 22 or newer and a Chromium or Chrome; nothing is installed. Each run uses a fresh browser profile and measures:

| Metric | How |
|---|---|
| Start to first tree row | `performance.now()` when the first `[role=treeitem]` appears: on the first visit to `/web` (sample data), and again after the generated workspace is put in local storage and the page reloads. |
| Memory | JS heap after a forced garbage collection, the DOM node count and the number of tree rows in the DOM. |
| Tree scroll | The tree is scrolled from top to bottom in 300 steps, one per animation frame. Median, 95th percentile and longest frame. |
| Tree search | Time from typing into the sidebar search to the second animation frame after it. |
| Large response | The benchmark answers `/api/proxy` itself with a generated JSON body (`--json-mb`, default 20). Time from Send until the status shows, and the longest frame while it renders. Then Format anyway, when the build has it, and a search for `user4999@`, which appears once, about 938,000 characters into the default body. |

```bash
cd gostman-gui/frontend && npm run build:web && npx vite preview --config vite.web.config.js --port 3911
node benchmarks/web-bench.mjs --url http://127.0.0.1:3911 --data /tmp/ws5000.json --runs 3 --browser <path to chrome.exe>
```

Edge and Chrome profiles that install extensions by policy can open a tab in front of the page, which stops animation frames in a headless window. Pass a Chromium without such policies with `--browser`, for example the one Playwright downloads. Results go to the console and to the `--out` JSON file.

## Method notes and caveats (read before quoting numbers)

- Run on an otherwise idle machine, on AC power, with the same power plan for every app. Close each app completely first. The script refuses to run an app that is already running.
- "Cold" here means a fresh process start, not a fresh boot. The OS file cache is warm after the first run, so run 1 is usually the slowest. For a true cold figure, reboot and use `-Runs 1`. The JSON keeps every run (`StartMsAll`) so you can report the spread.
- Launch the apps once by hand first, so first-run setup (account prompts, updates, WebView2 or Electron cache creation) is not in the numbers. Apps that open a sign-in or update window before the main one may be timed to that first window. Check this and say so.
- "Visible main window" is a window handle with a title. A splash window with a title counts, which can make an app look faster than it is. Compare against what you see on screen.
- Working set double counts memory shared between processes (common with Chromium and WebView2), so it overstates real RAM use. Private bytes undercount shared code. Report both, as the script does.
- Gostman and WebView2: the WebView2 runtime is shared system-wide and is not counted in Gostman's installed size, while Electron apps bundle Chromium. State this when comparing sizes.
- Installer size is only comparable if you measure the same kind of artifact (setup exe or MSI, not a zip or a web-installer stub). Postman's and Bruno's downloads are not pinned by this script, so record the version.
- Results depend on versions, hardware and Windows build. Always publish the machine line and app versions with the numbers.
- Do not publish numbers you did not measure yourself.
