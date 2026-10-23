import { GO_MODULE, HOMEBREW_TAP, SCOOP_BUCKET_URL } from "../../lib/siteLinks"
import { BLANK, command, muted } from "./terminalLines"

const APP = muted("Desktop app")
const CLI = muted("Command line")

export const PACKAGE_MANAGERS = [
  {
    id: "homebrew",
    label: "Homebrew",
    os: "macos",
    lines: [APP, command(`brew install --cask ${HOMEBREW_TAP}/gostman`), BLANK, CLI, command(`brew install ${HOMEBREW_TAP}/gostman-cli`)],
  },
  {
    id: "scoop",
    label: "Scoop",
    os: "windows",
    lines: [command(`scoop bucket add gostman ${SCOOP_BUCKET_URL}`), BLANK, APP, command("scoop install gostman"), BLANK, CLI, command("scoop install gostman-cli")],
  },
  {
    id: "aur",
    label: "AUR",
    os: "linux",
    lines: [muted("Desktop app, community package"), command("yay -S gostman-bin")],
  },
  {
    id: "go",
    label: "Go",
    lines: [CLI, command(`go install ${GO_MODULE}/cmd/gostman@latest`)],
  },
]

export const packageManagerFor = (os) => PACKAGE_MANAGERS.find((install) => install.os === os) ?? PACKAGE_MANAGERS[0]
