package gitutil

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const (
	conflictStart = "<<<<<<< "
	conflictEnd   = ">>>>>>> "
	logLimit      = "100"
)

type Diff struct {
	Text   string `json:"text"`
	Binary bool   `json:"binary"`
}

type Commit struct {
	Hash    string `json:"hash"`
	Short   string `json:"short"`
	Author  string `json:"author"`
	Date    string `json:"date"`
	Subject string `json:"subject"`
}

type Branch struct {
	Name     string `json:"name"`
	Current  bool   `json:"current"`
	Remote   bool   `json:"remote"`
	Upstream string `json:"upstream"`
	Short    string `json:"short"`
	Subject  string `json:"subject"`
}

type Stash struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
	Date    string `json:"date"`
}

type Remote struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Conflict struct {
	Path      string `json:"path"`
	Ours      string `json:"ours"`
	Theirs    string `json:"theirs"`
	Base      string `json:"base"`
	Working   string `json:"working"`
	OursGone  bool   `json:"oursGone"`
	TheirGone bool   `json:"theirsGone"`
}

type Version struct {
	Content string `json:"content"`
	Diff    string `json:"diff"`
}

func (r Repo) absolute(file string) (string, error) {
	clean, err := ValidPath(file)
	if err != nil {
		return "", err
	}
	full := filepath.Join(r.Dir, filepath.FromSlash(clean))
	root, err := filepath.EvalSymlinks(r.Dir)
	if err != nil {
		return "", err
	}
	parent, err := filepath.EvalSymlinks(filepath.Dir(full))
	if err != nil {
		if os.IsNotExist(err) {
			return full, nil
		}
		return "", err
	}
	relative, err := filepath.Rel(root, parent)
	if err != nil || !filepath.IsLocal(relative) && relative != "." {
		return "", fmt.Errorf("%q is outside the folder", file)
	}
	if info, statErr := os.Lstat(full); statErr == nil && info.Mode()&os.ModeSymlink != 0 {
		return "", fmt.Errorf("%q is a link, so it is not read or written", file)
	}
	return full, nil
}

func (r Repo) readWorktree(file string) []byte {
	full, err := r.absolute(file)
	if err != nil {
		return nil
	}
	content, err := os.ReadFile(full)
	if err != nil {
		return nil
	}
	return content
}

func addedDiff(file string, content []byte) Diff {
	text := string(content)
	if strings.ContainsRune(text, 0) {
		return Diff{Text: fmt.Sprintf("Binary file %s (new)", file), Binary: true}
	}
	lines := strings.Split(strings.TrimSuffix(text, "\n"), "\n")
	if text == "" {
		lines = nil
	}
	var builder strings.Builder
	fmt.Fprintf(&builder, "diff --git a/%s b/%s\nnew file\n--- /dev/null\n+++ b/%s\n", file, file, file)
	if len(lines) > 0 {
		fmt.Fprintf(&builder, "@@ -0,0 +1,%d @@\n", len(lines))
		for _, line := range lines {
			builder.WriteString("+" + line + "\n")
		}
	}
	return Diff{Text: builder.String()}
}

func (r Repo) Diff(file string, staged, untracked bool) (Diff, error) {
	clean, err := ValidPath(file)
	if err != nil {
		return Diff{}, err
	}
	if untracked {
		return addedDiff(clean, r.readWorktree(clean)), nil
	}
	args := []string{"diff", "--no-ext-diff", "--no-textconv", "--no-color", "-U4"}
	if staged {
		args = append(args, "--cached")
	}
	out, err := r.run(append(args, "--", clean)...)
	if err != nil {
		return Diff{}, err
	}
	return Diff{Text: out, Binary: strings.Contains(out, "Binary files ")}, nil
}

func validPaths(files []string) ([]string, error) {
	if len(files) == 0 {
		return nil, errors.New("choose at least one file")
	}
	clean := make([]string, len(files))
	for i, file := range files {
		valid, err := ValidPath(file)
		if err != nil {
			return nil, err
		}
		clean[i] = valid
	}
	return clean, nil
}

