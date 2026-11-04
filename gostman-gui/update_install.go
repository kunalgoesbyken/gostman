package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	updateStateEvent = "update:state"

	phaseIdle        = ""
	phaseDownloading = "downloading"
	phaseVerifying   = "verifying"
	phaseReady       = "ready"
	phaseInstalling  = "installing"
	phaseFailed      = "failed"

	failureNetwork     = "network"
	failureUnsupported = "unsupported"
	failureUnverified  = "unverified"
	failureMismatch    = "mismatch"
	failureStorage     = "storage"
	failureInstall     = "install"

	updatesDirectory = "updates"
	stagedFileName   = "staged.json"
	partialSuffix    = ".part"
	maxUpdateBytes   = 768 << 20
	maxChecksumBytes = 1 << 16
	downloadTimeout  = 30 * time.Minute
	progressEvery    = 120 * time.Millisecond
	updateFileMode   = 0o755
	updateFolderMode = 0o700

	updateFailedLog = "the update to %s failed (%s): %s"
	notReady        = "no verified update is waiting to be installed"
	alreadyBusy     = "an update is already being downloaded or installed"
	noNewerRelease  = "the latest release (%s) is not newer than this version (%s)"
	downloadRefused = "the download answered with HTTP %d"
	downloadTooBig  = "the download is larger than %d MB"
	missingSum      = "SHA256SUMS has no line for %s"
	sumMismatch     = "expected SHA-256 %s, received %s"
)

type UpdateState struct {
	Phase          string `json:"phase"`
	Version        string `json:"version,omitempty"`
	Received       int64  `json:"received"`
	Total          int64  `json:"total"`
	Failure        string `json:"failure,omitempty"`
	Detail         string `json:"detail,omitempty"`
	Method         string `json:"method"`
	Manager        string `json:"manager,omitempty"`
	AsksPermission bool   `json:"asksPermission,omitempty"`
}

type stagedUpdate struct {
	Version string `json:"version"`
	Asset   string `json:"asset"`
	Method  string `json:"method"`
	Sha256  string `json:"sha256"`
}

type updater struct {
	mu          sync.Mutex
	state       UpdateState
	staged      *stagedUpdate
	cancel      context.CancelFunc
	autoInstall bool
	emitted     time.Time
}

var updates = &updater{}

func isBusy(phase string) bool {
	return phase == phaseDownloading || phase == phaseVerifying || phase == phaseInstalling
}

func updatesFolder() string {
	return filepath.Join(appFolder, updatesDirectory)
}

func stagedPath(staged stagedUpdate) string {
	return filepath.Join(updatesFolder(), staged.Version, staged.Asset)
}

func effectiveInstall() installPlan {
	if releaseSource().manualOnly {
		plan := currentInstall()
		return manualInstall(plan.Manager, plan.Download)
	}
	return currentInstall()
}

func (u *updater) snapshot() UpdateState {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.described()
}

func (u *updater) described() UpdateState {
	plan := effectiveInstall()
	state := u.state
	state.Method = plan.Method
	state.Manager = plan.Manager
	state.AsksPermission = plan.asksPermission()
	return state
}

func (a *App) announceUpdate(force bool) {
	u := updates
	u.mu.Lock()
	if !force && time.Since(u.emitted) < progressEvery {
		u.mu.Unlock()
		return
	}
	u.emitted = time.Now()
	state := u.described()
	u.mu.Unlock()
	if a.ctx != nil {
		wailsruntime.EventsEmit(a.ctx, updateStateEvent, state)
	}
}

func (a *App) setUpdate(state UpdateState) {
	updates.mu.Lock()
	updates.state = state
	updates.mu.Unlock()
	a.announceUpdate(true)
}

func (a *App) failUpdate(version, failure string, err error) {
	detail := ""
	if err != nil {
		detail = err.Error()
	}
	log.Printf(updateFailedLog, version, failure, detail)
	a.setUpdate(UpdateState{Phase: phaseFailed, Version: version, Failure: failure, Detail: detail})
}

func (a *App) UpdateState() UpdateState {
	return updates.snapshot()
}

func (a *App) SetAutoInstall(enabled bool) {
	updates.mu.Lock()
	updates.autoInstall = enabled
	updates.mu.Unlock()
}

func (a *App) DownloadUpdate(version string) (UpdateState, error) {
	u := updates
	u.mu.Lock()
	if isBusy(u.state.Phase) {
		u.mu.Unlock()
		return u.snapshot(), errors.New(alreadyBusy)
	}
	ctx, cancel := context.WithTimeout(a.ctx, downloadTimeout)
	u.cancel = cancel
	u.state = UpdateState{Phase: phaseDownloading, Version: version}
	u.mu.Unlock()
	a.announceUpdate(true)
	go func() {
		defer cancel()
		a.downloadUpdate(ctx)
	}()
	return u.snapshot(), nil
}

