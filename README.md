# CampusGuard

CampusGuard helps people find evacuation routes in Rizal Building and sends SOS requests to
the MCL Track Oval. The routing engine is C++; the desktop webview and phone app share the
polished interface in `web/`.

## Project map

```text
core/
  include/       C++ structures and algorithms used by the app
  src/           App and console entry points
web/             Shared desktop and phone interface
```

### Find a feature

| If you want to explain... | Open this file |
|---|---|
| People list, SOS queue, recent-place circular list, or route-ranking heap | `core/include/ds.hpp` |
| Campus hierarchy, binary tree, name BST, AVL room index, or prefix trie | `core/include/Tree.hpp` |
| Campus graph, BFS/DFS, or weighted Dijkstra routes | `core/include/Graph.hpp` |
| Merge sort or binary search | `core/include/Algorithms.hpp` |
| Room layout, indexes, route options, SOS, and app commands | `core/include/Campus.hpp` |
| Search, recent locations, route preference, or route comparison UI | `web/index.html`, `web/app.js`, `web/style.css` |
| Phone/offline engine mirror | `web/engine.js` |

These structures now support app actions: location suggestions use a trie, exact names
use a binary search tree, added rooms use an AVL index, recent locations cycle through a
circular list, and alternate distance-based routes use Dijkstra and a heap. The existing
fewest-connections route remains the default. SOS requests are still handled FIFO.

## Build and run

The project uses CMake to configure builds; generated Makefiles are build instructions, not
the app's source code. For a direct C++ build without CMake:

```sh
./build_native.sh              # build the console app
./build/campusguard            # run it; type "demo" for the walkthrough
```

On macOS, `./build_app_mac.sh` builds and opens the desktop app. On Windows, run
`build_windows.bat` in the Visual Studio C++ tools prompt. To preview the phone/web app, run
`./serve.sh` and open its printed address.

## Phone app (iPhone + Android)
1. Put the `web/` folder online with HTTPS (free): drag it onto https://app.netlify.com/drop  (or use GitHub Pages).
2. iPhone: open the link in **Safari** -> Share -> **Add to Home Screen**.
   Android: open the link in **Chrome** -> menu -> **Install app**.
3. Open it once with internet; after that it works fully offline (the engine runs on the phone).
Quick Wi-Fi test without hosting: `./serve.sh` (Mac) or `serve.bat` (Windows), open the printed address on the phone.
(Home-screen install + offline needs HTTPS; plain http only works as a normal page.)

## Map notes

The room numbers on floors 2–5 come from the provided evacuation plans. The ground-floor
plan has no room labels, so its room names are placeholders (`R1S1`–`R1N5`). The layout and
distances are approximate teaching schematics, not surveyed emergency directions. Follow
posted signs and campus staff. Tune distances in `core/include/Campus.hpp` and `web/engine.js`.

The phone app uses `web/engine.js`, a JavaScript mirror of the C++ engine. The Mac and Windows
desktop apps use the C++ engine.