func (r Repo) Stage(files []string) error {
	clean, err := validPaths(files)
	if err != nil {
		return err
	}
	_, err = r.runWrite(append([]string{"add", "-A", "--"}, clean...)...)
	return err
}

func (r Repo) StageAll() error {
	_, err := r.runWrite("add", "-A")
	return err
}

func (r Repo) Unstage(files []string) error {
	clean, err := validPaths(files)
	if err != nil {
		return err
	}
	if !r.HasCommits() {
		_, err = r.runWrite(append([]string{"rm", "--cached", "-r", "-q", "--"}, clean...)...)
		return err
	}
	_, err = r.runWrite(append([]string{"restore", "--staged", "--"}, clean...)...)
	return err
}

func (r Repo) Discard(file string, untracked bool) error {
	clean, err := ValidPath(file)
	if err != nil {
		return err
	}
	if untracked {
		_, err = r.runWrite("clean", "-f", "-q", "--", clean)
		return err
	}
	_, err = r.runWrite("restore", "--", clean)
	return err
}

func (r Repo) hasIdentity() bool {
	for _, key := range []string{"user.name", "user.email"} {
		if out, err := r.run("config", "--get", key); err != nil || strings.TrimSpace(out) == "" {
			return false
		}
	}
	return true
}

func (r Repo) Commit(message string) (string, error) {
	if strings.TrimSpace(message) == "" {
		return "", errors.New("write a commit message first")
	}
	if !r.hasIdentity() {
		return "", ErrNoIdentity
	}
	return r.runWriteInput([]byte(message), "commit", "-F", "-")
}

func (r Repo) Fetch() (string, error) {
	return r.runNetwork("fetch", "--all", "--prune")
}

func (r Repo) Pull() (string, error) {
	return r.runNetwork("pull", "--no-edit")
}

func (r Repo) firstRemote() (string, error) {
	remotes, err := r.Remotes()
	if err != nil {
		return "", err
	}
	if len(remotes) == 0 {
		return "", errors.New("add a remote first: there is nowhere to push to")
	}
	for _, remote := range remotes {
		if remote.Name == "origin" {
			return "origin", nil
		}
	}
	return remotes[0].Name, nil
}

func (r Repo) Push() (string, error) {
	status, err := r.Status()
	if err != nil {
		return "", err
	}
	if status.Detached {
		return "", errors.New("switch to a branch before pushing")
	}
	if status.Upstream != "" {
		return r.runNetwork("push")
	}
	remote, err := r.firstRemote()
	if err != nil {
		return "", err
	}
	if err := ValidRef(status.Branch); err != nil {
		return "", err
	}
	return r.runNetwork("push", "--set-upstream", remote, status.Branch)
}

func (r Repo) Branches() ([]Branch, error) {
	out, err := r.run("for-each-ref", "--format=%(refname)%1f%(refname:short)%1f%(HEAD)%1f%(upstream:short)%1f%(objectname:short)%1f%(subject)", "refs/heads", "refs/remotes")
	if err != nil {
		return nil, err
	}
	branches := []Branch{}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Split(line, "\x1f")
		if len(fields) != 6 {
			continue
		}
		isRemote := strings.HasPrefix(fields[0], "refs/remotes/")
		if isRemote && strings.HasSuffix(fields[1], "/HEAD") {
			continue
		}
		branches = append(branches, Branch{Name: fields[1], Current: fields[2] == "*", Remote: isRemote, Upstream: fields[3], Short: fields[4], Subject: fields[5]})
	}
	return branches, nil
}

func (r Repo) CreateBranch(name string) error {
	if err := ValidRef(name); err != nil {
		return err
	}
	_, err := r.runWrite("switch", "-c", name)
	return err
}

func (r Repo) Switch(name string, remote bool) error {
	if err := ValidRef(name); err != nil {
		return err
	}
	if remote {
		_, err := r.runWrite("switch", "--track", name)
		return err
	}
	_, err := r.runWrite("switch", name)
	return err
}

