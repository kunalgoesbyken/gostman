package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/krockxz/gostman/gitutil"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	noFolderOpen    = "open a folder first: Git works on folder workspaces"
	notARepository  = "this folder is not a Git repository yet"
	notGostmanClone = "the repository was cloned to %s, but it is not a Gostman workspace. Open that folder directly if it should become one"
)

type GitState struct {
	Installed   bool             `json:"installed"`
	InstallHint string           `json:"installHint"`
	HasFolder   bool             `json:"hasFolder"`
	IsRepo      bool             `json:"isRepo"`
	Problem     string           `json:"problem"`
	Restricted  bool             `json:"restricted"`
	Root        string           `json:"root"`
	Branch      string           `json:"branch"`
	Detached    bool             `json:"detached"`
	Upstream    string           `json:"upstream"`
	Ahead       int              `json:"ahead"`
	Behind      int              `json:"behind"`
	Merging     bool             `json:"merging"`
	HasCommits  bool             `json:"hasCommits"`
	Changes     []gitutil.Change `json:"changes"`
	Remotes     []gitutil.Remote `json:"remotes"`
}

func gitRoot() (string, bool, error) {
	folder := openFolder()
	if folder == nil {
		return "", false, errors.New(noFolderOpen)
	}
	memory, err := recallWorkspace(folder.Root())
	if err != nil {
		return "", false, err
	}
	return folder.Root(), !memory.Trusted, nil
}

func currentRepo() (gitutil.Repo, error) {
	root, restricted, err := gitRoot()
	if err != nil {
		return gitutil.Repo{}, err
	}
	if !gitutil.Installed() {
		return gitutil.Repo{}, gitutil.ErrNotInstalled
	}
	top, err := gitutil.Top(root)
	if err != nil || !gitutil.SameFolder(top, root) {
		return gitutil.Repo{}, errors.New(notARepository)
	}
	return gitutil.Repo{Dir: root, Restricted: restricted}, nil
}

func reloadFiles() error {
	if folder := openFolder(); folder != nil {
		return folder.Reload()
	}
	return nil
}

func (a *App) GitState() (GitState, error) {
	state := GitState{Installed: gitutil.Installed(), InstallHint: gitutil.ErrNotInstalled.Error(), Changes: []gitutil.Change{}, Remotes: []gitutil.Remote{}}
	root, restricted, err := gitRoot()
	if err != nil {
		return state, nil
	}
	state.HasFolder, state.Restricted, state.Root = true, restricted, root
	if !state.Installed {
		return state, nil
	}
	top, err := gitutil.Top(root)
	if err != nil {
		if gitutil.HasGitEntry(root) {
			state.Problem = err.Error()
		}
		return state, nil
	}
	if !gitutil.SameFolder(top, root) {
		state.Problem = fmt.Sprintf("this folder is inside the repository at %s. Open that folder, or turn this one into its own repository", top)
		return state, nil
	}
	repo := gitutil.Repo{Dir: root, Restricted: restricted}
	status, err := repo.Status()
	if err != nil {
		state.Problem = err.Error()
		return state, nil
	}
	repo.Summaries(status.Changes)
	state.IsRepo = true
	state.Branch, state.Detached, state.Upstream = status.Branch, status.Detached, status.Upstream
	state.Ahead, state.Behind, state.Merging, state.Changes = status.Ahead, status.Behind, status.Merging, status.Changes
	state.HasCommits = repo.HasCommits()
	if remotes, remoteErr := repo.Remotes(); remoteErr == nil {
		state.Remotes = remotes
	}
	return state, nil
}

func (a *App) GitDiff(path string, staged bool, untracked bool) (gitutil.Diff, error) {
	repo, err := currentRepo()
	if err != nil {
		return gitutil.Diff{}, err
	}
	return repo.Diff(path, staged, untracked)
}

func (a *App) GitStage(paths []string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.Stage(paths)
}

func (a *App) GitStageAll() error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.StageAll()
}

func (a *App) GitUnstage(paths []string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.Unstage(paths)
}

func (a *App) GitDiscard(path string, untracked bool) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if err := repo.Discard(path, untracked); err != nil {
		return err
	}
	return reloadFiles()
}

