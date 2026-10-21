# Packaging

Manifests for installing Gostman through package managers. They track the
latest release; after each release, bump `version` and the hashes (the release
page lists SHA-256 digests).

| Manager | Files | Where it is published |
| --- | --- | --- |
| Scoop | `scoop/gostman.json`, `scoop/gostman-cli.json` | A bucket repo named `scoop-gostman`. Users: `scoop bucket add gostman https://github.com/kunalgoesbyken/scoop-gostman` then `scoop install gostman` |
| Homebrew | `homebrew/Casks/gostman.rb`, `homebrew/Formula/gostman-cli.rb` | A tap repo named `homebrew-tap`. Users: `brew install --cask kunalgoesbyken/tap/gostman` and `brew install kunalgoesbyken/tap/gostman-cli` |
| winget | `winget/manifests/...` | A pull request to `microsoft/winget-pkgs`. Users: `winget install kunalgoesbyken.Gostman` |

Scoop's `checkver`/`autoupdate` blocks let `scoop`'s excavator workflow bump
the version automatically. For winget, `komac` or `wingetcreate` can open the
update PR from CI.
