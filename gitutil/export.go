package gitutil

import (
	"archive/tar"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/kunalgoesbyken/gostman/childproc"
)

const (
	exportFileLimit  = 20000
	exportTotalLimit = 256 << 20
)

func (r Repo) Tags() ([]string, error) {
	out, err := r.run("tag", "--list", "--sort=version:refname")
	if err != nil {
		return nil, err
	}
	tags := []string{}
	for _, line := range strings.Split(out, "\n") {
		if name := strings.TrimSpace(line); name != "" && ValidRef(name) == nil {
			tags = append(tags, name)
		}
	}
	return tags, nil
}

func (r Repo) resolveCommit(ref string) (string, error) {
	if err := ValidRef(ref); err != nil {
		return "", err
	}
	out, err := r.run("rev-parse", "--verify", "--quiet", ref+"^{commit}")
	if err != nil || strings.TrimSpace(out) == "" {
		return "", fmt.Errorf("%q is not a branch, tag or commit of this repository", ref)
	}
	return strings.TrimSpace(out), nil
}

func (r Repo) streamArchive(commit string, output io.Writer) error {
	tree := commit
	if r.Scope != "" {
		tree += ":" + r.Scope
	}
	ctx, cancel := context.WithTimeout(context.Background(), networkTimeout)
	defer cancel()
	args := append(r.hardening(), "archive", "--format=tar", tree)
	command := exec.CommandContext(ctx, "git", args...)
	command.Dir = r.Dir
	childproc.NoWindow(command)
	command.Env = environment()
	var stderr cappedBuffer
	command.Stdout, command.Stderr = output, &stderr
	if err := command.Run(); err != nil {
		return describeFailure(stderr.String(), "", err)
	}
	return nil
}

func ExportRef(dir, ref, destination string) error {
	if !Installed() {
		return ErrNotInstalled
	}
	repo, err := Open(dir, true)
	if err != nil {
		return err
	}
	commit, err := repo.resolveCommit(ref)
	if err != nil {
		return err
	}
	reader, writer := io.Pipe()
	extracted := make(chan error, 1)
	go func() {
		err := extractTar(reader, destination)
		if err == nil {
			_, err = io.Copy(io.Discard, reader)
		}
		reader.CloseWithError(err)
		extracted <- err
	}()
	archiveErr := repo.streamArchive(commit, writer)
	writer.CloseWithError(archiveErr)
	extractErr := <-extracted
	if archiveErr != nil {
		return archiveErr
	}
	return extractErr
}

func extractTar(source io.Reader, destination string) error {
	archive := tar.NewReader(source)
	files, total := 0, int64(0)
	for {
		header, err := archive.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		name := filepath.FromSlash(header.Name)
		if !filepath.IsLocal(name) {
			continue
		}
		target := filepath.Join(destination, name)
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			files++
			total += header.Size
			if files > exportFileLimit || total > exportTotalLimit {
				return errors.New("that version of the repository is too large to export")
			}
			if err := writeExtracted(target, archive); err != nil {
				return err
			}
		}
	}
}

func writeExtracted(target string, content io.Reader) error {
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	file, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(file, content)
	if closeErr := file.Close(); copyErr == nil {
		copyErr = closeErr
	}
	return copyErr
}
