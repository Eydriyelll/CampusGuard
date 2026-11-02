#!/bin/bash
# Build + launch the CampusGuard desktop window on macOS. Run from the project root:  ./build_gui_mac.sh
set -e
cd "$(dirname "$0")"
H=$(find build-gui core -path '*webview/webview.h' 2>/dev/null | head -1)
if [ -z "$H" ]; then
  echo "Downloading the webview library..."
  mkdir -p core/third_party
  git clone --depth 1 --branch 0.10.0 https://github.com/webview/webview core/third_party/webview
  H=$(find core/third_party -path '*webview/webview.h' | head -1)
fi
INC=$(dirname "$(dirname "$H")")
echo "Using webview from: $INC"
clang++ -std=c++17 -O2 -Icore/include -I"$INC" -DWEB_DIR="\"$PWD/web\"" core/src/gui.cpp -o campusguard_gui -framework WebKit
echo "Built ./campusguard_gui - launching..."
./campusguard_gui
