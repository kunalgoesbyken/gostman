# Getting started

Gostman runs in the browser, as a desktop app and as a command line. This page shows how to open or install each one, send a first request and find where your data is kept.

## Choose how to run it

- **Browser:** open [gostman.com/web](https://gostman.com/web), paste a URL and press Send. There is nothing to install and no account.
- **Desktop:** download the installer for your system from [Install the desktop app](#install-the-desktop-app). The desktop app reaches local and private addresses and has the settings and features that need the operating system, such as the Git panel and proxy settings.
- **Command line:** run a collection in a script or a CI pipeline with the single `gostman` binary. See [Install the command line](#install-the-command-line).

## Install the desktop app

Download the latest build from the [releases page](https://github.com/kunalgoesbyken/gostman/releases/latest).

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `Gostman-windows-amd64.exe` | Installer with Start menu and desktop shortcuts and an uninstaller. |
| Windows | `Gostman-windows-amd64-portable.exe` | Single executable, no installation. |
| macOS | `Gostman-darwin-universal.dmg` | Intel and Apple Silicon. Drag Gostman to Applications. |
| Linux | `Gostman-linux-amd64.deb` | Debian and Ubuntu. Run `sudo apt install ./Gostman-linux-amd64.deb`. |
| Linux | `Gostman-linux-x86_64.AppImage` | Any distribution. Run `chmod +x Gostman-linux-x86_64.AppImage`, then start it. AppImage managers keep it up to date. |
| Linux | `Gostman-linux-amd64.tar.gz` | Other distributions. Requires GTK 3 and WebKitGTK 4.1. |
| Arch Linux | [`gostman-bin`](https://aur.archlinux.org/packages/gostman-bin) | Community package in the AUR. Install it with an AUR helper, for example `yay -S gostman-bin`. |

The builds are not code-signed yet, so the operating system asks for confirmation the first time:

- **Windows:** SmartScreen shows "Windows protected your PC". Choose **More info**, then **Run anyway**.
- **macOS:** right-click Gostman in Applications, choose **Open**, then confirm.

Windows needs the WebView2 runtime, which ships with Windows 10 and 11. The installer fetches it when it is missing.

## Install the command line

Each release includes `gostman-cli-<os>-<arch>` archives with a single `gostman` binary. With Go installed, you can also build it from source:

```bash
go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest
```

On macOS the binary is not notarized. Run `xattr -d com.apple.quarantine gostman` once. The [command line reference](cli.md) lists every command.

## Send your first request

1. Choose a method, type a URL and press **Send**.
2. Read the response below the request: **Body** in Pretty or Raw, **Headers** and **Cookies**, with the status, time and size beside them.
3. Press **Save** to keep the request in your collection, or **Code** to copy it as code in one of 13 languages, from cURL and Python to C#, Swift and PowerShell.

Next, the [tutorial](tutorial-first-collection.md) takes about fifteen minutes to turn one request into a tested collection with an environment, chained requests and a run from the command line.

![Gostman sending a POST request with a JSON body and showing the pretty-printed response](../gostman-gui/frontend/src/assets/landing/rest.webp)

The first time you open Gostman, the start page lists five **Get started** steps: send a sample request, save it, add a variable in an environment, add a check and run your requests together. Each step has a button that takes you to the right place. Until you finish them, a **Get started** button in the header shows the next step.

From the command line, the same request is:

```bash
gostman send GET https://example.com -H 'Accept: text/html'
```

The pages on [requests and responses](requests-and-responses.md) and [protocols](protocols.md) cover everything the editor can do.

## Where your data is kept

Gostman has no accounts and no cloud sync. Requests, collections and environments stay on your device.

- **Desktop:** in the app data folder, or as plain YAML files in any folder you open with **Open folder**. See [Folders, mock server and capture](workspaces-and-mock.md).
- **Web:** in this browser's IndexedDB, a database the browser gives each site. It can grow to the space the browser allows for the site, usually a share of the free disk space, so large collections and bodies of several megabytes fit. Preferences, the welcome screen and shortcuts stay in local storage. Clearing the site data for gostman.com deletes everything. If the browser has no IndexedDB, as in some private windows, the data stays in local storage, which holds only about 5 MB.

Data saved by an earlier version of the web app in local storage moves to IndexedDB the first time you open the app. The old copy is removed only after the new one has been read back and matches, so closing or reloading the page while it moves loses nothing.

Both make an automatic copy of your data at most once a day and when a new version first starts, keep the last 10, and let you restore one under **Preferences**, **Data**. See [Backups](preferences-and-shortcuts.md#backups).

## What Gostman connects to

Gostman has no telemetry, analytics or crash reporting, in the apps, the command line or the website. Nothing about what you do is sent to the project. Each surface makes these network calls and no others:

| Surface | Network calls |
| --- | --- |
| Desktop app | The hosts you send requests to, including OAuth 2.0 servers and addresses you import from. Git remotes when you use the Git panel. The secret managers you set up. Your AI provider, only while AI is switched on and you use it. `api.github.com` once a day, only if you switch on **Check for new versions**. |
| Command line | The hosts in the collection or on the command line, and the spec addresses you pass to `lint`, `mock --openapi` and `run --contract`. Secret managers only with `--secrets` or `--secrets-env-file`. It never checks for updates. |
| Web app | Requests go through a relay, because browsers cannot call most APIs directly: the hosted relay at `gostman.com/api/proxy` by default, or [a relay on your own computer](cli.md#local-relay-for-the-web-app). WebSocket connections and AI providers are called straight from your browser. |
| Website | The home page shows the project's GitHub star count, read from GitHub through `gostman.com/api/stars`, or from `api.github.com` in your browser when that fails. |

The hosted relay sends your request and returns the answer. It stores neither, and its only log line is written when sending the answer back fails, with that error's text. Vercel, which hosts the site, keeps its standard request logs for the relay, such as the time, the path (for example `/api/proxy?prepare=1`), the status code and the client IP address. The request you send travels in the body of the call, which is not logged. If you would rather nothing went through a third party, use the desktop app, the command line or a local relay.

## Limits of the web version

Browsers cannot call arbitrary APIs directly, so the web version relays requests through a small proxy. The consequences:

- The hosted proxy cannot reach `localhost` or private network addresses. Use the desktop app for local APIs, or start `gostman relay` on your computer and choose it under **Preferences**, **Privacy**; see [Local relay for the web app](cli.md#local-relay-for-the-web-app).
- Proxy, CA certificate and client certificate settings exist only in the desktop app.
- A gRPC stream is collected and shown when it ends. Messages for a client stream are written up front as a JSON array.
- Responses larger than 3 MB are truncated. The desktop app reads up to 50 MB.

## Next steps

- [Tutorial: test an API](tutorial-first-collection.md), about fifteen minutes from an empty collection to a tested one
- [Example collections](../examples/README.md) you can open or run right away
- [What is free in Gostman](free-features.md)
- [Variables](variables.md) and [folder settings](folder-settings.md) to organise a collection
- [Gostman in CI](ci.md) to run it in a pipeline
- [Use from a coding agent](agents.md) to let Claude Code, Codex or Cursor call your API
