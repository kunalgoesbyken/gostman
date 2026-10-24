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

## Raw data

The JSON files written by the scripts were kept outside the repository: `results-20261024-210338.json` (sample data), `results-20261024-210900.json` (5,000-request folder), `web-before.json` and `web-after.json`.