func (a *App) CancelUpdate() {
	u := updates
	u.mu.Lock()
	cancel := u.cancel
	u.cancel = nil
	busy := u.state.Phase == phaseDownloading || u.state.Phase == phaseVerifying
	if u.state.Phase == phaseFailed {
		u.state = UpdateState{}
	}
	u.mu.Unlock()
	if cancel != nil && busy {
		cancel()
	}
	a.announceUpdate(true)
}

type updateTarget struct {
	version string
	asset   githubAsset
	sums    githubAsset
	plan    installPlan
	client  *http.Client
}

type updateFailure struct {
	code string
	err  error
}

func failed(code string, err error) *updateFailure {
	return &updateFailure{code: code, err: err}
}

func (a *App) resolveUpdate(ctx context.Context) (updateTarget, *updateFailure) {
	source := releaseSource()
	release, err := a.fetchRelease(ctx, source)
	if err != nil {
		return updateTarget{version: updates.snapshot().Version}, failed(failureNetwork, err)
	}
	target := updateTarget{version: release.version(), plan: effectiveInstall(), client: source.client(a.policy().Transport(false))}
	if !isNewerVersion(target.version, currentVersion) {
		return target, failed(failureUnsupported, fmt.Errorf(noNewerRelease, target.version, currentVersion))
	}
	asset, sums, usable := installableAsset(release, source, target.plan)
	if usable {
		target.asset, target.sums = asset, sums
		return target, nil
	}
	if _, found := release.asset(target.plan.Asset); found && target.plan.installs() {
		return target, failed(failureUnverified, nil)
	}
	return target, failed(failureUnsupported, nil)
}

func (a *App) stageUpdate(ctx context.Context, target updateTarget) (stagedUpdate, *updateFailure) {
	expected, err := fetchChecksum(ctx, target.client, target.sums.URL, target.asset.Name)
	if err != nil {
		return stagedUpdate{}, failed(failureUnverified, err)
	}
	staged := stagedUpdate{Version: target.version, Asset: target.asset.Name, Method: target.plan.Method, Sha256: expected}
	path := stagedPath(staged)
	if err := os.MkdirAll(filepath.Dir(path), updateFolderMode); err != nil {
		return staged, failed(failureStorage, err)
	}
	received, err := a.fetchAsset(ctx, target.client, target.asset, path+partialSuffix, target.version)
	if err != nil {
		return staged, failed(failureNetwork, err)
	}
	a.setUpdate(UpdateState{Phase: phaseVerifying, Version: target.version, Received: target.asset.Size, Total: target.asset.Size})
	if received != expected {
		return staged, failed(failureMismatch, nil)
	}
	if err := os.Rename(path+partialSuffix, path); err != nil {
		return staged, failed(failureStorage, err)
	}
	if err := writeStaged(staged); err != nil {
		return staged, failed(failureStorage, err)
	}
	return staged, nil
}

func (a *App) downloadUpdate(ctx context.Context) {
	target, failure := a.resolveUpdate(ctx)
	if failure != nil {
		a.endDownload(ctx, target.version, failure)
		return
	}
	a.setUpdate(UpdateState{Phase: phaseDownloading, Version: target.version, Total: target.asset.Size})
	updates.mu.Lock()
	updates.staged = nil
	updates.mu.Unlock()
	os.RemoveAll(updatesFolder())
	staged, failure := a.stageUpdate(ctx, target)
	if failure != nil {
		os.RemoveAll(updatesFolder())
		a.endDownload(ctx, target.version, failure)
		return
	}
	updates.mu.Lock()
	updates.staged = &staged
	updates.cancel = nil
	updates.mu.Unlock()
	a.setUpdate(UpdateState{Phase: phaseReady, Version: target.version})
}

func (a *App) endDownload(ctx context.Context, version string, failure *updateFailure) {
	if errors.Is(ctx.Err(), context.Canceled) {
		a.setUpdate(UpdateState{})
		return
	}
	a.failUpdate(version, failure.code, failure.err)
}

func fetch(ctx context.Context, client *http.Client, address string) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "Gostman/"+currentVersion)
	request.Header.Set("Accept", "application/octet-stream")
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	if response.StatusCode != http.StatusOK {
		response.Body.Close()
		return nil, fmt.Errorf(downloadRefused, response.StatusCode)
	}
	return response, nil
}

func fetchChecksum(ctx context.Context, client *http.Client, address, asset string) (string, error) {
	response, err := fetch(ctx, client, address)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	lines := bufio.NewScanner(io.LimitReader(response.Body, maxChecksumBytes))
	for lines.Scan() {
		if digest, found := checksumFor(lines.Text(), asset); found {
			return digest, nil
		}
	}
	return "", fmt.Errorf(missingSum, asset)
}

func checksumFor(line, asset string) (string, bool) {
	fields := strings.Fields(line)
	if len(fields) != 2 || strings.TrimPrefix(fields[1], "*") != asset {
		return "", false
	}
	digest := strings.ToLower(fields[0])
	if decoded, err := hex.DecodeString(digest); err != nil || len(decoded) != sha256.Size {
		return "", false
	}
	return digest, true
}

