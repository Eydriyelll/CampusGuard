#!/bin/sh
set -e
mkdir -p build
g++ -std=c++17 -Wall -Wextra -O2 -Icore/include core/src/main.cpp -o build/campusguard
echo "OK -> build/campusguard"
