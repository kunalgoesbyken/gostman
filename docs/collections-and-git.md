# Collections, tabs and Git

This page covers the sidebar and collection tree, request tabs, the welcome panel, the storage menu (app storage, opened folders, recent folders and trust) and the Git panel. Folder files and the mock server are described in [Folders, mock server and capture](workspaces-and-mock.md).

## Sidebar

The sidebar has two views, **Collections** and **History**. The History tab shows a count of saved entries when there are any.

![Gostman with the storefront-api folder open: folders of requests in the sidebar, a search field, a request and its response](../screenshots/app.png)

The buttons next to the view tabs are:

| Button | What it does |
| --- | --- |
| Run requests | Opens the collection runner |
| Settings for all collections | Opens the settings that apply to every request; in a folder workspace it is **Collection settings**. See [Folder and collection settings](folder-settings.md) |
| New folder | Creates a folder |
| New request | Creates a request; the tooltip shows its keyboard shortcut |

To hide the sidebar, select the sidebar button at the left of the header, press Ctrl+B, or run **Toggle sidebar** from the command palette. The same button shows it again.

On a window at least 768 pixels wide, the sidebar sits next to the requests and you can change its width:

- Drag its right edge. Dragging it almost closed and letting go hides the sidebar, and the width you had comes back when you show it again.
- Focus the edge (**Resize sidebar**) and use the left and right arrows, or Home and End for the narrowest and widest.
- Double-click the edge to return to the default width.

The width, from 224 to 480 pixels, and whether the sidebar is shown are remembered. The sidebar never takes so much room that the requests get narrower than 480 pixels. On a narrower window it opens over the requests instead, starts hidden and closes when you open a request.

## Collection tree

The tree lists folders and requests. Each request row shows its method and name, and hovering a row shows its URL and tags. Folders can hold other folders. An import moves folders nested deeper than 32 levels to the top level.

