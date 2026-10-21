class GostmanCli < Formula
  desc "Gostman command line: run API collections in CI, mock, capture, and MCP for agents"
  homepage "https://github.com/kunalgoesbyken/gostman"
  version "1.4.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.4.0/gostman-cli-darwin-arm64.tar.gz"
      sha256 "5abf06b27a90a6dcbbd2dfbc89007e79835d92cbae94a03579ff253e2c6ddef7"
    else
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.4.0/gostman-cli-darwin-amd64.tar.gz"
      sha256 "ad122aa59c348a623d800144f6018f230c48358959aaf7dc5cb194cc4165e822"
    end
  end

  on_linux do
    url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.4.0/gostman-cli-linux-amd64.tar.gz"
    sha256 "3012ec5aa62c611186305b907ba5808cab3ec8528bf813b61e8a5d7f0fd3172f"
  end

  def install
    bin.install "gostman"
  end

  test do
    assert_match "gostman", shell_output("#{bin}/gostman help 2>&1")
  end
end
