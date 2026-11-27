package main

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const (
	maxCompanionBytes = 256 << 20
	missingCompanion  = "the downloaded command line archive has no %s"
	companionTooBig   = "the command line in the archive is larger than %d MB"
)

func companionAsset(release githubRelease, source updateSource, plan installPlan) githubAsset {
	if plan.Companion == "" {
		return githubAsset{}
	}
	asset, found := release.asset(plan.Companion)
	if !found || !source.permits(asset.URL) {
		return githubAsset{}
	}
	return asset
}

func companionPath(staged stagedUpdate) string {
	return filepath.Join(updatesFolder(), staged.Version, staged.Companion)
}

func (a *App) stageCompanion(ctx context.Context, target updateTarget, staged *stagedUpdate) *updateFailure {
	expected, err := fetchChecksum(ctx, target.client, target.sums, target.key, target.companion.Name)
	if err != nil {
		return failed(failureUnverified, err)
	}
	staged.Companion = target.companion.Name
	path := companionPath(*staged)
	received, err := a.fetchAsset(ctx, target.client, target.companion, path+partialSuffix, target.version)
	if err != nil {
		return failed(failureNetwork, err)
	}
	if received != expected {
		return failed(failureMismatch, nil)
	}
	if err := os.Rename(path+partialSuffix, path); err != nil {
		return failed(failureStorage, err)
	}
	staged.CompanionSha256 = expected
	return nil
}

func companionIntact(staged stagedUpdate) bool {
	if staged.Companion == "" {
		return true
	}
	digest, err := fileDigest(companionPath(staged))
	return err == nil && digest == staged.CompanionSha256
}

func applyCompanion(staged stagedUpdate, plan installPlan) error {
	if staged.Companion == "" || plan.CompanionTarget == "" {
		return nil
	}
	digest, err := fileDigest(companionPath(staged))
	if err != nil {
		return err
	}
	if digest != staged.CompanionSha256 {
		return fmt.Errorf(sumMismatch, staged.CompanionSha256, digest)
	}
	extracted := filepath.Join(filepath.Dir(companionPath(staged)), cliExecutable)
	if err := extractEntry(companionPath(staged), cliExecutable, extracted); err != nil {
		return err
	}
	defer os.Remove(extracted)
	return replaceFile(extracted, plan.CompanionTarget)
}

func extractEntry(archive, name, target string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer reader.Close()
	for _, entry := range reader.File {
		if entry.Name != name {
			continue
		}
		if entry.UncompressedSize64 > maxCompanionBytes {
			return fmt.Errorf(companionTooBig, maxCompanionBytes>>20)
		}
		source, err := entry.Open()
		if err != nil {
			return err
		}
		defer source.Close()
		return writeLimited(source, target)
	}
	return fmt.Errorf(missingCompanion, name)
}

func writeLimited(source io.Reader, target string) error {
	file, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, updateFileMode)
	if err != nil {
		return err
	}
	written, err := io.Copy(file, io.LimitReader(source, maxCompanionBytes+1))
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err == nil && written > maxCompanionBytes {
		err = fmt.Errorf(companionTooBig, maxCompanionBytes>>20)
	}
	if err != nil {
		os.Remove(target)
	}
	return err
}
