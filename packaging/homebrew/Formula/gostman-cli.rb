class GostmanCli < Formula
  desc "Gostman command line: run API collections in CI, mock, capture, and MCP for agents"
  homepage "https://github.com/kunalgoesbyken/gostman"
  version "1.6.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.6.0/gostman-cli-darwin-arm64.tar.gz"
      sha256 "5c2e9269c50f71518ac9e3a5bb1344ae8b1a726f37db1718cd918ccc186d32a4"
    else
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.6.0/gostman-cli-darwin-amd64.tar.gz"
      sha256 "d7bda4963b7cc353f3029b8917f4f9a78ef357f27957ec7732460231fd098c42"
    end
  end

  on_linux do
    url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.6.0/gostman-cli-linux-amd64.tar.gz"
    sha256 "dd057c2edcb110941114ac4faf34874b8b2c5f1a80732e87d9db7ceaa1025b4a"
  end

  def install
    bin.install "gostman"
  end

  test do
    assert_match "gostman", shell_output("#{bin}/gostman help 2>&1")
  end
end