func (a *App) GitCommit(message string, stageAll bool) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if stageAll {
		if err := repo.StageAll(); err != nil {
			return err
		}
	}
	_, err = repo.Commit(message)
	return err
}

func (a *App) GitFetch() (string, error) {
	repo, err := currentRepo()
	if err != nil {
		return "", err
	}
	return repo.Fetch()
}

func (a *App) GitPull() (string, error) {
	repo, err := currentRepo()
	if err != nil {
		return "", err
	}
	out, pullErr := repo.Pull()
	if reloadErr := reloadFiles(); pullErr == nil {
		pullErr = reloadErr
	}
	return out, pullErr
}

func (a *App) GitPush() (string, error) {
	repo, err := currentRepo()
	if err != nil {
		return "", err
	}
	return repo.Push()
}

func (a *App) GitBranches() ([]gitutil.Branch, error) {
	repo, err := currentRepo()
	if err != nil {
		return nil, err
	}
	return repo.Branches()
}

func (a *App) GitCreateBranch(name string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.CreateBranch(name)
}

func (a *App) GitSwitchBranch(name string, remote bool) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if err := repo.Switch(name, remote); err != nil {
		return err
	}
	return reloadFiles()
}

func (a *App) GitDeleteBranch(name string, force bool) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.DeleteBranch(name, force)
}

func (a *App) GitStashes() ([]gitutil.Stash, error) {
	repo, err := currentRepo()
	if err != nil {
		return nil, err
	}
	return repo.Stashes()
}

func (a *App) GitStashSave(message string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if err := repo.StashSave(message); err != nil {
		return err
	}
	return reloadFiles()
}

func (a *App) GitStashAction(action string, index int) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	stashErr := repo.StashAction(action, index)
	if reloadErr := reloadFiles(); stashErr == nil {
		stashErr = reloadErr
	}
	return stashErr
}

func (a *App) GitLog(path string) ([]gitutil.Commit, error) {
	repo, err := currentRepo()
	if err != nil {
		return nil, err
	}
	return repo.Log(path)
}

func (a *App) GitVersion(hash string, path string) (gitutil.Version, error) {
	repo, err := currentRepo()
	if err != nil {
		return gitutil.Version{}, err
	}
	return repo.Version(hash, path)
}

func (a *App) GitRestoreVersion(hash string, path string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if err := repo.RestoreVersion(hash, path); err != nil {
		return err
	}
	return reloadFiles()
}

func (a *App) GitConflict(path string) (gitutil.Conflict, error) {
	repo, err := currentRepo()
	if err != nil {
		return gitutil.Conflict{}, err
	}
	return repo.Conflict(path)
}

func (a *App) GitResolve(path string, content string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if err := repo.Resolve(path, content); err != nil {
		return err
	}
	return reloadFiles()
}

func (a *App) GitAbortMerge() error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	if err := repo.AbortMerge(); err != nil {
		return err
	}
	return reloadFiles()
}

func (a *App) GitInit() error {
	root, restricted, err := gitRoot()
	if err != nil {
		return err
	}
	if !gitutil.Installed() {
		return gitutil.ErrNotInstalled
	}
	return gitutil.Repo{Dir: root, Restricted: restricted}.Init()
}

func (a *App) GitClone(url string, parent string) (WorkspaceStatus, error) {
	if strings.TrimSpace(parent) == "" {
		return WorkspaceStatus{}, errors.New(noFolderChosen)
	}
	parent, err := filepath.Abs(parent)
	if err != nil {
		return WorkspaceStatus{}, err
	}
	destination, err := gitutil.Clone(url, parent, gitutil.RepoName(url))
	if err != nil {
		return WorkspaceStatus{}, err
	}
	folder, err := reopen(destination)
	if err != nil {
		return WorkspaceStatus{}, fmt.Errorf(notGostmanClone, destination)
	}
	return activate(folder)
}

func (a *App) GitAddRemote(name string, url string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.AddRemote(name, url)
}

func (a *App) GitSetRemoteURL(name string, url string) error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	return repo.SetRemoteURL(name, url)
}

func (a *App) GitOpenPullRequest() error {
	repo, err := currentRepo()
	if err != nil {
		return err
	}
	target, err := repo.PullRequestURL()
	if err != nil {
		return err
	}
	wailsruntime.BrowserOpenURL(a.ctx, target)
	return nil
}
