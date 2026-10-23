class GostmanCli < Formula
  desc "Gostman command line: run API collections in CI, mock, capture, and MCP for agents"
  homepage "https://github.com/kunalgoesbyken/gostman"
  version "1.7.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.7.1/gostman-cli-darwin-arm64.tar.gz"
      sha256 "4d92435db50d7bbf5d09c568bf29e6be54adc843828883e64bb5c19aa7fcd29b"
    else
      url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.7.1/gostman-cli-darwin-amd64.tar.gz"
      sha256 "1240487042a232ed3af239c4630ff1c04dcd97e4f98401b575e6ecc285f4eb4c"
    end
  end

  on_linux do
    url "https://github.com/kunalgoesbyken/gostman/releases/download/v1.7.1/gostman-cli-linux-amd64.tar.gz"
    sha256 "9e196c4a375c277a5e130f06369929d27d1c68164cb30210b4463fbde04b475e"
  end

  def install
    bin.install "gostman"
  end

  test do
    assert_match "gostman", shell_output("#{bin}/gostman help 2>&1")
  end
end