func (r Repo) DeleteBranch(name string, force bool) error {
	if err := ValidRef(name); err != nil {
		return err
	}
	flag := "-d"
	if force {
		flag = "-D"
	}
	_, err := r.runWrite("branch", flag, "--", name)
	return err
}

func (r Repo) Stashes() ([]Stash, error) {
	out, err := r.run("stash", "list", "--format=%gd%x1f%s%x1f%aI")
	if err != nil {
		return nil, err
	}
	stashes := []Stash{}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Split(line, "\x1f")
		if len(fields) != 3 {
			continue
		}
		reference := strings.TrimSuffix(strings.TrimPrefix(fields[0], "stash@{"), "}")
		index, convErr := strconv.Atoi(reference)
		if convErr != nil {
			continue
		}
		stashes = append(stashes, Stash{Index: index, Message: fields[1], Date: fields[2]})
	}
	return stashes, nil
}

func (r Repo) stashTop() string {
	out, err := r.run("rev-parse", "--quiet", "--verify", "refs/stash")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(out)
}

func (r Repo) StashSave(message string) error {
	args := []string{"stash", "push", "--include-untracked"}
	if strings.TrimSpace(message) != "" {
		args = append(args, "-m", message)
	}
	before := r.stashTop()
	if _, err := r.runWritePlain(args...); err != nil {
		return err
	}
	if r.stashTop() == before {
		return errors.New("there are no changes to stash")
	}
	return nil
}

func (r Repo) StashAction(action string, index int) error {
	if action != "apply" && action != "pop" && action != "drop" {
		return errors.New("unknown stash action")
	}
	if index < 0 {
		return errors.New("choose a stash")
	}
	_, err := r.runWritePlain("stash", action, "stash@{"+strconv.Itoa(index)+"}")
	return err
}

func (r Repo) Log(file string) ([]Commit, error) {
	args := []string{"log", "-n", logLimit, "--no-color", "--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s"}
	if file != "" {
		clean, err := ValidPath(file)
		if err != nil {
			return nil, err
		}
		args = append(args, "--follow", "--", clean)
	}
	out, err := r.run(args...)
	if err != nil {
		if !r.HasCommits() {
			return []Commit{}, nil
		}
		return nil, err
	}
	commits := []Commit{}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Split(line, "\x1f")
		if len(fields) == 5 {
			commits = append(commits, Commit{Hash: fields[0], Short: fields[1], Author: fields[2], Date: fields[3], Subject: fields[4]})
		}
	}
	return commits, nil
}

func (r Repo) Version(hash, file string) (Version, error) {
	if err := ValidRevision(hash); err != nil {
		return Version{}, err
	}
	clean, err := ValidPath(file)
	if err != nil {
		return Version{}, err
	}
	content, contentErr := r.run("show", hash+":"+clean)
	diff, err := r.run("show", "--no-ext-diff", "--no-textconv", "--no-color", "--format=", hash, "--", clean)
	if err != nil {
		return Version{}, err
	}
	if contentErr != nil {
		content = ""
	}
	return Version{Content: content, Diff: diff}, nil
}

func (r Repo) RestoreVersion(hash, file string) error {
	if err := ValidRevision(hash); err != nil {
		return err
	}
	clean, err := ValidPath(file)
	if err != nil {
		return err
	}
	_, err = r.runWrite("restore", "--source="+hash, "--worktree", "--", clean)
	return err
}

func (r Repo) stage(number, file string) (string, bool) {
	out, err := r.run("show", ":"+number+":"+file)
	return out, err == nil
}

func (r Repo) Conflict(file string) (Conflict, error) {
	clean, err := ValidPath(file)
	if err != nil {
		return Conflict{}, err
	}
	conflict := Conflict{Path: clean, Working: string(r.readWorktree(clean))}
	var oursFound, theirsFound bool
	conflict.Base, _ = r.stage("1", clean)
	conflict.Ours, oursFound = r.stage("2", clean)
	conflict.Theirs, theirsFound = r.stage("3", clean)
	conflict.OursGone, conflict.TheirGone = !oursFound, !theirsFound
	return conflict, nil
}

