#!/bin/sh
# needs the Emscripten SDK activated (see README step 4)
emcc core/src/wasm_api.cpp -std=c++17 -O2 -Icore/include -o web/campusguard.js \
  -sMODULARIZE=1 -sEXPORT_NAME=CampusGuard -sSINGLE_FILE=1 \
  -sEXPORTED_FUNCTIONS=_cg_exec -sEXPORTED_RUNTIME_METHODS=cwrap && echo "OK -> web/campusguard.js"
