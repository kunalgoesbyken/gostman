package workspace

const (
	GitignoreName    = ".gitignore"
	gitignoreContent = "# Local secrets, save leftovers and run history stay out of Git\n.env\n.env.*\n!.env.example\n.gostman-*.tmp\n.gostman/runs/\n.gostman/changes.jsonl\n"
)

func WriteGitignore(root string) (bool, error) {
	absolute, err := absoluteRoot(root)
	if err != nil {
		return false, err
	}
	storage := disk{root: absolute}
	if storage.exists(GitignoreName) {
		return false, nil
	}
	return true, storage.write(GitignoreName, []byte(gitignoreContent))
}