func hasConflictMarkers(content string) bool {
	var start, end bool
	for _, line := range strings.Split(content, "\n") {
		start = start || strings.HasPrefix(line, conflictStart)
		end = end || strings.HasPrefix(line, conflictEnd)
	}
	return start && end
}

func (r Repo) Resolve(file, content string) error {
	if r.Restricted {
		return ErrRestricted
	}
	if hasConflictMarkers(content) {
		return errors.New("the result still contains conflict markers; remove the <<<<<<< and >>>>>>> lines first")
	}
	full, err := r.absolute(file)
	if err != nil {
		return err
	}
	clean, _ := ValidPath(file)
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		return err
	}
	_, err = r.runWrite("add", "--", clean)
	return err
}

func (r Repo) AbortMerge() error {
	_, err := r.runWrite("merge", "--abort")
	return err
}

func (r Repo) Init() error {
	_, err := r.runWrite("init")
	return err
}

func Clone(url, parent, name string) (string, error) {
	if err := ValidURL(url); err != nil {
		return "", err
	}
	if name == "" || strings.HasPrefix(name, "-") || strings.ContainsAny(name, `/\:`) || name == "." || name == ".." {
		return "", errors.New("could not work out a folder name from that address")
	}
	destination := filepath.Join(parent, name)
	if _, err := os.Stat(destination); err == nil {
		return "", fmt.Errorf("%s already exists; choose another location", destination)
	}
	_, err := Repo{Dir: parent}.runNetwork("clone", "--", strings.TrimSpace(url), name)
	if err != nil {
		return "", err
	}
	return destination, nil
}

func RepoName(url string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(url), "/")
	trimmed = strings.TrimSuffix(trimmed, ".git")
	cut := strings.LastIndexAny(trimmed, "/:")
	name := trimmed[cut+1:]
	var builder strings.Builder
	for _, r := range name {
		if r > 0x1f && !strings.ContainsRune(`<>:"/\|?*`, r) {
			builder.WriteRune(r)
		}
	}
	return strings.TrimLeft(builder.String(), "-.")
}

func (r Repo) Remotes() ([]Remote, error) {
	out, err := r.run("remote")
	if err != nil {
		return nil, err
	}
	remotes := []Remote{}
	for _, name := range strings.Fields(out) {
		url, urlErr := r.run("remote", "get-url", "--", name)
		if urlErr != nil {
			url = ""
		}
		remotes = append(remotes, Remote{Name: name, URL: Redact(strings.TrimSpace(url))})
	}
	return remotes, nil
}

func (r Repo) AddRemote(name, url string) error {
	if err := ValidRef(name); err != nil {
		return err
	}
	if err := ValidURL(url); err != nil {
		return err
	}
	_, err := r.runWrite("remote", "add", "--", name, strings.TrimSpace(url))
	return err
}

func (r Repo) SetRemoteURL(name, url string) error {
	if err := ValidRef(name); err != nil {
		return err
	}
	if err := ValidURL(url); err != nil {
		return err
	}
	_, err := r.runWrite("remote", "set-url", "--", name, strings.TrimSpace(url))
	return err
}

func (r Repo) remoteURL(name string) (string, error) {
	out, err := r.run("remote", "get-url", "--", name)
	return strings.TrimSpace(out), err
}

func (r Repo) PullRequestURL() (string, error) {
	status, err := r.Status()
	if err != nil {
		return "", err
	}
	if status.Detached || status.Branch == "" {
		return "", errors.New("switch to a branch first")
	}
	remote, err := r.firstRemote()
	if err != nil {
		return "", err
	}
	raw, err := r.remoteURL(remote)
	if err != nil {
		return "", err
	}
	return CompareURL(raw, status.Branch)
}