Tags show at the right of a row as coloured labels, the first two in full and the rest as **+N**. A folder with a colour shows it on its folder icon. See [Folder colours and tags](#folder-colours-and-tags).

- Click a folder to open or close it. **Collapse all folders**, next to the search field and in the command palette, closes every folder.
- Click a request to open it in a preview tab. Double-click it to keep the tab open.
- An empty folder shows **This folder is empty**.
- An empty collection shows **No requests yet** with **New request** and **Import** buttons, and a **Paste** button when you have copied an item.

### Search

The **Search name, URL or tag** field filters the tree by request name, URL or tag. A request also matches the tags of the folders it is in. When nothing matches, the tree shows **No results**. Drag and drop is switched off while a search is active. Press the Down Arrow in the field to move into the results.

The tree is one stop for the Tab key. Inside it, the arrow keys move between rows, Right Arrow and Left Arrow open and close folders, Enter opens a request in a tab and Space previews it. Typing the start of a name jumps to the next matching request or folder. F2 renames a row, Delete deletes it after you confirm, and Shift+F10 or the Menu key shows its actions. See [Move around with the keyboard](preferences-and-shortcuts.md#move-around-with-the-keyboard) for every key.

### Move, copy and duplicate

You can rearrange the tree in three ways:

- **Drag and drop.** Drag a request or folder onto another row. Dropping on the upper or lower part of a row places the item before or after it. For a folder, dropping in the middle puts the item inside it, the lower part of an open folder puts it first inside, and a closed folder opens after you hold the item over it. Dropping in the empty area of the tree moves the item to the top level. A folder cannot be dropped into itself or into one of its own subfolders.
- **Keyboard.** With a row focused, press Alt+Up Arrow or Alt+Down Arrow to move it, Ctrl+C to copy, Ctrl+V to paste and Ctrl+D to duplicate. On macOS the Ctrl shortcuts use the Command key.
- **Context menu.** Described below.

After a move, paste or duplicate, a notice names the item and offers **Undo**.

### Order of requests and folders

Inside each folder, requests and subfolders share one order, as in Postman and Insomnia: a request can sit above, between or below folders, and Alt+Up Arrow or **Move up** steps past a folder the same way it steps past a request. The runner, `gostman run` and an agent's `run_folder` send requests in this order, and the Postman, curl script and HAR exports write it. Imports from Postman, Insomnia and single-file OpenCollection keep the order of the source, and imported top-level items are placed after the ones you already have. Bruno lists folders before requests, so Bruno imports show folders first, and a Bruno export warns about requests that will run later there.

Collections from older versions show folders first, exactly as before, and nothing moves when you open them. The first time you move, copy, duplicate or import something, Gostman numbers every folder's contents in the order they already show, so nothing changes position, and from then on every folder keeps the order you give it. Exports carry this too: a Gostman export from an older version still runs folders first.

### Context menu

Right-click a row, or use the actions button that appears when you hover it, to open the menu.

For a request:

- **Rename**
- **Tags…**, see [Folder colours and tags](#folder-colours-and-tags)
- **Share request**, which opens the Share tab, see [Sharing and documentation](sharing-and-docs.md)
- **Move up**, **Move down**, **Move to folder**
- **Copy**, **Paste**, **Duplicate**
- **Delete**

**Move to folder** lists **Top level** and every folder as a target. The current location and folders that would nest a folder inside itself are disabled.

For a folder, the menu adds these entries before the move and copy entries:

- **New request** and **New subfolder** inside the folder
- **Run folder**
- **Share folder**, which opens the Share tab, see [Sharing and documentation](sharing-and-docs.md)
- **Check for spec updates**, **Browse API spec** and **Check responses against the spec** (or **Stop checking responses against the spec**), only for a folder linked to an OpenAPI spec (**Check for spec updates** only when the spec has an address to sync from); any other folder has **Check responses against a spec…**, which links one. See [Import, export and OpenAPI specs](import-export-and-specs.md)
- **Settings**, the folder settings described in [Folder and collection settings](folder-settings.md); on a top-level folder in the app's own storage it is **Collection settings**, because that folder is a collection
- **Colour and tags…**, see [Folder colours and tags](#folder-colours-and-tags)

A folder also has **Rename** and **Delete**.

### Folder colours and tags

**Colour and tags…** on a folder, or **Tags…** on a request, opens a small window:

![The Colour and tags window for the Users folder: orange selected as the folder colour, the WIP tag, and the colour of the WIP tag](../screenshots/colour-and-tags.png)

- **Folder colour** offers six colours and a custom one (the swatch with a plus), which opens your system's colour picker. Choose the selected colour again to remove it. The colour is saved with the folder, in `folder.yaml` for a folder workspace, so everyone who opens the collection sees it.
- **Tags** adds and removes tags. Type a tag and press Enter, or pick one used elsewhere in the collection. A request's tags can also be edited in its **Settings** tab.
- **Tag colours** sets the colour of each tag. Without a choice, a colour is picked from the tag's name, so a tag looks the same on every computer. A tag you colour keeps that colour everywhere it appears; these choices are kept on this device and survive **Reset to defaults**.

![The sidebar with orange, teal and purple folders, WIP and Billing folder tags, and request tags such as Smoke, Todo and Testing](../screenshots/folder-colours-tags.png)

Folder tags apply to every request inside the folder, including requests in its subfolders. The sidebar search, the runner's **Only tags** and **Skip tags** filters, and `gostman run --tags` and `--exclude-tags` all treat them as the request's own tags.

## Tabs

Each open request has a tab above the editor. A tab shows the method and the request name, or its URL when the name is empty.

- A tab in italics is a preview tab. Opening another request from the tree replaces it. Editing the request, double-clicking the tab or choosing **Keep tab open** in its menu keeps it.
- A small dot on a tab means the request has unsaved changes. Open tabs, including these drafts, are stored with the app data, so they come back when you restart.
- Click the plus button for a new request tab, or middle-click a tab to close it.
- Drag a tab to reorder it, or press Alt+Shift+Left Arrow or Alt+Shift+Right Arrow with the tab focused.

The tab context menu contains:

| Entry | Effect |
| --- | --- |
| Close | Closes the tab |
| Close other tabs | Closes every other tab |
| Close tabs to the right | Closes the tabs after this one |
| Close saved tabs | Closes tabs without unsaved changes |
| Keep tab open | Only on preview tabs |
| Move left, Move right | Reorders the tab |
| Reveal in collection | Scrolls the tree to the saved request; disabled for a request that is not saved |
| Copy as cURL | Copies the prepared request as a curl command; only HTTP requests can be copied |

Closing one tab with unsaved changes asks whether to **Save** them first, close with **Don't save**, or **Cancel**. When several tabs with unsaved changes are about to close, a **Close tabs** prompt asks you to confirm with **Discard**. To close without either prompt, clear **Ask before discarding unsaved changes when closing a tab** in the **Requests** section of Preferences.

## Welcome panel and getting started

A new, blank tab with no response shows the **Welcome to Gostman** panel. Its **Get started** list walks through five steps, each with a button that does it for you:

| Step | Button | Done when |
| --- | --- | --- |
| Send a request | **Send sample request**, a `GET` to `https://httpbin.org/anything?hello=world` | History has an entry |
| Save it to your collection | **Save request** saves the open request, or the last one you sent | The collection has a request you saved |
| Add a variable | **Open environments** | An environment, a global environment or the collection defines a variable |
| Add a check | **Open the Checks tab** of the open or last saved request | A saved request has an assertion or a post-response script |
| Run your requests together | **Open the runner** | You have started a run |

Steps are worked out from your data, so after an import the steps it covers are already ticked. While steps remain, a button in the header names the next one and shows your progress, for example **Next: Add a variable 2/5**; it opens the same list. **Hide** in that list, or the close button on the panel, puts both away. When every step is done the button disappears and the panel no longer opens by itself. The **Show welcome** command in the command palette brings the panel back at any time.

The **Add a variable** step also shows how variables look: a name in double braces is green when the active environment defines it and orange when it is missing. **Read the tutorial**, under the list, opens the [tutorial](tutorial-first-collection.md), which goes through the same steps in more depth.

Below the list, **Other ways to start** offers:

- **Import requests** from Postman, Bruno, Insomnia, OpenAPI, HAR, .http files or curl.
- **Open a folder**, only where folder storage is available (see below).
- **Create a folder**, which adds a folder at the top level of the sidebar.
- **Paste a curl command**, which moves the cursor to the address bar; a curl command pasted there fills the request.

On a wider window, **Keyboard shortcuts** lists the main shortcuts.

## Storage menu

The button in the header shows where the collection lives.

- **Web app:** the button reads **This browser**. Selecting it explains that the collection is saved in the browser and that keeping it as files in a folder needs the desktop app.
- **Desktop app:** the button reads **This computer** until you open a folder, then it shows the folder name. A warning icon marks a restricted folder and another marks unreadable files.

Folder storage and the Git panel exist only in the desktop app.

### The workspace menu

Choosing the button opens a menu. The shortcut for it is shown in the button tooltip; the **Switch workspace** shortcut is not active on the web.

- **This computer (no folder)** switches back to app storage.
- **Pinned** and **Recent** list the folders you opened. A folder that no longer exists is marked **Folder not found**.
- Choosing a folder switches to it and keeps the tabs of the current workspace.
- Each folder has buttons to **Pin** or **Unpin**, **Rename** (only the name in the list changes, not the folder on disk), **Show in file explorer** and, for folders other than the current one, **Remove from list**. Removing a folder from the list leaves its files on disk and forgets its trust and saved tokens.

The footer of the menu has these actions:

| Action | Effect |
| --- | --- |
| Trust this folder | Shown only for a restricted folder |
| Open folder | Picks a folder to use as the collection. An empty folder becomes a new collection; a folder that already holds other files, such as a repository root, gets the collection in a `gostman` folder inside it |
| Save collection to folder | Writes the current collection into a folder you pick, or into a new `gostman` folder inside it when it already holds other files. A folder is one collection, so each collection's own collection variables join the shared ones in `gostman.yaml`; a name already set keeps its value, and secret values stay in the keychain. Environments become shared too; when two collections, or a collection and the shared list, both have an environment with the same name, the collection's one is renamed after it, such as `Dev (Ledger)`, and a notice says so |
| Clone repository | Asks for a repository address, then a folder to clone into |
| Git | Opens the Git panel; needs an open folder |
| Reload from disk | Rereads the folder at once; changes made outside the app are also picked up by themselves within a few seconds. Needs an open folder |
| Show N unreadable files | Lists files that could not be read; shown only when there are some |
| Close folder | Returns to app storage; needs an open folder |

Files that cannot be read are skipped and left unchanged. Fix them, then choose **Reload from disk**. When no request can be shown because of them, for example while the only request file has a merge conflict, the sidebar says how many files could not be read and offers **Show files**.

### Trust

A folder you did not create opens as restricted. In a restricted folder, scripts, OAuth 2.0 settings, local MCP commands and [file reads](variables.md#reading-files) are switched off and the Git panel is read-only. **Trust this folder** asks for confirmation, explains that requests can carry scripts, OAuth 2.0 settings, local MCP commands and file reads that run when a request is sent and can read your variables, and then lifts the restriction.

Opening a restricted folder shows a notice that says so. A request that is stopped because the folder is restricted shows a **Trust this folder** button in the response pane.

## Git panel

The **Git** panel is a desktop feature. It works on the open folder, so open or save the collection to a folder first, or clone a repository from the workspace menu. Open it with **Git** in the workspace menu, or with the branch name in the status bar at the bottom of the window (it reads **Git** when the folder is not a repository yet). The panel refreshes when the app window regains focus.

![The Git panel with one changed request file, its diff showing the URL change, and a commit message ready to commit](../screenshots/git-panel.png)

If the panel cannot work, it says why:

- **Git is not installed**, with an install hint.
- **Git works on folder workspaces**, when no folder is open.
- **Git cannot use this folder**, with the reason Git gave.
- **This folder is not a Git repository**, with an **Initialize repository** button.

In a repository, the header shows the current branch (or **Detached HEAD**) and the buttons **Fetch**, **Pull** and **Push**. Pull and Push show how many commits you are behind or ahead. When the collection is one folder of a larger repository, such as `gostman/` in your project, the header also shows that folder: only changes inside it are listed, and **Stage all**, **Commit all changes**, **Stash changes** and the whole-repository history leave other files alone; a commit takes only the staged files inside the folder, and files you staged elsewhere in the repository stay staged (a commit that finishes a merge takes everything, as the merge does), while branches, pull and push apply to the whole repository. In a restricted folder, the panel shows a notice with a **Trust this folder** link and everything that changes the repository is disabled.

The panel has five sections: **Changes**, **Branches**, **Stashes**, **History** and **Remotes**. Output from a Git operation appears in a notice at the top.

### Changes

The left side lists files in up to three groups: **Conflicts**, **Staged** and **Changes**. Each row shows a status letter (for example Modified, Added, Deleted or New) and a short summary of what changed in the request or folder.

- Select a file to see its diff on the right. Added lines, removed lines and hunk headers are coloured. A binary file shows **This file is binary, so there is no line diff.**
- Use the plus and minus buttons to stage and unstage a file, or **Stage all**.
- Use the discard button on an unstaged file to restore it. A prompt warns that this cannot be undone.
- Use the history button on a row to open the History section for that file.
- Type a **Commit message** and choose the commit button. With nothing staged, the button reads **Commit all changes**; otherwise it reads **Commit N staged files**. Committing is disabled while conflicts remain. When every conflict is resolved and nothing differs from the last commit, for example because you kept your side everywhere, the button reads **Commit the merge** and finishes it.

### Branches

- **Create branch** makes a branch from the current commit.
- Local branches show a **current** badge, their upstream and a **Switch** button. Other local branches also have a delete button that asks for confirmation; Git refuses if the branch has unmerged commits.
- **Remote branches** have a **Check out** button.

### Stashes

A stash sets uncommitted changes aside. **Stash changes** takes an optional note. Each stash has **Apply**, **Pop** and a drop button, and dropping asks for confirmation.

### History

Enter a file path to see the history of one file, or leave it empty for the whole repository, and choose **Show history**. Selecting a commit of a single file shows its diff, and **Restore this version** replaces the file with that commit's content after a confirmation.

### Remotes

**Add remote** takes a name (default `origin`) and an address. Each remote has a **Change** button for its address. **Create pull request in browser** appears once a remote exists.

### Merges and conflict resolution

When a merge is in progress, a notice says to resolve each conflicted file and commit to finish, shows how many files are still in conflict and offers **Abort merge**. Aborting undoes everything from the merge, including resolutions you already made, and asks for confirmation.

Select a file under **Conflicts** to open the conflict editor:

- **Ours** and **Theirs** show each side, with **Accept ours** and **Accept theirs** buttons. A side whose file was removed shows **Deleted on this side**.
- **Result** is an editable text area. **Accept both** puts the two sides together, and **Reset** restores the working file.
- If the result still contains conflict markers, a warning appears and **Mark resolved** stays disabled.
- **Mark resolved** saves the result for that file.

## What is desktop-only

- Opening folders, saving to a folder, cloning, workspace switching and the Git panel need folder storage, which exists only in the desktop app.
- The web app keeps the collection in the browser and has no Git panel. See the [README](../README.md#web-version) for the other differences between the web and desktop apps.
