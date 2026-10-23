export const RELEASE_URL = "https://github.com/kunalgoesbyken/gostman/releases/latest/download"

export const DOWNLOADS = [
  { os: "macos", name: "macOS", note: "Intel and Apple Silicon", kind: ".dmg", file: "Gostman-darwin-universal.dmg" },
  { os: "windows", name: "Windows", note: "64-bit installer", kind: ".exe", file: "Gostman-windows-amd64.exe" },
  { os: "linux", name: "Linux", note: "Debian, Ubuntu", kind: ".deb", file: "Gostman-linux-amd64.deb" },
  { os: "linux", name: "Linux", note: "Arch, community package", kind: "AUR", url: "https://aur.archlinux.org/packages/gostman-bin" },
  { os: "linux", name: "Linux", note: "Any distribution", kind: "AppImage", file: "Gostman-linux-x86_64.AppImage" },
  { os: "linux", name: "Linux", note: "System libraries", kind: ".tar.gz", file: "Gostman-linux-amd64.tar.gz" },
]

export const downloadUrl = (download) => download.url ?? `${RELEASE_URL}/${download.file}`

export const isExternal = (download) => Boolean(download.url)

export const downloadFor = (os) => DOWNLOADS.find((download) => download.os === os)

export const groupByOs = (downloads) =>
  downloads.reduce((groups, download) => {
    const group = groups.find((candidate) => candidate.os === download.os)
    if (group) {
      group.downloads.push(download)
      return groups
    }
    return [...groups, { os: download.os, name: download.name, downloads: [download] }]
  }, [])