type progressWriter struct {
	app      *App
	version  string
	received int64
	total    int64
}

func (p *progressWriter) Write(chunk []byte) (int, error) {
	p.received += int64(len(chunk))
	updates.mu.Lock()
	updates.state = UpdateState{Phase: phaseDownloading, Version: p.version, Received: p.received, Total: p.total}
	updates.mu.Unlock()
	p.app.announceUpdate(false)
	return len(chunk), nil
}

func (a *App) fetchAsset(ctx context.Context, client *http.Client, asset githubAsset, path, version string) (string, error) {
	response, err := fetch(ctx, client, asset.URL)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	total := asset.Size
	if response.ContentLength > 0 {
		total = response.ContentLength
	}
	if total > maxUpdateBytes {
		return "", fmt.Errorf(downloadTooBig, maxUpdateBytes>>20)
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, updateFileMode)
	if err != nil {
		return "", err
	}
	hash := sha256.New()
	progress := &progressWriter{app: a, version: version, total: total}
	written, err := io.Copy(io.MultiWriter(file, hash, progress), io.LimitReader(response.Body, maxUpdateBytes+1))
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return "", err
	}
	if written > maxUpdateBytes {
		return "", fmt.Errorf(downloadTooBig, maxUpdateBytes>>20)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func writeStaged(staged stagedUpdate) error {
	encoded, err := json.Marshal(staged)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(updatesFolder(), stagedFileName), encoded, backupFileMode)
}

func readStaged() (stagedUpdate, bool) {
	var staged stagedUpdate
	encoded, err := os.ReadFile(filepath.Join(updatesFolder(), stagedFileName))
	if err != nil || json.Unmarshal(encoded, &staged) != nil {
		return staged, false
	}
	if staged.Asset != filepath.Base(staged.Asset) || staged.Version != filepath.Base(staged.Version) {
		return staged, false
	}
	return staged, true
}

func fileDigest(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func (a *App) restoreUpdate() {
	plan := effectiveInstall()
	clearReplaced(plan)
	staged, found := readStaged()
	if !found {
		os.RemoveAll(updatesFolder())
		return
	}
	if !isNewerVersion(staged.Version, currentVersion) || staged.Method != plan.Method {
		os.RemoveAll(updatesFolder())
		return
	}
	digest, err := fileDigest(stagedPath(staged))
	if err != nil || digest != staged.Sha256 {
		os.RemoveAll(updatesFolder())
		return
	}
	updates.mu.Lock()
	if updates.state.Phase != phaseIdle {
		updates.mu.Unlock()
		return
	}
	updates.staged = &staged
	updates.state = UpdateState{Phase: phaseReady, Version: staged.Version}
	updates.mu.Unlock()
	a.announceUpdate(true)
}

func clearReplaced(plan installPlan) {
	switch plan.Method {
	case methodPortable, methodAppImage:
		os.Remove(plan.Target + replacedSuffix)
		os.Remove(plan.Target + incomingSuffix)
	case methodBundle:
		os.RemoveAll(filepath.Join(filepath.Dir(plan.Target), bundleStaging))
	}
}

func (u *updater) takeStaged() (stagedUpdate, bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.staged == nil || u.state.Phase != phaseReady {
		return stagedUpdate{}, false
	}
	staged := *u.staged
	u.state = UpdateState{Phase: phaseInstalling, Version: staged.Version}
	return staged, true
}

func applyStaged(staged stagedUpdate, plan installPlan) error {
	digest, err := fileDigest(stagedPath(staged))
	if err != nil {
		return err
	}
	if digest != staged.Sha256 {
		return fmt.Errorf(sumMismatch, staged.Sha256, digest)
	}
	switch plan.Method {
	case methodPortable, methodAppImage:
		return replaceFile(stagedPath(staged), plan.Target)
	case methodBundle:
		return replaceBundle(stagedPath(staged), plan.Target)
	}
	return nil
}

func (a *App) RestartToUpdate() error {
	plan := effectiveInstall()
	staged, found := updates.takeStaged()
	if !found || staged.Method != plan.Method {
		return errors.New(notReady)
	}
	a.announceUpdate(true)
	if err := applyStaged(staged, plan); err != nil {
		a.installFailed(staged, err)
		return err
	}
	if err := relaunchAfterExit(plan, stagedPath(staged)); err != nil {
		a.installFailed(staged, err)
		return err
	}
	wailsruntime.Quit(a.ctx)
	return nil
}

func (a *App) installFailed(staged stagedUpdate, err error) {
	a.failUpdate(staged.Version, failureInstall, err)
}

func (a *App) installOnQuit() {
	plan := effectiveInstall()
	updates.mu.Lock()
	auto := updates.autoInstall
	updates.mu.Unlock()
	if !auto || !plan.appliesOnQuit() {
		return
	}
	staged, found := updates.takeStaged()
	if !found || staged.Method != plan.Method {
		return
	}
	applyStaged(staged, plan)
}
