cask "nyx" do
  version "0.2.0"
  sha256 "8644288ede9befea0b5d22351e833178221c74898c265e4d530780976bb3085b"

  url "https://github.com/mineo71/Nyx/releases/download/v#{version}/Nyx-#{version}-arm64.dmg",
      verified: "github.com/mineo71/Nyx/"
  name "Nyx"
  desc "Menu-bar app that catches you falling asleep watching"
  homepage "https://github.com/mineo71/Nyx"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on arch: :arm64
  depends_on macos: :big_sur

  app "Nyx.app"

  # Unsigned build → drop the quarantine flag so it launches without the Gatekeeper prompt.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Nyx.app"]
  end

  zap trash: [
    "~/Library/Application Support/nyx",
    "~/Library/Preferences/com.oleh.nyx.plist",
    "~/Library/Saved Application State/com.oleh.nyx.savedState",
  ]
end
