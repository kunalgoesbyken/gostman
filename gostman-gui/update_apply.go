package main

import (
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/childproc"
)

const (
	bundleName     = "Gostman.app"
	previousBundle = "previous.app"
	bundleBinaries = "Contents/MacOS"
	missingBundle  = "the downloaded archive has no Gostman.app"
)

func copyInto(source, target string) error {
	from, err := os.Open(source)
	if err != nil {
		return err
	}
	defer from.Close()
	to, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, updateFileMode)
	if err != nil {
		return err
	}
	if _, err := io.Copy(to, from); err != nil {
		to.Close()
		os.Remove(target)
		return err
	}
	if err := to.Close(); err != nil {
		os.Remove(target)
		return err
	}
	return os.Chmod(target, updateFileMode)
}

func replaceFile(source, target string) error {
	incoming, replaced := target+incomingSuffix, target+replacedSuffix
	if err := copyInto(source, incoming); err != nil {
		return err
	}
	os.Remove(replaced)
	if err := os.Rename(target, replaced); err != nil {
		os.Remove(incoming)
		return err
	}
	if err := os.Rename(incoming, target); err != nil {
		os.Rename(replaced, target)
		os.Remove(incoming)
		return err
	}
	return nil
}

func runQuietly(name string, args ...string) error {
	command := exec.Command(name, args...)
	childproc.NoWindow(command)
	return command.Run()
}

func replaceBundle(archive, bundle string) error {
	staging := filepath.Join(filepath.Dir(bundle), bundleStaging)
	if err := os.RemoveAll(staging); err != nil {
		return err
	}
	if err := os.MkdirAll(staging, updateFolderMode); err != nil {
		return err
	}
	if err := runQuietly("/usr/bin/ditto", "-x", "-k", archive, staging); err != nil {
		return err
	}
	fresh := filepath.Join(staging, bundleName)
	if !exists(filepath.Join(fresh, bundleBinaries)) {
		return errors.New(missingBundle)
	}
	runQuietly("/usr/bin/xattr", "-dr", "com.apple.quarantine", fresh)
	aside := filepath.Join(staging, previousBundle)
	if err := os.Rename(bundle, aside); err != nil {
		return err
	}
	if err := os.Rename(fresh, bundle); err != nil {
		os.Rename(aside, bundle)
		return err
	}
	return nil
}
