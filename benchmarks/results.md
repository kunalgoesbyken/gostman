# Benchmark results

Measured on 2026-10-24 with the scripts in this folder. Only Gostman was measured; no other app is compared here.

## Machine

- CPU: Intel Core i5-9300H, 2.40 GHz, 4 cores, 8 threads
- RAM: 15.8 GB
- Disk: NVMe SSD, Kingston OM8PCP3512F-AI1
- Windows 11 Home, build 26300
- WebView2 runtime: 155.0.4283.62
- Power: Balanced plan, on AC
- The machine was running other build jobs at the same time, often at 100% CPU. The before and after pairs ran under the same load.

## Desktop app

`bench.ps1 -Apps Gostman -Runs 5 -SettleSeconds 15 -DataDir <empty folder>`, then the same with `-Workspace` pointing at a folder made by `go run ./workspacegen -out <folder>` (5,000 requests in 258 folders). The binary is `gostman-gui\build\bin\Gostman.exe` as it was on the machine (file version 1.6.0, built 2026-10-23), so it does not contain the changes listed under "Web app" and "Workspace loading". `-DataDir` kept it away from the real app data.

| Case | Binary size | Start to window (median) | Start runs | Working set (median) | Private bytes (median) | Processes |
|---|---|---|---|---|---|---|
| Sample data | 23.7 MB | 1,071 ms | 1,526 / 1,071 / 1,202 / 1,056 / 1,037 ms | 402.9 MB | 207.7 MB | 7 |
| 5,000-request folder | 23.7 MB | 9,604 ms | 11,576 / 1,606 / 1,710 / 11,087 / 9,604 ms | 419.8 MB | 222.8 MB | 7 |

- The size is the single exe. The WebView2 runtime is shared by Windows and not counted.
- Working set counts memory shared between the WebView2 processes more than once; private bytes undercount shared code.
- With the large folder the window appears only after the folder is read, which is what makes those starts slow and uneven. See "Workspace loading".

## Workspace loading

A Go program opened the generated 5,000-request folder with `workspace.Open` and built its collection, six times, alternating the code before and after this change.

| | Runs | Median |
|---|---|---|
| Before | 21.1 / 10.0 / 16.0 / 9.9 / 16.2 / 13.7 s | 14.8 s |
| After | 3.1 / 12.9 / 3.8 / 8.1 / 4.3 / 6.4 s | 5.4 s |

On a quieter moment earlier the same day, the old code took 38.4 s on the first open after the files were written and 2.5 s and 2.4 s on the next two. A CPU profile of the old code put 26% of the time in checking every parent folder again for each file, 33% in file metadata calls overall, and 16% in matching every request against every folder when the collection is listed.

## Web app

`node web-bench.mjs --runs 3 --data <workspace.json>` against two production builds of the web app served by `vite preview`: "Before" is the working tree without this change, "After" with it. Browser: headless Chromium 153.0.8010.12 at 1600 by 1000. Each value is the median of 3 runs.

| Metric | Before | After |
|---|---|---|
| First tree row, first visit with sample data | 424 ms | 454 ms |
| First tree row after reload with 5,000 requests | 371 ms | 350 ms |
| JS heap, sample data | 5.0 MB | 5.1 MB |
| JS heap, 5,000 requests | 9.2 MB | 9.6 MB |
| Tree rows in the DOM, of 5,258 | 33 | 33 |
| Tree scroll, median / 95th percentile / longest frame | 7.0 / 10.0 / 20.1 ms | 6.9 / 10.5 / 46.5 ms |
| Tree search "item 49" / "e" / clear | 21 / 39 / 11 ms | 24 / 35 / 9 ms |
| 20 MB JSON response: Send to status shown | 1,094 ms | 874 ms |
| 20 MB JSON response: longest frame while rendering | 271 ms | 90 ms |
| 20 MB JSON response: JS heap after rendering | 60.9 MB | 35.7 MB |
| 20 MB JSON response: DOM nodes | 16,113 | 934 |
| Format anyway, until formatted text shows | not offered | 524 ms, longest frame 76 ms |
| Find `user4999@` (one match, 938,071 characters in) | not found, longest frame 562 ms | found in 230 ms, longest frame 7 ms |

- The collection tree was already windowed before this change, so its numbers stay level. Before, only the first 500,000 characters of a body were shown or searched, which is why the search found nothing.
- The 20 MB body is one line of minified JSON.

One further check was run by hand in the same builds with Playwright: a 3.2 MB JSON body of 60,000 lines pasted into the request body editor. In the Before build the first key press after the paste returned after 82.8 s; in the After build after 12 ms, and later key presses took 12 to 46 ms in both.

## File attachments

A Go program sent a 300 MB file through the engine as a multipart part and as a File body to a local server that hashed what it received. Both arrived complete (matching SHA-256) in 1.5 s and 1.1 s, and the engine allocated about 1 MB while sending. Before this change an attachment was held in the request as base64 and limited to 5 MB.

## Script runtime in `gostman run` (2026-10-25)

Same machine, again with other jobs keeping the CPU near 100%, so the spread is wide. A local Go server on 127.0.0.1 answered every request with a small JSON body. Three folder workspaces of 400 GET requests each: no checks, one `res.status equals 200` check per request, and one post-response script per request (`test(...)` with `expect`, plus writes to `globalThis` and `Object.prototype`). Each was run 5 times with `gostman run <folder>`, before and after interleaved; wall time includes process start and loading the folder.

| Collection | Before, median (min) | After, median (min) | CPU time, before / after (median) |
|---|---|---|---|
| No checks | 909 (638) ms | 615 (556) ms | 1,234 / 1,125 ms |
| One check per request | 3,913 (3,271) ms | 1,201 (1,044) ms | 6,391 / 2,109 ms |
| One script per request | 3,602 (3,112) ms | 2,040 (1,789) ms | 6,562 / 7,969 ms |

