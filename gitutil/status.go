package gitutil

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Change struct {
	Path      string   `json:"path"`
	OrigPath  string   `json:"origPath"`
	Index     string   `json:"index"`
	Worktree  string   `json:"worktree"`
	Conflict  bool     `json:"conflict"`
	Untracked bool     `json:"untracked"`
	Kind      string   `json:"kind"`
	Summary   []string `json:"summary"`
}

type Status struct {
	Branch   string   `json:"branch"`
	Detached bool     `json:"detached"`
	Upstream string   `json:"upstream"`
	Ahead    int      `json:"ahead"`
	Behind   int      `json:"behind"`
	Merging  bool     `json:"merging"`
	Changes  []Change `json:"changes"`
}

func splitFields(entry string, count int) []string {
	return strings.SplitN(entry, " ", count)
}

func parseStatus(output string) Status {
	status := Status{Changes: []Change{}}
	entries := strings.Split(output, "\x00")
	for i := 0; i < len(entries); i++ {
		entry := entries[i]
		switch {
		case strings.HasPrefix(entry, "# branch.head "):
			status.Branch = strings.TrimPrefix(entry, "# branch.head ")
			if status.Branch == "(detached)" {
				status.Detached = true
			}
		case strings.HasPrefix(entry, "# branch.upstream "):
			status.Upstream = strings.TrimPrefix(entry, "# branch.upstream ")
		case strings.HasPrefix(entry, "# branch.ab "):
			parts := strings.Fields(strings.TrimPrefix(entry, "# branch.ab "))
			if len(parts) == 2 {
				status.Ahead, _ = strconv.Atoi(strings.TrimPrefix(parts[0], "+"))
				status.Behind, _ = strconv.Atoi(strings.TrimPrefix(parts[1], "-"))
			}
		case strings.HasPrefix(entry, "1 "):
			fields := splitFields(entry, 9)
			if len(fields) == 9 {
				status.Changes = append(status.Changes, Change{Path: fields[8], Index: string(fields[1][0]), Worktree: string(fields[1][1])})
			}
		case strings.HasPrefix(entry, "2 "):
			fields := splitFields(entry, 10)
			if len(fields) == 10 {
				change := Change{Path: fields[9], Index: string(fields[1][0]), Worktree: string(fields[1][1])}
				if i+1 < len(entries) {
					i++
					change.OrigPath = entries[i]
				}
				status.Changes = append(status.Changes, change)
			}
		case strings.HasPrefix(entry, "u "):
			fields := splitFields(entry, 11)
			if len(fields) == 11 {
				status.Changes = append(status.Changes, Change{Path: fields[10], Index: string(fields[1][0]), Worktree: string(fields[1][1]), Conflict: true})
			}
		case strings.HasPrefix(entry, "? "):
			status.Changes = append(status.Changes, Change{Path: strings.TrimPrefix(entry, "? "), Index: "?", Worktree: "?", Untracked: true})
		}
	}
	return status
}

func (r Repo) Status() (Status, error) {
	out, err := r.run(r.scoped("status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all")...)
	if err != nil {
		return Status{}, err
	}
	status := parseStatus(out)
	for i := range status.Changes {
		status.Changes[i].Kind = kindOf(r.inScope(status.Changes[i].Path))
	}
	status.Merging = r.merging()
	return status, nil
}

func (r Repo) merging() bool {
	out, err := r.run("rev-parse", "--git-path", "MERGE_HEAD")
	if err != nil {
		return false
	}
	path := strings.TrimSpace(out)
	if !filepath.IsAbs(path) {
		path = filepath.Join(r.Dir, path)
	}
	_, statErr := os.Stat(path)
	return statErr == nil
}

func (r Repo) HasCommits() bool {
	_, err := r.run("rev-parse", "--verify", "--quiet", "HEAD")
	return err == nil
}

func HasGitEntry(dir string) bool {
	_, err := os.Lstat(filepath.Join(dir, ".git"))
	return err == nil
}
