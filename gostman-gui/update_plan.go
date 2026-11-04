package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

const (
	methodManual    = "manual"
	methodInstaller = "installer"
	methodPortable  = "portable"
	methodBundle    = "bundle"
	methodAppImage  = "appimage"

	managerScoop    = "scoop"
	managerHomebrew = "homebrew"
	managerSystem   = "system"

	windowsInstallerAsset = "Gostman-windows-amd64.exe"
	windowsPortableAsset  = "Gostman-windows-amd64-portable.exe"
	macBundleAsset        = "Gostman-darwin-universal.zip"
	linuxAppImageAsset    = "Gostman-linux-x86_64.AppImage"
	linuxPackageAsset     = "Gostman-linux-amd64.deb"

	nsisUninstaller  = "uninstall.exe"
	bundleStaging    = ".Gostman-update"
	replacedSuffix   = ".old"
	incomingSuffix   = ".new"
	writeProbePrefix = ".gostman-write-"
)

var homebrewCasks = []string{"/opt/homebrew/Caskroom/gostman", "/usr/local/Caskroom/gostman"}

type installPlan struct {
	Method   string
	Manager  string
	Asset    string
	Download string
	Target   string
}

func (p installPlan) installs() bool {
	return p.Method != methodManual && p.Asset != ""
}

func (p installPlan) asksPermission() bool {
	return p.Method == methodInstaller
}

func (p installPlan) appliesOnQuit() bool {
	return p.Method == methodPortable || p.Method == methodBundle || p.Method == methodAppImage
}

var (
	installOnce sync.Once
	install     installPlan
)

func currentInstall() installPlan {
	installOnce.Do(func() { install = detectInstall() })
	return install
}

func runningExecutable() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		return resolved
	}
	return exe
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func writable(dir string) bool {
	probe, err := os.CreateTemp(dir, writeProbePrefix+"*")
	if err != nil {
		return false
	}
	probe.Close()
	os.Remove(probe.Name())
	return true
}

func manualInstall(manager, download string) installPlan {
	return installPlan{Method: methodManual, Manager: manager, Download: download}
}

func detectInstall() installPlan {
	exe := runningExecutable()
	if exe == "" {
		return manualInstall("", "")
	}
	switch runtime.GOOS {
	case "windows":
		return windowsInstall(exe)
	case "darwin":
		return macInstall(exe)
	case "linux":
		return linuxInstall(exe)
	}
	return manualInstall("", "")
}

func windowsInstall(exe string) installPlan {
	dir := filepath.Dir(exe)
	switch {
	case runtime.GOARCH != "amd64":
		return manualInstall("", "")
	case strings.Contains(strings.ToLower(exe), `\scoop\apps\`):
		return manualInstall(managerScoop, "")
	case exists(filepath.Join(dir, nsisUninstaller)):
		return installPlan{Method: methodInstaller, Asset: windowsInstallerAsset, Target: exe}
	case writable(dir):
		return installPlan{Method: methodPortable, Asset: windowsPortableAsset, Target: exe}
	}
	return manualInstall("", "")
}

func macBundle(exe string) string {
	macos := filepath.Dir(exe)
	contents := filepath.Dir(macos)
	bundle := filepath.Dir(contents)
	if filepath.Base(macos) != "MacOS" || filepath.Base(contents) != "Contents" || !strings.HasSuffix(bundle, ".app") {
		return ""
	}
	return bundle
}

func macInstall(exe string) installPlan {
	bundle := macBundle(exe)
	switch {
	case bundle == "", strings.Contains(bundle, "/AppTranslocation/"), strings.HasPrefix(bundle, "/Volumes/"):
		return manualInstall("", "")
	case exists(homebrewCasks[0]) || exists(homebrewCasks[1]):
		return manualInstall(managerHomebrew, "")
	case writable(filepath.Dir(bundle)):
		return installPlan{Method: methodBundle, Asset: macBundleAsset, Target: bundle}
	}
	return manualInstall("", "")
}

func linuxInstall(exe string) installPlan {
	image := os.Getenv("APPIMAGE")
	switch {
	case runtime.GOARCH != "amd64":
		return manualInstall("", "")
	case image != "" && filepath.IsAbs(image) && exists(image) && writable(filepath.Dir(image)):
		return installPlan{Method: methodAppImage, Asset: linuxAppImageAsset, Target: image}
	case image != "":
		return manualInstall("", "")
	case strings.HasPrefix(exe, "/usr/"):
		return manualInstall(managerSystem, linuxPackageAsset)
	}
	return manualInstall("", "")
}