- Before, every check or script started a new JavaScript runtime from the embedded bundle: 4.4 MB allocated per request. Checks run no user code, so they now run in the session's shared runtime; the check collection allocates 455 MB instead of 1,746 MB.
- Scripts still get a fresh runtime each, so nothing leaks from one script to the next (the script collection checks this on every request). Up to four runtimes are now started in the background ahead of time, so the CPU time stays the same but is spread over more cores.
- In a quieter moment the same binary ran the check collection in 579 ms and the script collection in 1,263 ms.

## Web app budgets (2026-10-25)

Production build of the web app served by `vite preview`, headless Chromium 153.0.8010.12 at 1600 by 1000, driven by Playwright. "Before" is the build without the changes below, "After" with them; each row gives the range over two to five runs. Keystroke and dialog times come from the Event Timing API (time from the input to the next paint) and from the click to the second animation frame after the dialog is in the page.

| Measure | Before | After |
|---|---|---|
| First load of `/web`, until the URL field shows | 259 to 882 ms (median 394) | 334 to 457 ms (median 391) |
| First tree row after reload with 5,000 requests | 178 to 310 ms | 175 to 361 ms |
| Tree scroll, 95th percentile frame | 17.8 to 24.8 ms | 17.8 to 23.3 ms |
| Tree search "item 49", slowest keystroke | 72 to 152 ms | 48 to 88 ms |
| URL field, slowest keystroke | 32 ms | 32 ms |
| 100 KB JSON body, slowest keystroke | 32 to 48 ms | 32 to 64 ms |
| 3 MB JSON body, slowest keystroke | 40 to 48 ms | 32 to 48 ms |
| 1 MB JSON response, network done to body shown | 40 to 63 ms | 42 to 64 ms |
| Dialogs, second and third open (Preferences, Import, Environments, Runner) | 27 to 113 ms | 25 to 197 ms |
| Runner, 100 requests with one check each | 3,607 to 8,540 ms | 1,134 to 1,572 ms |
| Runner, 100 requests without checks | 1,230 to 2,517 ms | 1,001 to 2,308 ms |

- The tree search no longer folds the name, URL and tags of every request on each keystroke, and the filtered list renders as a deferred update, so typing is not held up by it.
- The runner change: a stage with checks and no script used to start a new script worker per request; idle check workers are now reused. Scripts still get a new worker each.
- A 1 MB body opens as plain text; Format anyway took 23 to 39 ms.
- The one dialog value over 150 ms (Runner, 197 ms) came from a run where every other measure was slow too; in four further runs of the After build the second and third opens stayed between 27 and 63 ms.

## Workspace folder opening (2026-10-25)

`workspace.Open` and `Collection()` on the 5,000-request folder from `workspacegen`, three opens per process. Warm opens took 541 ms to 2.3 s. The first open in a process after about 20 minutes away from the folder took 24.4 s and 16.2 s; a CPU profile of that open put 87% of the time in opening files (`CreateFile`), with at most 8 files of one folder read at a time.

After the change, one bounded pool (twice the CPU count, between 4 and 32 readers; 16 on this 8-core machine) lists the folders and reads the folder and request files of the whole tree, and the folder is still assembled in the same order, so requests, ids and problems come out exactly as before (compared byte for byte on the 5,000-request folder and on a folder with broken files, duplicate ids, a junction and folders nested past the depth limit). Same machine, other jobs keeping the CPU busy:

| Open | Before | After |
|---|---|---|
| Warm, 6 processes with 3 opens each, interleaved | 570 to 1,154 ms (median 782) | 476 to 1,117 ms (median 575) |
| First open of a folder written 25 minutes earlier and left alone (one folder per open, interleaved) | 14,896 / 11,560 / 10,070 ms | 11,560 / 8,869 / 6,310 ms |
| Second open in the same process | 654 / 857 / 463 ms | 631 / 510 / 376 ms |

A second round of the 25-minute test did not give a usable comparison: the first folder took 12.8 s (before), the next 30.6 s (after), and the four after that 1.2 to 1.7 s whichever code opened them, so something else on the machine had read them in the meantime.

## Scripts in the web runner (2026-10-25)

Production builds of the web app served by `vite preview`, headless Chromium 153.0.8010.12 at 1400 by 950, driven by Playwright; other jobs kept the CPU busy, so the spread is wide. A local Go server answered every request through a local `cmd/local` proxy. The collection: 30 GET requests in one folder, each with a pre-request and a post-response script, and the folder with one of each too, so four script stages per request. "Before" is the build without the worker pool, "After" with it, run interleaved.

| Measure | Before | After |
|---|---|---|
| Run of the 30 requests (6 runs each) | 3,925 to 4,227 ms (median 4,074) | 1,691 to 3,681 ms (median 2,250) |
| Send of one request, first in the page (3 pages each) | 281 / 332 / 502 ms | 184 / 228 / 270 ms |
| Send of one request, the next five sends (15 each) | 145 to 893 ms (median 370) | 58 to 238 ms (median 86) |

- Starting a sandbox worker and running a small script took 16 to 29 ms; in a worker started 300 ms earlier the same script took 2 to 3 ms.
- Every script still runs in a worker no other script has used, and the worker is terminated afterwards. A few workers are now started ahead of time (the runner's parallel setting plus one, at most four) and dropped after 30 seconds with nothing running. A worker that timed out or failed is never handed out again.

## Raw data

The JSON files written by the scripts were kept outside the repository: `results-20261024-210338.json` (sample data), `results-20261024-210900.json` (5,000-request folder), `web-before.json` and `web-after.json`.
