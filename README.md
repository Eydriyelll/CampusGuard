# CampusGuard - Phone + Mac + Windows

One C++ engine (core/include/*.hpp), three app shells.

| Platform | App | How |
|---|---|---|
| Mac | native window (Cocoa) | `./build_app_mac.sh`  -> CampusGuard.app |
| Windows | native window (WebView2) | `build_windows.bat` in "x64 Native Tools Command Prompt for VS" -> CampusGuard.exe |
| iPhone + Android | home-screen app, works offline | host the `web/` folder over HTTPS, then Add to Home Screen / Install |
| Console demo | terminal | `clang++ -std=c++17 -Icore/include core/src/main.cpp -o campusguard && ./campusguard` then `demo` |

## Find the code quickly

Start with `core/src/main.cpp` for the console, `core/src/gui.cpp` for the desktop window,
and `web/index.html` / `web/app.js` for the interface. The engine is kept in small headers:

| Lesson or feature | File to open | What to look for |
|---|---|---|
| Singly linked list | `core/include/ds.hpp` | `LinkedList<T>` |
| Doubly linked list | `core/include/ds.hpp` | `DoublyLinkedList<T>`; used for the people registry in `Campus.hpp` |
| Stack and queue | `core/include/ds.hpp` | `Stack<T>` and `Queue<T>` |
| Campus hierarchy tree | `core/include/Tree.hpp` | `TreeNode` |
| Graph, BFS routes, DFS cut-off check | `core/include/Graph.hpp` | `Graph`, `bfs()`, and `cutOff()` |
| Merge sort and binary search | `core/include/Algorithms.hpp` | `mergeSort()` and `binarySearch()` |
| Campus rooms and application commands | `core/include/Campus.hpp` | `buildRizal()` and `exec()` |
| Phone/browser engine | `web/engine.js` | JavaScript mirror of the C++ engine |

The app's **DSA lessons** tab shows code paths and line numbers. Planned topics are listed
separately in `core/lessons/README.md`; they are not described as working features.

## Build and run

On macOS, run `./build_native.sh` for the console or `./build_app_mac.sh` for the app window.
To preview the web version locally, run `./serve.sh` and open its printed address.

## Phone app (iPhone + Android)
1. Put the `web/` folder online with HTTPS (free): drag it onto https://app.netlify.com/drop  (or use GitHub Pages).
2. iPhone: open the link in **Safari** -> Share -> **Add to Home Screen**.
   Android: open the link in **Chrome** -> menu -> **Install app**.
3. Open it once with internet; after that it works fully offline (the engine runs on the phone).
Quick Wi-Fi test without hosting: `./serve.sh` (Mac) or `serve.bat` (Windows), open the printed address on the phone.
(Home-screen install + offline needs HTTPS; plain http only works as a normal page.)

## Notes
- Real room numbers come from the evacuation-plan photos (2F-5F). The ground-floor plan had no room labels, so floor 1 uses placeholders (R1S1.., R1N1..).
  Edit the room tables in `buildRizal()` (`Campus.hpp`) and `engine.js`.
- Legend items implemented: Fire Alarm Call Point, Fire Extinguisher, Fire Hose, Safe Refuge, Assembly Point (the Oval), Fire Exit,
  Escape Routes + Escape Direction (green route with arrows). Plus the emergency contacts and fire steps printed on the plans.
- The phone app uses engine.js, a JavaScript mirror of the C++ engine (tested identical on 73 commands).
  Mac and Windows apps run the real C++ engine.
- The displayed floor layouts and distances are approximate teaching schematics based on the posted evacuation plans, not surveyed emergency directions.
  Follow official signs and campus staff. Tune the distance constants near the top of `Campus.hpp` and `engine.js`.
