class GostmanCli < Formula
  desc "Gostman command line: run API collections in CI, mock, capture, and MCP for agents"
  homepage "https://github.com/kunalgoesbyken/gostman"
  version "1.5.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.5.0/gostman-cli-darwin-arm64.tar.gz"
      sha256 "c50d3dba042b5119612bbe7f99fd42acfcdbc8748eac47377ffc32204855e792"
    else
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.5.0/gostman-cli-darwin-amd64.tar.gz"
      sha256 "1a4893e701284e48efca49ff0afbeaf0e3adeb552c8807458a498ca23053e835"
    end
  end

  on_linux do
    url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.5.0/gostman-cli-linux-amd64.tar.gz"
    sha256 "5f60b876406a89d8b8fd48261f0d9f29aa1542759da3f0966222becca9298bc9"
  end

  def install
    bin.install "gostman"
  end

  test do
    assert_match "gostman", shell_output("#{bin}/gostman help 2>&1")
  end
end
