# Preferences, shortcuts and the command palette

This page covers the command palette and its commands, the Preferences dialog, the Keyboard shortcuts dialog and how to change a shortcut, moving around the app with the keyboard alone, the themes, colours and fonts, and the About dialog. Throughout, Ctrl means Command on macOS.

## Command palette

The command palette runs most actions in Gostman from the keyboard.

![The command palette filtered by run, listing Run requests and other matching commands, saved requests and history entries](../screenshots/command-palette.png)

Open it with Ctrl+K, or with the **Commands** button in the header (shown on wide windows). Type to filter, use the up and down arrows to move, press Enter to run the highlighted row and Esc to close it. The **?** button in the palette opens the Keyboard shortcuts dialog.

- Typing searches command names first, then their descriptions and keywords. It also finds saved requests by name, folder, method or URL, and history entries.
- Once you type, results are grouped under **Commands**, **Requests** and **History**. Selecting a request or a history entry opens it in a tab.
- Ctrl+P (**Go to request or history**) opens the palette in a mode that lists requests and history only, with the search box reading `Go to a request or history entry`.
- The palette shows the current shortcut next to a command that has one, including any you changed.

### Commands

| Command | What it does | Shortcut |
| --- | --- | --- |
| **Send request** | Send the request in the current tab | Ctrl+Enter |
| **New request** | Open a new empty tab | Ctrl+N |
| **Save request** | Save the request in the current tab | Ctrl+S |
| **Duplicate request** | Save a copy of the current request | |
| **Copy request** | Copy the saved request to paste it into a folder | |
| **Paste request** | Paste the copied request or folder next to the current request | |
| **Generate code** | Show the current request as code | |
| **Close tab** | Close the current tab | Ctrl+W |
| **Close other tabs** | Keep only the current tab | Alt+Shift+W |
| **Close saved tabs** | Close every tab without unsaved changes | Alt+Shift+S |
| **Keep preview tab open** | Turn the preview tab into a regular tab | Alt+Shift+K |
| **Reopen closed tab** | Bring back the tab you closed last | Ctrl+Shift+T |
| **Toggle sidebar** | Show or hide collections and history | Ctrl+B |
| **Keyboard shortcuts** | See every shortcut | Ctrl+/ |
| **New folder** | Create a folder at the top level | |
| **Collapse all folders** | Close every folder in the sidebar | |
| **Run requests** | Run every request in a folder with its tests | |
| **Request examples** | See the saved responses of the current request | |
| **Mock server** | Serve saved examples on a local port | |
| **Capture traffic** | Forward an app's calls to its API and save them as requests | |
| **Manage cookies** | See and delete stored cookies | |
| **Scan for secrets** | Find credentials typed into requests before you share or commit them | |
| **Preferences** | Theme, colours, fonts, text size, editor, layout and defaults | |
| **Network settings** | Proxy and certificates | |
| **Import data** | Import Postman, OpenAPI or Gostman files | |
| **Lint API spec** | Check the imported OpenAPI spec for problems | |
| **Export data** | Export collections and environments | |
| **Share collection** | Create an encrypted link or file, no account needed | |
| **AI: new request from a description** | Draft a request, shown as a preview you accept | Ctrl+Shift+U |
| **AI: generate assertions and tests** | Propose checks for the last response | |
| **AI: write a script** | Propose a pre-request or post-response script | |
| **AI: explain the response** | Explain a failure and suggest a fix | Ctrl+Shift+X |
| **AI: document this request** | Propose a description for the request | |
| **AI: ask about the collection** | Find requests by describing them | |
| **AI: requests from an API schema** | Turn an OpenAPI or GraphQL schema into requests | |
| **AI settings** | Provider, model, key and consent | |
| **Clear history** | Delete every history entry | |
| **Show welcome** | Getting started steps, imports and shortcuts | |
| **About Gostman** | Version, links and diagnostics | |
| **Reset app** | Delete all data and reload | |

