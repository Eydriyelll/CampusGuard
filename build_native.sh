#!/bin/sh
set -e
mkdir -p build

if [ "$1" = "--lessons" ]; then
  g++ -std=c++17 -Wall -Wextra -O2 core/lessons/examples.cpp -o build/campusguard-lessons
  ./build/campusguard-lessons
  echo "All DSA lesson examples passed."
else
  g++ -std=c++17 -Wall -Wextra -O2 -Icore/include core/src/main.cpp -o build/campusguard
  echo "OK -> build/campusguard"
fi
