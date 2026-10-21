export const RELEASE_URL = "https://github.com/kunalgoesbyken/gostman/releases/latest/download"

export const DOWNLOADS = [
  { os: "macos", name: "macOS", note: "Disk image for Intel and Apple Silicon", kind: ".dmg", file: "Gostman-darwin-universal.dmg" },
  { os: "windows", name: "Windows", note: "64-bit installer", kind: ".exe", file: "Gostman-windows-amd64.exe" },
  { os: "linux", name: "Linux", note: "Debian and Ubuntu package", kind: ".deb", file: "Gostman-linux-amd64.deb" },
  { os: "linux", name: "Linux", note: "Other distributions", kind: ".tar.gz", file: "Gostman-linux-amd64.tar.gz" },
]

export const downloadUrl = (download) => `${RELEASE_URL}/${download.file}`