The shortcuts above are the defaults on the desktop app. The web version uses different keys for some of them; see [Default shortcuts](#default-shortcuts). The AI commands are described in [AI features](ai.md). **Run requests**, **Load test this request** and **Scan for secrets** are described in [Running, load testing and scanning](runner-load-and-scan.md). **Manage cookies** and **Network settings** are described in [Secrets and network settings](secrets-and-network.md).

Some commands appear only when they apply:

- **Load test this request** (description: `Send the current request many times at once and measure latency`) appears when load testing is available, which is not the case in the web version.
- **Install app** (`Add Gostman to this device and open it in its own window`) appears when the browser can install Gostman as an app.
- **Switch workspace** (`Choose another folder, pinned or recent`), **Open folder** and **Open workspace: ...** for each other known folder appear when folder workspaces are available. **Switch workspace** has the shortcut Ctrl+Shift+O.
- **Switch environment: ...** appears once for each environment that is not the active one.

## Preferences

Open **Preferences** from the command palette. Changes apply as soon as you make them. They are saved on this device, in local storage under `gostman.preferences`.

![The Preferences dialog with theme, contrast, accent colour, text size, density, response panel position, interface and code fonts, editor font size and line wrapping](../screenshots/preferences.png)

| Section | Setting | Options | Default |
| --- | --- | --- | --- |
| Appearance | **Theme** | **System**, **Light**, **Dark** | **System** |
| Appearance | **Contrast** | **System**, **Standard**, **More** | **System** |
| Appearance | **Accent colour** | **Cyan**, **Blue**, **Violet**, **Pink**, **Graphite** | **Cyan** |
| Appearance | **Text size** | 90%, 100%, 110%, 125% | 100% |
| Appearance | **Density** | **Comfortable**, **Compact** | **Comfortable** |
| Appearance | **Response panel** | **Below**, **Right** | **Below** |
| Fonts | **Interface font** | The name of a font installed on this device | Empty, which uses the default |
| Fonts | **Code font** | The name of a font installed on this device | Empty, which uses the default |
| Editor | **Editor font size** | A whole number from 10 to 24 | 12 |
| Editor | **Wrap long lines** | On or off | On |
| Requests | **Default timeout** | A whole number of seconds from 0 to 3600 | 0 |
| Requests | **Ask before discarding unsaved changes when closing a tab** | On or off | On |
| Language | **Language** | **English** | **English** |

- **Default timeout** applies to requests that set no timeout of their own. 0 uses the built-in limit. See [Variables, scripts and settings](scripting-and-settings.md) for request settings.
- A number field only takes effect while the value is a whole number inside the range. Otherwise the field is marked invalid, and it goes back to the saved value when you leave it.
- **Language** lists English only. The dialog says more languages will appear when translations are available.
- **Use the system title bar** appears in the desktop app on Windows and Linux, under Appearance. It replaces Gostman's own title bar and window buttons with your desktop's, and takes effect the next time Gostman starts. It is saved with the app's data rather than these preferences, so **Reset to defaults** leaves it unchanged. On macOS the system title bar is always used.

At the bottom of the dialog:

- **Keyboard shortcuts** closes Preferences and opens the Keyboard shortcuts dialog.
- **Reset to defaults** restores every setting in the table. It keeps the shortcuts you changed; reset those in the Keyboard shortcuts dialog.
- **Done** closes the dialog.

### Themes and colours

**Theme** has three options:

- **System** follows the light or dark setting of your operating system and changes with it.
- **Light** and **Dark** always use that appearance.

**Contrast** makes borders, field outlines and secondary text stronger. **System** turns it on when your operating system asks for more contrast, **More** always does, and **Standard** never does.

**Accent colour** sets the colour of buttons, selected tabs, links and focus outlines. Each accent has its own shade for light and dark, chosen so that text in that colour and text on it stay easy to read. The landing page and the documentation keep the Gostman colours.

![Gostman in the light theme with a request and its JSON response](../screenshots/appearance.png)

**Text size** scales all text and the spacing around it. **Compact** density makes everything a little smaller again. **Editor font size** is separate and sets the size of the code editors.

The About dialog's diagnostics report the theme setting.

### Fonts

**Interface font** is used for menus, labels and buttons. **Code font** is used for the editors, the address bar, key and value tables and other code. Leave a field empty to use the default fonts, Outfit and JetBrains Mono, which come with Gostman and need no internet connection.

- Type the name of a font installed on your device, for example `Segoe UI`, `Noto Sans JP` or `Fira Code`. The app changes as you type.
- If no installed font has that name, the field is marked and says `Not found on this device, so the default font is used.`
- Select **Suggest installed fonts**, and the font fields then suggest the names of the fonts installed on your device as you type. The up and down arrows move through the list, Enter picks a name and Esc closes the list. The desktop app reads them on Windows, macOS and Linux. In the browser the button appears in Chrome and Edge, which ask for permission first; in other browsers, type the name.

These settings are saved on this device, so the desktop app and each browser keep their own.

## Keyboard shortcuts

Open the Keyboard shortcuts dialog with Ctrl+/, with the **Keyboard shortcuts** command, with the **?** button of the palette or with the **Keyboard shortcuts** button in Preferences. It lists every shortcut in four groups: **General**, **Request**, **Tabs** and **Navigation**. Below them, **Moving around** lists the keys that work inside lists, tabs and menus; those cannot be changed.

![The Keyboard shortcuts dialog listing general, request and tab shortcuts, each with buttons to change or remove it](../screenshots/shortcuts.png)

### Default shortcuts

| Group | Action | Desktop | Web |
| --- | --- | --- | --- |
| General | Command palette | Ctrl+K | Ctrl+K |
| General | Go to request or history | Ctrl+P | Ctrl+P |
| General | Keyboard shortcuts | Ctrl+/ | Ctrl+/ |
| General | AI: new request from a description | Ctrl+Shift+U | Alt+Shift+U |
| General | AI: explain the response | Ctrl+Shift+X | Alt+Shift+X |
| Request | New request | Ctrl+N | Ctrl+N |
| Request | Save request | Ctrl+S | Ctrl+S |
| Request | Send request | Ctrl+Enter | Ctrl+Enter |
| Tabs | Close tab | Ctrl+W | Alt+W |
| Tabs | Reopen closed tab | Ctrl+Shift+T | Alt+Shift+T |
| Tabs | Close other tabs | Alt+Shift+W | Alt+Shift+W |
| Tabs | Close saved tabs | Alt+Shift+S | Alt+Shift+S |
| Tabs | Keep preview tab open | Alt+Shift+K | Alt+Shift+K |
| Tabs | Next tab | Ctrl+Tab | Alt+] |
| Tabs | Previous tab | Ctrl+Shift+Tab | Alt+[ |
| Tabs | Go to tab 1 to 9 (9 is the last tab) | Alt+1 to 9 | Alt+1 to 9 |
| Navigation | Toggle sidebar | Ctrl+B | Ctrl+B |
| Navigation | Search the sidebar | Ctrl+Shift+F | Ctrl+Shift+F |
| Navigation | Next pane | F6 | F6 |
| Navigation | Previous pane | Shift+F6 | Shift+F6 |
| Navigation | Go to the URL | Ctrl+L | Ctrl+L |
| Navigation | Switch workspace | Ctrl+Shift+O | Not available |
| Navigation | Next workspace | Ctrl+Shift+] | Not available |
| Navigation | Previous workspace | Ctrl+Shift+[ | Not available |

On macOS the dialog shows the same shortcuts with the symbols for Control, Command, Option and Shift. In the browser, Alt replaces the shortcuts that browsers keep for themselves: Ctrl+W, Ctrl+Shift+T and Ctrl+Tab.

Enter in the address bar also sends the request, unless a variable suggestion is open or an input method is composing text.

### Change a shortcut

1. Open the Keyboard shortcuts dialog.
2. On the action's row, select the pencil button (**Change the shortcut for** the action).
3. Press the new combination. The row shows the keys as you hold them. Esc cancels.
4. If the combination is free, it is saved at once. The row gets a **Changed** badge.

Other buttons on a row:

- The **X** button (**Remove the shortcut for** the action) clears the shortcut. The row then reads **Not set**.
- The reset button (**Restore the default shortcut for** the action) appears on a changed row and brings back the default.
- **Reset all** at the bottom restores every default. It is disabled when nothing has been changed.

If another action already uses the combination, the dialog says `... is already used by ...` and offers **Replace** or **Cancel**. **Replace** clears the other action's shortcut and assigns the combination to this one.

A combination must include Ctrl, Alt or the command key. A function key can be used alone. These combinations are refused:

- Combinations that edit text in every field, such as Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+Z and Ctrl+Y.
- In the browser, combinations that browsers keep for themselves.
- On macOS, combinations the operating system keeps for itself.
- Ctrl and Alt together on Windows and Linux, because many keyboards send that pair for AltGr. The Windows or Super key cannot be used, and Command with Control together is not supported on macOS.
- For **Go to tab 1 to 9**, a combination without a number key. The other tabs use the same modifier.

Your changes are saved with your preferences.

## Move around with the keyboard

Everything in the main window can be reached without a mouse.

![The Keyboard shortcuts dialog showing the navigation shortcuts and the Moving around keys](../screenshots/keyboard-navigation.png)

### Panes

The window has five panes: the sidebar, the open tabs, the address bar, the request and the response. F6 moves to the next pane and Shift+F6 to the previous one; a pane that is hidden, such as a closed sidebar, is skipped. Each pane remembers where you were, so coming back puts you on the same field, row or tab. The first visit lands on the selected row, tab or the URL field.

Ctrl+L goes straight to the URL field, and Ctrl+Shift+F to the sidebar search. These, too, can be changed in the Keyboard shortcuts dialog.

### Lists, tabs and options

Each list, row of tabs and set of options is one stop for the Tab key, so Tab moves from one group to the next instead of through every item. Inside a group:

| Keys | Where | What they do |
| --- | --- | --- |
| Up Arrow, Down Arrow, Home, End | Collection tree, history, menus | Move to the previous, next, first or last item |
| Page Up, Page Down | Collection tree | Move a screen up or down |
| Left Arrow, Right Arrow, Home, End | Open tabs, the request and response sections, option buttons such as **Theme** | Move to and select the previous, next, first or last tab or option |
| Right Arrow | Collection tree | Open a closed folder, or move to its first item |
| Left Arrow | Collection tree | Close an open folder, or move to the folder that holds the row |
| Enter | Collection tree | Open the request in a tab, or open or close the folder |
| Space | Collection tree | Preview the request, or open or close the folder |
| Start typing | Collection tree | Jump to the next request or folder whose name starts with what you type. Accents and letter case are ignored, and any script works |
| F2 | Collection tree | Rename the request or folder |
| Delete or Ctrl+Backspace | Collection tree | Delete the request or folder, after you confirm |
| Delete or Ctrl+Backspace | Open tabs | Close the tab |
| Delete or Ctrl+Backspace | History | Remove the entry |
| Shift+F10 or the Menu key | Collection tree | Show the actions for the request or folder |
| Down Arrow | Sidebar search fields | Move into the results |
| Esc | Menus and dialogs | Close them and go back to where you were |

Alt+Shift+Left Arrow and Alt+Shift+Right Arrow move the focused tab, and the tree keeps its keys for moving, copying and duplicating rows; see [Move, copy and duplicate](collections-and-git.md#move-copy-and-duplicate).

Closing a dialog or a menu puts you back on the item that opened it. After you delete a row, close a tab or remove a history entry, the focus moves to the next one.

## About

Open **About Gostman** from the command palette. The dialog shows:

- the version number;
- a short description: an open source API client for REST, GraphQL, gRPC and WebSocket, with no account and your data on your device;
- links to the **Website**, **Source code**, **Releases** and **Report an issue**.

**Copy diagnostics** copies a short JSON text to the clipboard, and the button then reads **Copied**. It holds the app version, whether you run the desktop or web app, the platform, the language, the theme, whether you are online, and the number of requests, folders and environments. It never includes requests, URLs, variables, tokens or secrets, so you can attach it to a bug report.
