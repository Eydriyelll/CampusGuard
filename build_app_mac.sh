#!/bin/bash
# Builds CampusGuard.app (a real native macOS application) and opens it.
# Run from the project root:   ./build_app_mac.sh
set -e
cd "$(dirname "$0")"
APP="CampusGuard.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
clang++ -std=c++17 -O2 -fobjc-arc -Icore/include core/src/app_mac.mm \
        -o "$APP/Contents/MacOS/CampusGuard" -framework Cocoa
cat > "$APP/Contents/Info.plist" <<'PL'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>CampusGuard</string>
  <key>CFBundleDisplayName</key><string>CampusGuard</string>
  <key>CFBundleExecutable</key><string>CampusGuard</string>
  <key>CFBundleIdentifier</key><string>edu.mcl.campusguard</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>10.13</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PL
codesign --force --sign - "$APP" >/dev/null 2>&1 || true
echo "Built $APP - opening..."
open "$APP"
